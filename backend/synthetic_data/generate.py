"""Synthetic UI sketch dataset generator — v3 (style-typed, data-anchored).

Usage:
    python -m backend.synthetic_data.generate --count 2500 --out dataset

Output (YOLO format, ready for Roboflow upload as a single train shard):
    dataset/
        train/images/*.jpg
        train/labels/*.txt
        data.yaml
        _stats.json

Class IDs match Shahwaiz's existing model (verified):
    0=card, 1=footer, 2=navbar, 3=section

Synthetic = train only. Use Shahwaiz's existing 17 valid + 18 test (real
images) for evaluation. Mixing real validation with synthetic train is the
industry-standard sim-to-real protocol and is the only way to get an honest
mAP signal at train time.
"""
from __future__ import annotations

import argparse
import json
import random
import time
from collections import Counter
from pathlib import Path

from PIL import Image, ImageDraw, ImageEnhance, ImageFilter

from .layouts import (CLASS_NAMES, Element, make_layout)
from .rough import (aabb_of_rotated_rect, clip_bbox_to_canvas,
                    placeholder_image_mark, rough_rect, rough_text,
                    zigzag_text_lines, measure_text)
from .style import SketchStyle, load_font, random_style
from .validate import jitter_bbox, salience_miss, yolo_line


# Canvas presets — square-ish, Roboflow-stretch-friendly. Tight band around
# the 640×640 model input so geometry survives the resize.
CANVAS_PRESETS = [
    (600, 720),
    (640, 720),
    (640, 640),
    (680, 720),
    (720, 720),
    (560, 720),
    (640, 800),
    (560, 760),
]


# ---------------------------------------------------------------------------
# Rendering.
# ---------------------------------------------------------------------------

def _render_text_centered(draw: ImageDraw.ImageDraw, el: Element,
                          style: SketchStyle):
    if not el.label:
        return
    max_size = max(10, min(int(el.h * 0.50), 28))
    for size in range(max_size, 7, -2):
        tw, th = measure_text(el.label, size, digital=style.digital)
        if tw <= el.w * 0.90 and th <= el.h * 0.85:
            cx = el.x + el.w / 2 - tw / 2
            cy = el.y + el.h / 2 - th / 2
            rough_text(draw, cx, cy, el.label, size, style.pen_color,
                       digital=style.digital, jitter=0.6)
            return


def _render_container(draw: ImageDraw.ImageDraw, el: Element, style: SketchStyle):
    rough_rect(draw, el.x, el.y, el.w, el.h, style, angle=el.angle)
    if el.label:
        _render_text_centered(draw, el, style)


def _render_card(draw: ImageDraw.ImageDraw, el: Element, style: SketchStyle):
    rough_rect(draw, el.x, el.y, el.w, el.h, style, angle=el.angle)
    mode = el.render_mode
    if mode == "image_placeholder":
        placeholder_image_mark(draw, el.x, el.y, el.w, el.h, style)
    elif mode == "zigzag":
        zigzag_text_lines(draw, el.x, el.y, el.w, el.h, style)
    elif mode == "real_text" and el.label:
        _render_text_centered(draw, el, style)
    # "empty" → outline only.


def _apply_image_noise(img: Image.Image, style: SketchStyle) -> Image.Image:
    """Brightness / contrast / blur / JPEG quality variation. Hand-drawn images
    get more aggressive noise; digital (Type A / Konva inference target) gets
    only mild noise."""
    if style.digital:
        if random.random() < 0.15:
            img = ImageEnhance.Brightness(img).enhance(random.uniform(0.92, 1.08))
        if random.random() < 0.10:
            img = ImageEnhance.Contrast(img).enhance(random.uniform(0.92, 1.08))
        return img

    if random.random() < 0.35:
        img = ImageEnhance.Brightness(img).enhance(random.uniform(0.78, 1.18))
    if random.random() < 0.25:
        img = ImageEnhance.Contrast(img).enhance(random.uniform(0.85, 1.18))
    if random.random() < 0.18:
        img = img.filter(ImageFilter.GaussianBlur(radius=random.uniform(0.4, 1.0)))
    return img


def _draw_paper_texture(img: Image.Image, style: SketchStyle):
    if style.digital or not (style.ruled or style.grid):
        return
    draw = ImageDraw.Draw(img)
    w, h = img.size
    faint = tuple(min(255, c + 100) for c in style.pen_color)
    if style.ruled:
        spacing = random.randint(24, 36)
        for y in range(spacing, h, spacing):
            draw.line([(0, y), (w, y)], fill=faint, width=1)
    if style.grid:
        spacing = random.randint(20, 32)
        for x in range(spacing, w, spacing):
            draw.line([(x, 0), (x, h)], fill=faint, width=1)
        for y in range(spacing, h, spacing):
            draw.line([(0, y), (w, y)], fill=faint, width=1)


