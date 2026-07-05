"""
Pipeline evaluation harness.

Measures WHERE fidelity is lost between sketch and generated code by splitting
the pipeline into two independently-scored stages:

  Stage 1 — DETECTION: run SketchDetector (Roboflow) on synthetic training
  images and score the returned boxes against the YOLO ground-truth labels
  (IoU >= 0.5, per-class precision/recall). Training images should score
  near-perfect here; if they don't, the loss is in the MODEL, not our code.

  Stage 2 — GENERATION: run the full post-detection pipeline (container
  synthesis, text attachment, Gemini prompt, Gemini call) and save the prompt
  + generated code per image for manual fidelity review.

Usage (from backend/):
  python scripts/eval_pipeline.py --num 15                 # both stages
  python scripts/eval_pipeline.py --num 15 --stage detect  # detection only (cheap)
  python scripts/eval_pipeline.py --images sketch_00001    # specific image(s)
  python scripts/eval_pipeline.py --tag after-fixes        # label the output dir

Artifacts land in backend/debug/eval/<tag>/:
  report.md                    — metrics table + per-image summary
  <image>/detections.json      — raw detected elements
  <image>/prompt.txt           — exact Gemini prompt (generation stage)
  <image>/generated_code.txt   — Gemini output (generation stage)

Notes:
  - Detection stage uses sketch_source=None (no crop preprocessing) so box
    coordinates stay in the original image pixel space the ground-truth labels
    use. Generation stage uses "upload-clean" to exercise the real upload path.
  - Set CACHE_ENABLED=false in the environment; this script also forces it off
    for its own process so repeated runs never serve stale generations.
"""

from __future__ import annotations

import argparse
import base64
import io
import json
import os
import random
import sys
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Dict, List, Optional, Tuple

BACKEND_DIR = Path(__file__).resolve().parent.parent
REPO_DIR = BACKEND_DIR.parent
sys.path.insert(0, str(BACKEND_DIR))

os.environ["CACHE_ENABLED"] = "false"

from dotenv import load_dotenv  # noqa: E402

load_dotenv(BACKEND_DIR / ".env")
load_dotenv(REPO_DIR / ".env.local", override=False)
load_dotenv(REPO_DIR / ".env", override=False)

from app.models.inference import (  # noqa: E402
    detect_with_roboflow,
    generate_with_gemini,
    _build_gemini_prompt,
)

DATASET_DIR = REPO_DIR / "synthetic_dataset" / "train"
IMAGES_DIR = DATASET_DIR / "images"
LABELS_DIR = DATASET_DIR / "labels"
EVAL_ROOT = BACKEND_DIR / "debug" / "eval"

# YOLO class ids are alphabetical over the four class names (see CLAUDE.md).
CLASS_NAMES = {0: "card", 1: "footer", 2: "navbar", 3: "section"}
IOU_MATCH_THRESHOLD = 0.5


@dataclass
class Box:
    cls: str
    x: float  # top-left
    y: float
    w: float
    h: float
    confidence: float = 0.0
    matched: bool = False


@dataclass
class ClassStats:
    tp: int = 0
    fp: int = 0
    fn: int = 0

    @property
    def precision(self) -> float:
        return self.tp / (self.tp + self.fp) if (self.tp + self.fp) else 0.0

    @property
    def recall(self) -> float:
        return self.tp / (self.tp + self.fn) if (self.tp + self.fn) else 0.0


@dataclass
class ImageResult:
    name: str
    gt_count: int = 0
    det_count: int = 0
    per_class: Dict[str, ClassStats] = field(default_factory=dict)
    generation_ok: Optional[bool] = None
    error: Optional[str] = None


def iou(a: Box, b: Box) -> float:
    ix1, iy1 = max(a.x, b.x), max(a.y, b.y)
    ix2, iy2 = min(a.x + a.w, b.x + b.w), min(a.y + a.h, b.y + b.h)
    iw, ih = ix2 - ix1, iy2 - iy1
    if iw <= 0 or ih <= 0:
        return 0.0
    inter = iw * ih
    union = a.w * a.h + b.w * b.h - inter
    return inter / union if union > 0 else 0.0


