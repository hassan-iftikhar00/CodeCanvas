"""Sanity-check synthetic dataset by overlaying YOLO labels on a sample.

Usage:
    python -m backend.synthetic_data.verify --dataset dataset --count 12
"""
from __future__ import annotations

import argparse
import random
from pathlib import Path

from PIL import Image, ImageDraw

from .style import load_font


CLASS_COLORS = {
    0: (220, 30, 30),
    1: (30, 110, 220),
    2: (40, 170, 60),
    3: (180, 80, 220),
}
CLASS_NAMES = {0: "card", 1: "footer", 2: "navbar", 3: "section"}


def overlay(img_path: Path, label_path: Path, out_path: Path):
    img = Image.open(img_path).convert("RGB")
    w, h = img.size
    draw = ImageDraw.Draw(img)
    font = load_font(14)
    for line in label_path.read_text().splitlines():
        parts = line.split()
        if len(parts) != 5:
            continue
        cls = int(parts[0])
        cx, cy, nw, nh = map(float, parts[1:])
        x1 = (cx - nw / 2) * w
        y1 = (cy - nh / 2) * h
        x2 = (cx + nw / 2) * w
        y2 = (cy + nh / 2) * h
        color = CLASS_COLORS.get(cls, (255, 200, 0))
        draw.rectangle([x1, y1, x2, y2], outline=color, width=2)
        draw.text((x1 + 4, max(0, y1 - 16)), CLASS_NAMES.get(cls, str(cls)),
                  fill=color, font=font)
    img.save(out_path, "JPEG", quality=88)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dataset", type=Path, required=True)
    ap.add_argument("--count", type=int, default=10)
    ap.add_argument("--out", type=Path, default=Path("verify"))
    ap.add_argument("--split", default="train", choices=["train", "valid", "test"])
    args = ap.parse_args()

    args.out.mkdir(parents=True, exist_ok=True)
    images_dir = args.dataset / args.split / "images"
    labels_dir = args.dataset / args.split / "labels"
    images = list(images_dir.glob("*.jpg"))
    if not images:
        print(f"No images found in {images_dir}")
        return

    sample = random.sample(images, min(args.count, len(images)))
    for img_path in sample:
        label_path = labels_dir / (img_path.stem + ".txt")
        if not label_path.exists():
            continue
        out_path = args.out / img_path.name
        overlay(img_path, label_path, out_path)
        print(f"  {out_path}")


if __name__ == "__main__":
    main()