def render_sketch(canvas_w: int, canvas_h: int):
    style = random_style(canvas_w=canvas_w, canvas_h=canvas_h)
    img = Image.new("RGB", (canvas_w, canvas_h), style.paper_color)
    _draw_paper_texture(img, style)
    draw = ImageDraw.Draw(img)

    containers, cards = make_layout(canvas_w, canvas_h, style)

    for el in containers:
        _render_container(draw, el, style)
    for el in cards:
        _render_card(draw, el, style)

    img = _apply_image_noise(img, style)
    return img, containers + cards, style


# ---------------------------------------------------------------------------
# Writing.
# ---------------------------------------------------------------------------

def _write_example(out_dir: Path, name: str, img: Image.Image,
                   elements: list, canvas_w: int, canvas_h: int,
                   stats: Counter):
    img_path = out_dir / "images" / f"{name}.jpg"
    label_path = out_dir / "labels" / f"{name}.txt"
    img.save(img_path, "JPEG", quality=random.randint(85, 95))

    lines: list[str] = []
    for el in elements:
        if not el.annotate:
            continue

        ax, ay, aw, ah = aabb_of_rotated_rect(el.x, el.y, el.w, el.h, el.angle)
        clipped = clip_bbox_to_canvas(ax, ay, aw, ah, canvas_w, canvas_h)
        if clipped is None:
            stats["bbox_clip_drop"] += 1
            continue
        ax, ay, aw, ah = clipped

        area_norm = (aw * ah) / (canvas_w * canvas_h)
        if salience_miss(area_norm):
            stats["annotation_miss"] += 1
            continue

        ax, ay, aw, ah = jitter_bbox(ax, ay, aw, ah)
        clipped = clip_bbox_to_canvas(ax, ay, aw, ah, canvas_w, canvas_h)
        if clipped is None:
            stats["bbox_post_jitter_drop"] += 1
            continue
        ax, ay, aw, ah = clipped

        line = yolo_line(el.cls, ax, ay, aw, ah, canvas_w, canvas_h)
        if line is None:
            stats["bbox_invalid"] += 1
            continue
        lines.append(line)
        stats[f"class:{CLASS_NAMES[el.cls]}"] += 1

    label_path.write_text("\n".join(lines), encoding="utf-8")


def _write_data_yaml(root: Path):
    yaml = (
        "path: .\n"
        "train: train/images\n"
        "val: train/images   # placeholder — replace with Shahwaiz's real valid in Roboflow\n"
        "test: train/images  # placeholder — replace with Shahwaiz's real test in Roboflow\n"
        "\n"
        f"nc: {len(CLASS_NAMES)}\n"
        f"names: {CLASS_NAMES}\n"
    )
    (root / "data.yaml").write_text(yaml, encoding="utf-8")


# ---------------------------------------------------------------------------
# CLI.
# ---------------------------------------------------------------------------

def main():
    ap = argparse.ArgumentParser(description="Synthetic UI sketch dataset (v3)")
    ap.add_argument("--count", type=int, default=2500)
    ap.add_argument("--out", type=Path, default=Path("synthetic_dataset"))
    ap.add_argument("--seed", type=int, default=None)
    args = ap.parse_args()

    if args.seed is not None:
        random.seed(args.seed)

    root: Path = args.out
    (root / "train" / "images").mkdir(parents=True, exist_ok=True)
    (root / "train" / "labels").mkdir(parents=True, exist_ok=True)

    digits = max(5, len(str(args.count)))
    stats: Counter = Counter()
    started = time.time()

    for i in range(args.count):
        canvas_w, canvas_h = random.choice(CANVAS_PRESETS)
        img, elements, style = render_sketch(canvas_w, canvas_h)
        name = f"sketch_{i:0{digits}d}"
        _write_example(root / "train", name, img, elements,
                       canvas_w, canvas_h, stats)
        stats[f"style_type:{style.style_type}"] += 1
        stats["images"] += 1
        if style.pristine:
            stats["pristine"] += 1
        if (i + 1) % 100 == 0:
            elapsed = time.time() - started
            rate = (i + 1) / elapsed
            eta = (args.count - i - 1) / rate
            print(f"  {i+1:>6}/{args.count}  "
                  f"({rate:.1f} img/s, ETA {eta/60:.1f} min)")

    _write_data_yaml(root)
    (root / "_stats.json").write_text(
        json.dumps(dict(stats), indent=2), encoding="utf-8"
    )
    print(f"\nDone. {args.count} images at {root.resolve()}")
    print(f"Total time: {(time.time()-started)/60:.1f} min")
    print(f"\nStats:")
    for k in sorted(stats.keys()):
        print(f"  {k:>32}: {stats[k]}")


if __name__ == "__main__":
    main()