def load_ground_truth(label_path: Path, img_w: int, img_h: int) -> List[Box]:
    boxes: List[Box] = []
    for line in label_path.read_text().splitlines():
        parts = line.split()
        if len(parts) < 5:
            continue
        cls_id, cx, cy, w, h = int(parts[0]), *map(float, parts[1:5])
        boxes.append(
            Box(
                cls=CLASS_NAMES.get(cls_id, str(cls_id)),
                x=(cx - w / 2) * img_w,
                y=(cy - h / 2) * img_h,
                w=w * img_w,
                h=h * img_h,
            )
        )
    return boxes


def image_to_b64(path: Path) -> str:
    return base64.b64encode(path.read_bytes()).decode("ascii")


def image_size(path: Path) -> Tuple[int, int]:
    from PIL import Image

    with Image.open(path) as im:
        return im.width, im.height


def score_detections(gt: List[Box], det: List[Box]) -> Dict[str, ClassStats]:
    """Greedy IoU matching within each class, highest-confidence detections first."""
    stats: Dict[str, ClassStats] = {}
    for cls in sorted({b.cls for b in gt} | {b.cls for b in det}):
        cls_gt = [b for b in gt if b.cls == cls]
        cls_det = sorted(
            (b for b in det if b.cls == cls), key=lambda b: b.confidence, reverse=True
        )
        s = ClassStats()
        for d in cls_det:
            best, best_iou = None, 0.0
            for g in cls_gt:
                if g.matched:
                    continue
                v = iou(d, g)
                if v > best_iou:
                    best, best_iou = g, v
            if best is not None and best_iou >= IOU_MATCH_THRESHOLD:
                best.matched = True
                d.matched = True
                s.tp += 1
            else:
                s.fp += 1
        s.fn = sum(1 for g in cls_gt if not g.matched)
        stats[cls] = s
    return stats


def elements_to_boxes(elements) -> List[Box]:
    out: List[Box] = []
    for el in elements:
        b = el.bounds or {}
        out.append(
            Box(
                cls=(el.type or "").lower(),
                x=float(b.get("x", 0)),
                y=float(b.get("y", 0)),
                w=float(b.get("width", 0)),
                h=float(b.get("height", 0)),
                confidence=float(el.confidence or 0.0),
            )
        )
    return out


def run_detection_stage(image_path: Path, out_dir: Path, result: ImageResult) -> None:
    img_w, img_h = image_size(image_path)
    gt = load_ground_truth(LABELS_DIR / f"{image_path.stem}.txt", img_w, img_h)
    result.gt_count = len(gt)

    # sketch_source=None → no crop preprocessing → detection coords stay in the
    # ground-truth pixel space.
    output = detect_with_roboflow(image_to_b64(image_path), (img_w, img_h))
    if output is None or not output.elements:
        result.det_count = 0
        result.per_class = score_detections(gt, [])
        (out_dir / "detections.json").write_text("[]")
        return

    det = elements_to_boxes(output.elements)
    result.det_count = len(det)
    result.per_class = score_detections(gt, det)

    (out_dir / "detections.json").write_text(
        json.dumps(
            [
                {
                    "type": el.type,
                    "confidence": el.confidence,
                    "bounds": el.bounds,
                }
                for el in output.elements
            ],
            indent=2,
        )
    )


def run_generation_stage(image_path: Path, out_dir: Path, result: ImageResult) -> None:
    """Full upload-path run: detection with upload-clean preprocessing, container
    synthesis, text attachment, Gemini multimodal call. Mirrors
    resolve_external_model_output in main.py minus HTTP/auth/persistence."""
    from main import _attach_text_annotations, _synthesize_missing_containers
    from app.utils.role_inference import annotate_alignment, annotate_role_hints

    img_w, img_h = image_size(image_path)
    output = detect_with_roboflow(
        image_to_b64(image_path), (img_w, img_h), sketch_source="upload-clean"
    )
    if output is None or not output.elements:
        result.generation_ok = False
        result.error = "detection returned nothing on upload-clean path"
        return

    meta = output.metadata or {}
    image_bytes = None
    processed_b64 = meta.pop("processed_image_b64", None)
    if processed_b64:
        image_bytes = base64.b64decode(processed_b64)

    image_w = float(meta.get("image_width") or img_w)
    image_h = float(meta.get("image_height") or img_h)

    output.elements = _synthesize_missing_containers(
        output.elements, [], (image_w, image_h), debug=False
    )
    extra_text = _attach_text_annotations(output.elements, [], debug=False)
    annotate_role_hints(output.elements)
    annotate_alignment(output.elements)

    prompt = _build_gemini_prompt(
        output.elements,
        "react",
        "tailwind",
        None,
        extra_text=extra_text or None,
        has_image=image_bytes is not None,
    )
    (out_dir / "prompt.txt").write_text(prompt, encoding="utf-8")

    code = generate_with_gemini(
        output.elements,
        "react",
        "tailwind",
        None,
        extra_text=extra_text or None,
        image_bytes=image_bytes,
    )
    (out_dir / "generated_code.txt").write_text(code, encoding="utf-8")
    result.generation_ok = True


