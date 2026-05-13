from __future__ import annotations

import random
from dataclasses import dataclass
from typing import List, Tuple


CLASS_CARD = 0
CLASS_FOOTER = 1
CLASS_NAVBAR = 2
CLASS_SECTION = 3

CLASS_NAMES = ["card", "footer", "navbar", "section"]


@dataclass
class Element:
    cls: int
    x: float
    y: float
    w: float
    h: float
    label: str = ""


NAV_LABELS = [
    "Home  About  Contact", "Logo   Menu", "Brand   Home  Login",
    "Menu", "Logo    About  Services  Contact", "App   Profile",
    "Home  Docs  Pricing", "LOGO", "Search   Login   Signup",
]
FOOTER_LABELS = [
    "Copyright 2025  Privacy  Terms", "Contact us  |  FAQ",
    "Footer links", "All rights reserved",
    "Privacy  Terms  Cookies", "Made with love", "About  Help  Terms",
]
HEADING_LABELS = [
    "Welcome", "Dashboard", "Overview", "About us", "Our Services",
    "Products", "Contact", "Profile", "Settings", "Sign in", "Create account",
    "Pricing", "Features", "Get started",
]
PARAGRAPH_LABELS = [
    "Lorem ipsum dolor sit amet", "Some text here...", "Description content",
    "Short paragraph", "More info goes here", "Subtitle text",
    "Detail line of text", "Sample copy text",
]
BUTTON_LABELS = [
    "Submit", "Login", "Sign up", "Buy now", "Save", "Next",
    "Cancel", "OK", "Send", "Get started", "Continue", "Apply",
]
INPUT_LABELS = [
    "Email", "Password", "Name", "Search", "Username", "Phone",
    "Address", "City", "Message", "Confirm password",
]
IMAGE_LABELS = ["[ image ]", "img", "photo", "[ X ]", "img placeholder"]


def _card(x, y, w, h, role: str) -> Element:
    bucket = {
        "button": BUTTON_LABELS,
        "input": INPUT_LABELS,
        "heading": HEADING_LABELS,
        "paragraph": PARAGRAPH_LABELS,
        "image": IMAGE_LABELS,
    }
    label = random.choice(bucket[role]) if role in bucket else ""
    return Element(CLASS_CARD, x, y, w, h, label)


