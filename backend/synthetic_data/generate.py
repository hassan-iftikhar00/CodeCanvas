"""Synthetic hand-drawn UI wireframe sketch generator (YOLO format).

Usage:
    python -m backend.synthetic_data.generate --count 2000 --out dataset

Output layout (YOLO / Roboflow compatible):
    dataset/
        train/images/*.jpg + train/labels/*.txt
        valid/images/*.jpg + valid/labels/*.txt
        test/images/*.jpg  + test/labels/*.txt
        data.yaml

Class ID order (alphabetical, Roboflow default):
    0 = card, 1 = footer, 2 = navbar, 3 = section

If Shahwaiz's existing model uses a different order, edit CLASS_* in layouts.py
and the names list in write_data_yaml below.
"""
from __future__ import annotations

import argparse
import random
import time
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

from .layouts import CLASS_NAMES, Element, make_layout
from .rough import rough_rect, rough_text
from .style import SketchStyle, load_font, random_style


CANVAS_PRESETS = [
    (600, 720),
    (640, 800),
    (560, 760),
    (680, 820),
    (720, 720),
    (640, 640),
    (800, 600),
    (520, 780),
]


def _draw_paper_texture(img: Image.Image, style: SketchStyle):
    if not (style.ruled or style.grid):
        return
    draw = ImageDraw.Draw(img)
    w, h = img.size
    faint = tuple(min(255, c + 90) for c in style.pen_color)
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


def _render_label(draw: ImageDraw.ImageDraw, el: Element, style: SketchStyle):
    if not el.label:
        return
    max_size = max(10, min(int(el.h * 0.45), 26))
    for size in range(max_size, 7, -2):
        font = load_font(size)
        bbox = draw.textbbox((0, 0), el.label, font=font)
        tw = bbox[2] - bbox[0]
        th = bbox[3] - bbox[1]
        if tw <= el.w * 0.9 and th <= el.h * 0.85:
            cx = el.x + el.w / 2 - tw / 2
            cy = el.y + el.h / 2 - th / 2
            rough_text(draw, cx, cy, el.label, size, style.pen_color, jitter=0.7)
            return


def render_sketch(canvas_w: int, canvas_h: int):
    style = random_style()
    img = Image.new("RGB", (canvas_w, canvas_h), style.paper_color)
    _draw_paper_texture(img, style)
    draw = ImageDraw.Draw(img)

    containers, cards = make_layout(canvas_w, canvas_h)

    for el in containers:
        rough_rect(draw, el.x, el.y, el.w, el.h, style)
        _render_label(draw, el, style)
    for el in cards:
        rough_rect(draw, el.x, el.y, el.w, el.h, style)
        _render_label(draw, el, style)

    if random.random() < 0.2:
        img = img.filter(ImageFilter.GaussianBlur(radius=random.uniform(0.3, 0.7)))

    return img, containers + cards


def write_example(out_dir: Path, name: str, img: Image.Image,
                  elements: list[Element]):
    img_path = out_dir / "images" / f"{name}.jpg"
    label_path = out_dir / "labels" / f"{name}.txt"
    img.save(img_path, "JPEG", quality=random.randint(82, 94))
    w, h = img.size
    lines = []
    for el in elements:
        cx = (el.x + el.w / 2) / w
        cy = (el.y + el.h / 2) / h
        nw = el.w / w
        nh = el.h / h
        if not (0 < cx < 1 and 0 < cy < 1 and nw > 0.005 and nh > 0.005):
            continue
        lines.append(f"{el.cls} {cx:.6f} {cy:.6f} {nw:.6f} {nh:.6f}")
    label_path.write_text("\n".join(lines), encoding="utf-8")


def split_bucket(idx: int, total: int) -> str:
    r = idx / total
    if r < 0.80:
        return "train"
    if r < 0.90:
        return "valid"
    return "test"


def write_data_yaml(root: Path):
    yaml = (
        "path: .\n"
        "train: train/images\n"
        "val: valid/images\n"
        "test: test/images\n"
        "\n"
        f"nc: {len(CLASS_NAMES)}\n"
        f"names: {CLASS_NAMES}\n"
    )
    (root / "data.yaml").write_text(yaml, encoding="utf-8")


def main():
    ap = argparse.ArgumentParser(description="Synthetic UI sketch dataset generator")
    ap.add_argument("--count", type=int, default=2000)
    ap.add_argument("--out", type=Path, default=Path("synthetic_dataset"))
    ap.add_argument("--seed", type=int, default=None)
    args = ap.parse_args()

    if args.seed is not None:
        random.seed(args.seed)

    root: Path = args.out
    for split in ("train", "valid", "test"):
        (root / split / "images").mkdir(parents=True, exist_ok=True)
        (root / split / "labels").mkdir(parents=True, exist_ok=True)

    digits = max(5, len(str(args.count)))
    started = time.time()
    for i in range(args.count):
        canvas_w, canvas_h = random.choice(CANVAS_PRESETS)
        img, elements = render_sketch(canvas_w, canvas_h)
        split = split_bucket(i, args.count)
        name = f"sketch_{i:0{digits}d}"
        write_example(root / split, name, img, elements)
        if (i + 1) % 100 == 0:
            elapsed = time.time() - started
            rate = (i + 1) / elapsed
            eta = (args.count - i - 1) / rate
            print(f"  {i+1:>6}/{args.count}  "
                  f"({rate:.1f} img/s, ETA {eta/60:.1f} min)")

    write_data_yaml(root)
    print(f"\nDone. {args.count} images written to {root.resolve()}")
    print(f"Total time: {(time.time()-started)/60:.1f} min")


if __name__ == "__main__":
    main()