def write_report(results: List[ImageResult], out_root: Path, stage: str) -> None:
    totals: Dict[str, ClassStats] = {}
    for r in results:
        for cls, s in r.per_class.items():
            agg = totals.setdefault(cls, ClassStats())
            agg.tp += s.tp
            agg.fp += s.fp
            agg.fn += s.fn

    lines = [
        "# Pipeline eval report",
        "",
        f"- Generated: {time.strftime('%Y-%m-%d %H:%M:%S')}",
        f"- Stage: {stage}",
        f"- Images: {len(results)}",
        f"- IoU match threshold: {IOU_MATCH_THRESHOLD}",
        "",
    ]

    if totals:
        lines += [
            "## Detection metrics (aggregate)",
            "",
            "| class | TP | FP | FN | precision | recall |",
            "|-------|----|----|----|-----------|--------|",
        ]
        all_stats = ClassStats()
        for cls in sorted(totals):
            s = totals[cls]
            all_stats.tp += s.tp
            all_stats.fp += s.fp
            all_stats.fn += s.fn
            lines.append(
                f"| {cls} | {s.tp} | {s.fp} | {s.fn} "
                f"| {s.precision:.2%} | {s.recall:.2%} |"
            )
        lines.append(
            f"| **all** | {all_stats.tp} | {all_stats.fp} | {all_stats.fn} "
            f"| {all_stats.precision:.2%} | {all_stats.recall:.2%} |"
        )
        lines.append("")

    lines += ["## Per image", "", "| image | GT boxes | detected | recall | generation | note |", "|---|---|---|---|---|---|"]
    for r in results:
        tp = sum(s.tp for s in r.per_class.values())
        fn = sum(s.fn for s in r.per_class.values())
        rec = tp / (tp + fn) if (tp + fn) else 0.0
        gen = {True: "ok", False: "FAILED", None: "-"}[r.generation_ok]
        lines.append(
            f"| {r.name} | {r.gt_count} | {r.det_count} | {rec:.0%} | {gen} | {r.error or ''} |"
        )

    report_path = out_root / "report.md"
    report_path.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(f"\nReport written to {report_path}")
    print("\n".join(lines))


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--num", type=int, default=15, help="number of images to sample")
    parser.add_argument("--seed", type=int, default=42, help="sampling seed (stable set)")
    parser.add_argument(
        "--images", nargs="*", default=None, help="specific image stems, e.g. sketch_00001"
    )
    parser.add_argument(
        "--stage", choices=["detect", "generate", "both"], default="both"
    )
    parser.add_argument("--tag", default=None, help="output dir name under debug/eval/")
    args = parser.parse_args()

    if args.images:
        stems = args.images
    else:
        all_stems = sorted(p.stem for p in IMAGES_DIR.glob("*.jpg"))
        random.Random(args.seed).shuffle(all_stems)
        stems = all_stems[: args.num]

    tag = args.tag or time.strftime("%Y%m%d-%H%M%S")
    out_root = EVAL_ROOT / tag
    out_root.mkdir(parents=True, exist_ok=True)
    print(f"Evaluating {len(stems)} image(s) -> {out_root}")

    results: List[ImageResult] = []
    for i, stem in enumerate(stems, 1):
        image_path = IMAGES_DIR / f"{stem}.jpg"
        if not image_path.exists():
            print(f"[{i}/{len(stems)}] {stem}: image not found, skipping")
            continue
        print(f"[{i}/{len(stems)}] {stem}")
        out_dir = out_root / stem
        out_dir.mkdir(exist_ok=True)
        result = ImageResult(name=stem)

        try:
            if args.stage in ("detect", "both"):
                run_detection_stage(image_path, out_dir, result)
            if args.stage in ("generate", "both"):
                run_generation_stage(image_path, out_dir, result)
        except Exception as exc:  # keep the batch going, record the failure
            result.error = str(exc)
            print(f"    ERROR: {exc}")

        results.append(result)

    write_report(results, out_root, args.stage)


if __name__ == "__main__":
    main()
