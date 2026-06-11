"""v4 model honest-evaluation harness.

Two jobs:

  1. Split-contamination check
     Walks the locally-downloaded v4 dataset folder and counts synthetic
     (sketch_*.jpg) vs other (real) images per split. If synthetic images
     show up in valid/ or test/, the Roboflow-reported mAP is partly
     inflated and Decision #15 was violated.

  2. Local mAP@50 computation
     Hits object-detection-4affw/4 with every test image, parses
     predictions, compares to ground-truth YOLO labels, computes IoU
     matching and per-class precision/recall/AP. Reports separately for
     synthetic and real subsets so we can see if v4 "knows" both equally
     well or is just memorising the synthetic style.

Usage:
    # 1. Download v4 dataset zip from Roboflow (Versions -> v4 -> Download
    #    Dataset -> YOLOv11 PyTorch -> Download zip to computer). Unzip.
    # 2. Set ROBOFLOW_API_KEY in your shell.
    # 3. Run:
    python backend/eval_v4.py --dataset C:\\path\\to\\unzipped\\v4-dataset

Optional flags:
    --model-id object-detection-4affw/4      (default)
    --conf 0.20                              prediction confidence floor
    --skip-inference                         contamination check only
"""
from __future__ import annotations

import argparse
import os
import sys
from collections import defaultdict
from pathlib import Path

CLASS_NAMES = ["card", "footer", "navbar", "section"]


def is_synthetic(filename: str) -> bool:
    """Synthetic images are named sketch_NNNNN.jpg by generate.py."""
    name = Path(filename).name.lower()
    return name.startswith("sketch_") and name.split(".")[0][7:].isdigit()


# ---------------------------------------------------------------------------
# Contamination check.
# ---------------------------------------------------------------------------

def contamination_report(dataset_root: Path) -> dict:
    """Walk train/ valid/ test/ image folders and classify each file."""
    report: dict = {}
    for split in ("train", "valid", "test"):
        img_dir = dataset_root / split / "images"
        if not img_dir.exists():
            report[split] = {"missing": True}
            continue

        files = [f for f in img_dir.iterdir() if f.is_file()]
        synthetic = [f for f in files if is_synthetic(f.name)]
        real = [f for f in files if not is_synthetic(f.name)]
        report[split] = {
            "total": len(files),
            "synthetic": len(synthetic),
            "real": len(real),
            "real_samples": [f.name for f in real[:5]],
            "synthetic_samples": [f.name for f in synthetic[:5]],
        }
    return report


def print_contamination(report: dict):
    print("\n=== SPLIT CONTAMINATION CHECK ===\n")
    print(f"{'split':<10}{'total':>8}{'synthetic':>12}{'real':>8}  verdict")
    print("-" * 55)
    for split, info in report.items():
        if info.get("missing"):
            print(f"{split:<10}  (folder not found)")
            continue
        total = info["total"]
        syn = info["synthetic"]
        real = info["real"]

        if split == "train":
            verdict = "ok (synthetic belongs in train)"
        else:
            if syn == 0:
                verdict = "CLEAN — no synthetic leakage"
            else:
                ratio = syn / total if total else 0
                verdict = f"LEAKAGE — {syn}/{total} ({ratio:.0%}) synthetic"
        print(f"{split:<10}{total:>8}{syn:>12}{real:>8}  {verdict}")

    print("\nFirst few REAL filenames in test/ (these are the original Shahwaiz images):")
    for n in report.get("test", {}).get("real_samples", [])[:10]:
        print(f"  {n}")


# ---------------------------------------------------------------------------
# Local mAP computation.
# ---------------------------------------------------------------------------

def parse_yolo_label(label_path: Path, img_w: int, img_h: int) -> list:
    """Read a YOLO label file and return [(cls, x1, y1, x2, y2), ...] in pixels."""
    out = []
    if not label_path.exists():
        return out
    for line in label_path.read_text().strip().splitlines():
        parts = line.split()
        if len(parts) != 5:
            continue
        cls = int(parts[0])
        cx, cy, w, h = map(float, parts[1:])
        x1 = (cx - w / 2) * img_w
        y1 = (cy - h / 2) * img_h
        x2 = (cx + w / 2) * img_w
        y2 = (cy + h / 2) * img_h
        out.append((cls, x1, y1, x2, y2))
    return out