def _fill_section(sx, sy, sw, sh) -> List[Element]:
    cards: List[Element] = []
    pad = random.randint(10, 16)
    ix, iy = sx + pad, sy + pad
    iw, ih = sw - 2 * pad, sh - 2 * pad
    if iw < 50 or ih < 40:
        return cards

    template = random.choice(["form", "grid", "article", "hero", "mixed", "mixed"])

    if template == "form":
        cy = iy
        if random.random() < 0.7:
            h = random.randint(24, 42)
            cards.append(_card(ix, cy, iw * random.uniform(0.4, 0.85), h, "heading"))
            cy += h + random.randint(8, 16)
        for _ in range(random.randint(2, 5)):
            if cy + 36 > iy + ih:
                break
            h = random.randint(28, 42)
            w = iw * random.uniform(0.7, 1.0)
            cards.append(_card(ix, cy, w, h, "input"))
            cy += h + random.randint(6, 14)
        if cy + 36 <= iy + ih and random.random() < 0.9:
            h = random.randint(30, 42)
            w = iw * random.uniform(0.25, 0.5)
            cards.append(_card(ix, cy, w, h, "button"))

    elif template == "grid":
        cols = random.choice([2, 3, 3, 4])
        rows = random.randint(2, 4)
        gap = random.randint(8, 16)
        cw = (iw - gap * (cols - 1)) / cols
        ch = (ih - gap * (rows - 1)) / rows
        if cw < 30 or ch < 25:
            return cards
        for r in range(rows):
            for c in range(cols):
                role = random.choices(
                    ["image", "paragraph", "button"], weights=[5, 3, 1]
                )[0]
                cards.append(_card(
                    ix + c * (cw + gap),
                    iy + r * (ch + gap),
                    cw, ch, role,
                ))

    elif template == "article":
        cy = iy
        h = random.randint(28, 44)
        cards.append(_card(ix, cy, iw * random.uniform(0.6, 0.95), h, "heading"))
        cy += h + 12
        if cy + 80 <= iy + ih and random.random() < 0.6:
            ih_img = random.randint(70, min(160, max(80, ih // 3)))
            cards.append(_card(ix, cy, iw, ih_img, "image"))
            cy += ih_img + 14
        while cy + 24 <= iy + ih:
            ph = random.randint(18, 28)
            cards.append(_card(ix, cy, iw, ph, "paragraph"))
            cy += ph + random.randint(6, 12)

    elif template == "hero":
        big_h = min(ih * 0.55, 220)
        cards.append(_card(ix, iy, iw, big_h, "image"))
        cy = iy + big_h + 14
        if cy + 36 < iy + ih:
            h = random.randint(28, 44)
            cards.append(_card(ix, cy, iw * random.uniform(0.5, 0.9), h, "heading"))
            cy += h + 10
        if cy + 36 < iy + ih and random.random() < 0.85:
            h = random.randint(30, 42)
            w = iw * random.uniform(0.25, 0.45)
            cards.append(_card(ix, cy, w, h, "button"))

    else:
        cy = iy
        while cy + 24 < iy + ih:
            role = random.choices(
                ["heading", "paragraph", "input", "button", "image"],
                weights=[2, 4, 3, 2, 2],
            )[0]
            if role == "image":
                h = random.randint(50, min(120, max(60, ih // 3)))
                w = iw * random.uniform(0.5, 1.0)
            elif role == "button":
                h = random.randint(28, 40)
                w = iw * random.uniform(0.25, 0.5)
            elif role == "input":
                h = random.randint(28, 40)
                w = iw * random.uniform(0.6, 1.0)
            elif role == "heading":
                h = random.randint(24, 38)
                w = iw * random.uniform(0.5, 0.9)
            else:
                h = random.randint(18, 28)
                w = iw
            if cy + h > iy + ih:
                break
            cards.append(_card(ix, cy, w, h, role))
            cy += h + random.randint(8, 16)

    return cards


def make_layout(canvas_w: int, canvas_h: int) -> Tuple[List[Element], List[Element]]:
    margin = random.randint(12, 28)
    containers: List[Element] = []
    cards: List[Element] = []

    has_navbar = random.random() < 0.88
    has_footer = random.random() < 0.78

    nav_h = random.randint(40, 80) if has_navbar else 0
    foot_h = random.randint(35, 70) if has_footer else 0

    if has_navbar:
        containers.append(Element(
            CLASS_NAVBAR, margin, margin,
            canvas_w - 2 * margin, nav_h,
            label=random.choice(NAV_LABELS),
        ))
    if has_footer:
        containers.append(Element(
            CLASS_FOOTER, margin, canvas_h - margin - foot_h,
            canvas_w - 2 * margin, foot_h,
            label=random.choice(FOOTER_LABELS),
        ))

    section_top = margin + (nav_h + random.randint(8, 24) if has_navbar else 0)
    section_bot = canvas_h - margin - (
        foot_h + random.randint(8, 24) if has_footer else 0
    )
    section_w = canvas_w - 2 * margin
    if section_bot - section_top < 80:
        return containers, cards

    n_sections = random.choice([1, 1, 2, 2, 3])
    gap = random.randint(8, 18)
    avail = section_bot - section_top - gap * (n_sections - 1)
    weights = [random.uniform(0.6, 1.6) for _ in range(n_sections)]
    wsum = sum(weights)
    heights = [int(avail * w / wsum) for w in weights]

    cursor = section_top
    for h in heights:
        if h < 60:
            cursor += h + gap
            continue
        sec = Element(CLASS_SECTION, margin, cursor, section_w, h)
        containers.append(sec)
        cards.extend(_fill_section(sec.x, sec.y, sec.w, sec.h))
        cursor += h + gap

    return containers, cards