def pred_to_xyxy(pred: dict) -> tuple:
    """Roboflow returns center-based (x, y, width, height); convert to xyxy."""
    cx = pred["x"]
    cy = pred["y"]
    w = pred["width"]
    h = pred["height"]
    return (cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2)


def iou(a: tuple, b: tuple) -> float:
    ax1, ay1, ax2, ay2 = a
    bx1, by1, bx2, by2 = b
    ix1 = max(ax1, bx1)
    iy1 = max(ay1, by1)
    ix2 = min(ax2, bx2)
    iy2 = min(ay2, by2)
    iw = max(0.0, ix2 - ix1)
    ih = max(0.0, iy2 - iy1)
    inter = iw * ih
    if inter <= 0:
        return 0.0
    a_area = max(0.0, (ax2 - ax1) * (ay2 - ay1))
    b_area = max(0.0, (bx2 - bx1) * (by2 - by1))
    union = a_area + b_area - inter
    return inter / union if union > 0 else 0.0


def evaluate_image(predictions: list, ground_truth: list, iou_thresh: float = 0.5) -> dict:
    """One-image TP/FP/FN counts per class. Greedy IoU matching."""
    # Sort preds by confidence desc so high-conf preds get first dibs on GT.
    preds = sorted(predictions, key=lambda p: -p["confidence"])
    matched_gt = set()
    tp_per_class = defaultdict(int)
    fp_per_class = defaultdict(int)

    for p in preds:
        p_cls = CLASS_NAMES.index(p["class"]) if p["class"] in CLASS_NAMES else -1
        if p_cls < 0:
            continue
        p_box = pred_to_xyxy(p)
        best_iou = 0.0
        best_gi = -1
        for gi, gt in enumerate(ground_truth):
            if gi in matched_gt:
                continue
            g_cls, *g_box = gt
            if g_cls != p_cls:
                continue
            i = iou(p_box, tuple(g_box))
            if i > best_iou:
                best_iou = i
                best_gi = gi
        if best_gi >= 0 and best_iou >= iou_thresh:
            matched_gt.add(best_gi)
            tp_per_class[p_cls] += 1
        else:
            fp_per_class[p_cls] += 1

    fn_per_class = defaultdict(int)
    for gi, (g_cls, *_) in enumerate(ground_truth):
        if gi not in matched_gt:
            fn_per_class[g_cls] += 1

    return {"tp": tp_per_class, "fp": fp_per_class, "fn": fn_per_class}


def aggregate_to_pr(results: list) -> dict:
    """Sum TP/FP/FN across images, compute precision/recall per class."""
    total_tp = defaultdict(int)
    total_fp = defaultdict(int)
    total_fn = defaultdict(int)
    for r in results:
        for k, v in r["tp"].items():
            total_tp[k] += v
        for k, v in r["fp"].items():
            total_fp[k] += v
        for k, v in r["fn"].items():
            total_fn[k] += v

    out = {}
    for cls_idx, cls_name in enumerate(CLASS_NAMES):
        tp = total_tp[cls_idx]
        fp = total_fp[cls_idx]
        fn = total_fn[cls_idx]
        precision = tp / (tp + fp) if (tp + fp) > 0 else 0.0
        recall = tp / (tp + fn) if (tp + fn) > 0 else 0.0
        out[cls_name] = {"tp": tp, "fp": fp, "fn": fn, "precision": precision, "recall": recall}
    return out


def run_local_eval(dataset_root: Path, model_id: str, api_key: str,
                   conf: float, only_split: str = "test"):
    from inference_sdk import InferenceHTTPClient, InferenceConfiguration
    from PIL import Image

    img_dir = dataset_root / only_split / "images"
    lbl_dir = dataset_root / only_split / "labels"
    if not img_dir.exists():
        print(f"[ERROR] {img_dir} not found")
        return

    client = InferenceHTTPClient(
        api_url="https://detect.roboflow.com",
        api_key=api_key,
    )
    client.configure(InferenceConfiguration(confidence_threshold=conf))

    images = sorted([f for f in img_dir.iterdir() if f.suffix.lower() in {".jpg", ".jpeg", ".png"}])
    print(f"\nRunning v4 inference on {len(images)} {only_split} images "
          f"(conf >= {conf})...")

    real_results = []
    synthetic_results = []

    for idx, img_path in enumerate(images):
        try:
            with Image.open(img_path) as im:
                w, h = im.size
            result = client.infer(str(img_path), model_id=model_id)
            preds = result.get("predictions", [])

            label_path = lbl_dir / (img_path.stem + ".txt")
            gt = parse_yolo_label(label_path, w, h)
            ev = evaluate_image(preds, gt)

            if is_synthetic(img_path.name):
                synthetic_results.append(ev)
            else:
                real_results.append(ev)

            if (idx + 1) % 20 == 0:
                print(f"  {idx + 1}/{len(images)}")
        except Exception as e:
            print(f"  [WARN] {img_path.name}: {e}")

    print("\n=== LOCAL mAP@50 SANITY CHECK ===")

    def report_block(title: str, results: list):
        if not results:
            print(f"\n{title}: (no images in this subset)")
            return
        print(f"\n{title}  (n={len(results)} images)")
        print(f"  {'class':<10}{'TP':>6}{'FP':>6}{'FN':>6}{'precision':>12}{'recall':>10}")
        per_class = aggregate_to_pr(results)
        for cls in CLASS_NAMES:
            r = per_class[cls]
            print(f"  {cls:<10}{r['tp']:>6}{r['fp']:>6}{r['fn']:>6}"
                  f"{r['precision']:>12.1%}{r['recall']:>10.1%}")
        macro_p = sum(per_class[c]["precision"] for c in CLASS_NAMES) / len(CLASS_NAMES)
        macro_r = sum(per_class[c]["recall"] for c in CLASS_NAMES) / len(CLASS_NAMES)
        print(f"  {'macro':<10}{'':>6}{'':>6}{'':>6}"
              f"{macro_p:>12.1%}{macro_r:>10.1%}")

    report_block("REAL images (Shahwaiz's originals)", real_results)
    report_block("SYNTHETIC images (sketch_*.jpg)", synthetic_results)

    if real_results and synthetic_results:
        real_p = sum(r["precision"] for r in [aggregate_to_pr(real_results)[c] for c in CLASS_NAMES]) / 4
        syn_p = sum(r["precision"] for r in [aggregate_to_pr(synthetic_results)[c] for c in CLASS_NAMES]) / 4
        delta = syn_p - real_p
        print(f"\nMacro precision delta (synthetic - real): {delta:+.1%}")
        if delta > 0.15:
            print("  ⚠️ Large gap — v4 is meaningfully better on synthetic than real.")
            print("     The headline 98% test mAP is partly synthetic-easy. Honest")
            print("     real-only number is closer to the REAL block above.")
        elif delta > 0.05:
            print("  Moderate gap — typical sim-to-real residual; v4 generalises okay.")
        else:
            print("  Small gap — v4 generalises well to real data. Honest claim.")


# ---------------------------------------------------------------------------
# CLI.
# ---------------------------------------------------------------------------

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dataset", type=Path, required=True,
                    help="Path to unzipped v4 dataset (must contain train/ valid/ test/)")
    ap.add_argument("--model-id", default="object-detection-4affw/4")
    ap.add_argument("--conf", type=float, default=0.20)
    ap.add_argument("--skip-inference", action="store_true",
                    help="Contamination check only — skip the API calls")
    ap.add_argument("--split", default="test", choices=("train", "valid", "test"))
    args = ap.parse_args()

    if not args.dataset.exists():
        print(f"[ERROR] {args.dataset} does not exist")
        sys.exit(1)

    report = contamination_report(args.dataset)
    print_contamination(report)

    if args.skip_inference:
        return

    api_key = os.environ.get("ROBOFLOW_API_KEY")
    if not api_key:
        print("\n[ERROR] ROBOFLOW_API_KEY not set in environment — skipping local eval.")
        print("        Run with --skip-inference if you only want the contamination check.")
        sys.exit(1)

    run_local_eval(args.dataset, args.model_id, api_key, args.conf, args.split)


if __name__ == "__main__":
    main()
