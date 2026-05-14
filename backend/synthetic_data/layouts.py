"""Layout generation — produces (containers, cards) for a single sketch.

Style-aware: each card's render_mode (real_text / zigzag / image_placeholder /
empty) is chosen at layout time based on the style_type + card role. Type B
(dense_hand) gets zigzag-line cards for paragraphs and crossed-X for image
placeholders, matching the real Roboflow dataset.

Alignment grammar: per-section parameters (shared column width, shared input
width) preserve the UI structure signal that YOLO actually learns from.
"""
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
    angle: float = 0.0
    role: str = ""
    # How to draw this card. Containers always use "real_text".
    #   real_text         — outline + centered text label
    #   zigzag            — outline + horizontal zigzag lines (Type B paragraphs)
    #   image_placeholder — outline + X cross (Type B/C image cards)
    #   empty             — outline only
    render_mode: str = "real_text"
    annotate: bool = True
    order_idx: int = 0


NAV_LABELS = [
    "Home  About  Contact", "Logo   Menu", "Brand   Home  Login",
    "Menu", "Logo    About  Services  Contact", "App   Profile",
    "Home  Docs  Pricing", "LOGO", "Search   Login   Signup",
    "Home  Shop  Cart", "Dashboard  Settings",
]
FOOTER_LABELS = [
    "Copyright 2025  Privacy  Terms", "Contact us  |  FAQ",
    "Footer links", "All rights reserved",
    "Privacy  Terms  Cookies", "Made with love", "About  Help  Terms",
    "Sitemap  Privacy  Contact",
]
HEADING_LABELS = [
    "Welcome", "Dashboard", "Overview", "About us", "Our Services",
    "Products", "Contact", "Profile", "Settings", "Sign in", "Create account",
    "Pricing", "Features", "Get started", "Login", "Register", "Profile",
    "Notifications", "Activity", "Reports",
]
PARAGRAPH_LABELS = [
    "Lorem ipsum dolor sit amet", "Some text here", "Description content",
    "Short paragraph", "More info goes here", "Subtitle text",
    "Detail line of text", "Sample copy text",
]
BUTTON_LABELS = [
    "Submit", "Login", "Sign up", "Buy now", "Save", "Next",
    "Cancel", "OK", "Send", "Get started", "Continue", "Apply",
    "Confirm", "Delete", "Edit",
]
INPUT_LABELS = [
    "Email", "Password", "Name", "Search", "Username", "Phone",
    "Address", "City", "Message", "Confirm password", "First name",
    "Last name", "Country",
]
IMAGE_LABELS = ["[ image ]", "img", "photo", "[ X ]", "img placeholder"]


# ---------------------------------------------------------------------------
# Render-mode selection — the bridge between style_type and rendering.
# ---------------------------------------------------------------------------

def _pick_render_mode(role: str, style) -> str:
    st = style.style_type

    if role == "image":
        if st == "clean":
            return random.choices(
                ["image_placeholder", "real_text"], weights=[6, 2]
            )[0]
        if st == "dense_hand":
            return random.choices(
                ["image_placeholder", "real_text", "empty"], weights=[8, 1, 1]
            )[0]
        return random.choices(
            ["image_placeholder", "real_text", "empty"], weights=[6, 3, 1]
        )[0]

    if role == "paragraph":
        if st == "clean":
            return random.choices(
                ["real_text", "zigzag"], weights=[6, 1]
            )[0]
        if st == "dense_hand":
            return random.choices(
                ["zigzag", "real_text"], weights=[7, 3]
            )[0]
        return random.choices(
            ["zigzag", "real_text", "empty"], weights=[4, 4, 1]
        )[0]

    if role in ("button", "input", "heading"):
        if st == "dense_hand" and random.random() < 0.12:
            return "empty"
        if st == "sparse_sketch" and random.random() < 0.08:
            return "empty"
        return "real_text"

    return "real_text"


def _maybe_angle(max_deg: float, prob: float) -> float:
    return random.uniform(-max_deg, max_deg) if random.random() < prob else 0.0


def _card(x, y, w, h, role, style, *, order: int = 0) -> Element:
    label_bucket = {
        "button": BUTTON_LABELS,
        "input": INPUT_LABELS,
        "heading": HEADING_LABELS,
        "paragraph": PARAGRAPH_LABELS,
        "image": IMAGE_LABELS,
    }
    mode = _pick_render_mode(role, style)
    label = ""
    if mode == "real_text" and role in label_bucket:
        label = random.choice(label_bucket[role])
    angle_prob = 0.15 if style.style_type == "clean" else 0.30
    angle = _maybe_angle(2.0, angle_prob)
    return Element(
        cls=CLASS_CARD, x=x, y=y, w=w, h=h, label=label,
        role=role, render_mode=mode, angle=angle, order_idx=order,
    )


# ---------------------------------------------------------------------------
# Section content templates — each respects alignment grammar.
# ---------------------------------------------------------------------------

def _fill_form(ix, iy, iw, ih, style) -> List[Element]:
    cards: List[Element] = []
    cy = iy
    order = 0
    shared_input_w = iw * random.uniform(0.80, 1.0)

    if random.random() < 0.75:
        h = random.randint(24, 40)
        hw = shared_input_w * random.uniform(0.5, 0.9)
        cards.append(_card(ix, cy, hw, h, "heading", style, order=order))
        order += 1
        cy += h + random.randint(8, 14)

    n_inputs = random.randint(2, 5)
    for _ in range(n_inputs):
        if cy + 36 > iy + ih:
            break
        h = random.randint(28, 40)
        cards.append(_card(ix, cy, shared_input_w, h, "input", style, order=order))
        order += 1
        cy += h + random.randint(6, 12)

    if cy + 36 <= iy + ih and random.random() < 0.92:
        bh = random.randint(30, 42)
        bw = shared_input_w * random.uniform(0.30, 0.55)
        bx = ix + (shared_input_w - bw) / 2 if random.random() < 0.5 else ix
        cards.append(_card(bx, cy, bw, bh, "button", style, order=order))

    return cards


def _fill_grid(ix, iy, iw, ih, style) -> List[Element]:
    cards: List[Element] = []
    if style.style_type == "dense_hand":
        cols = random.choice([3, 3, 4, 4, 5])
        rows = random.randint(2, 4)
    elif style.style_type == "sparse_sketch":
        cols = random.choice([2, 2, 3])
        rows = random.randint(1, 3)
    else:
        cols = random.choice([2, 3, 3, 4])
        rows = random.randint(2, 3)

    gap = random.randint(6, 14)
    cw = (iw - gap * (cols - 1)) / cols
    ch = (ih - gap * (rows - 1)) / rows
    if cw < 28 or ch < 22:
        return cards

    role_weights = {
        "clean": [3, 4, 3],
        "dense_hand": [6, 3, 1],
        "sparse_sketch": [4, 3, 2],
    }[style.style_type]

    order = 0
    for r in range(rows):
        for c in range(cols):
            role = random.choices(
                ["image", "paragraph", "button"], weights=role_weights,
            )[0]
            cards.append(_card(
                ix + c * (cw + gap),
                iy + r * (ch + gap),
                cw, ch, role, style, order=order,
            ))
            order += 1
    return cards


def _fill_article(ix, iy, iw, ih, style) -> List[Element]:
    cards: List[Element] = []
    cy = iy
    order = 0

    h = random.randint(26, 42)
    cards.append(_card(ix, cy, iw * random.uniform(0.55, 0.95), h,
                       "heading", style, order=order))
    order += 1
    cy += h + 10

    if cy + 70 <= iy + ih and random.random() < 0.55:
        ih_img = random.randint(70, min(160, max(80, ih // 3)))
        cards.append(_card(ix, cy, iw, ih_img, "image", style, order=order))
        order += 1
        cy += ih_img + 12

    while cy + 22 <= iy + ih:
        ph = random.randint(18, 28)
        cards.append(_card(ix, cy, iw, ph, "paragraph", style, order=order))
        order += 1
        cy += ph + random.randint(4, 10)

    return cards


def _fill_hero(ix, iy, iw, ih, style) -> List[Element]:
    cards: List[Element] = []
    big_h = min(ih * 0.55, 220)
    cards.append(_card(ix, iy, iw, big_h, "image", style, order=0))
    cy = iy + big_h + 12
    order = 1
    if cy + 36 < iy + ih:
        h = random.randint(28, 42)
        cards.append(_card(ix, cy, iw * random.uniform(0.5, 0.9), h,
                           "heading", style, order=order))
        order += 1
        cy += h + 8
    if cy + 36 < iy + ih and random.random() < 0.85:
        bh = random.randint(30, 42)
        bw = iw * random.uniform(0.25, 0.45)
        cards.append(_card(ix + (iw - bw) / 2, cy, bw, bh,
                           "button", style, order=order))
    return cards


def _fill_mixed(ix, iy, iw, ih, style) -> List[Element]:
    cards: List[Element] = []
    cy = iy
    order = 0

    if style.style_type == "dense_hand":
        max_count = 14
    elif style.style_type == "sparse_sketch":
        max_count = 5
    else:
        max_count = 9

    while cy + 20 < iy + ih and order < max_count:
        role = random.choices(
            ["heading", "paragraph", "input", "button", "image"],
            weights=[2, 4, 2, 2, 2],
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
        cards.append(_card(ix, cy, w, h, role, style, order=order))
        order += 1
        cy += h + random.randint(6, 12)
    return cards


def _empty_section_chance(style) -> float:
    """Some sections in real data have very little content. Probability of
    leaving the section empty."""
    return {
        "clean": 0.06,
        "dense_hand": 0.02,
        "sparse_sketch": 0.18,
    }[style.style_type]


def _fill_section(sx, sy, sw, sh, style) -> List[Element]:
    cards: List[Element] = []
    pad = random.randint(8, 14)
    ix, iy = sx + pad, sy + pad
    iw, ih = sw - 2 * pad, sh - 2 * pad
    if iw < 50 or ih < 40:
        return cards

    if random.random() < _empty_section_chance(style):
        return cards

    template = random.choices(
        ["form", "grid", "article", "hero", "mixed"],
        weights=[5, 5, 3, 2, 4],
    )[0]

    if template == "form":
        return _fill_form(ix, iy, iw, ih, style)
    if template == "grid":
        return _fill_grid(ix, iy, iw, ih, style)
    if template == "article":
        return _fill_article(ix, iy, iw, ih, style)
    if template == "hero":
        return _fill_hero(ix, iy, iw, ih, style)
    return _fill_mixed(ix, iy, iw, ih, style)


# ---------------------------------------------------------------------------
# Top-level layout dispatchers.
# ---------------------------------------------------------------------------

def make_standard_layout(canvas_w, canvas_h, style) -> Tuple[List[Element], List[Element]]:
    margin = random.randint(10, 22)
    containers: List[Element] = []
    cards: List[Element] = []

    nav_p = {"clean": 0.55, "dense_hand": 0.65, "sparse_sketch": 0.40}[style.style_type]
    foot_p = {"clean": 0.40, "dense_hand": 0.50, "sparse_sketch": 0.25}[style.style_type]
    has_navbar = random.random() < nav_p
    has_footer = random.random() < foot_p

    nav_h = random.randint(40, 75) if has_navbar else 0
    foot_h = random.randint(32, 65) if has_footer else 0

    order = 0
    if has_navbar:
        containers.append(Element(
            cls=CLASS_NAVBAR, x=margin, y=margin,
            w=canvas_w - 2 * margin, h=nav_h,
            label=random.choice(NAV_LABELS),
            role="navbar", render_mode="real_text",
            angle=_maybe_angle(1.0, 0.18),
            order_idx=order,
        ))
        order += 1
    if has_footer:
        containers.append(Element(
            cls=CLASS_FOOTER, x=margin, y=canvas_h - margin - foot_h,
            w=canvas_w - 2 * margin, h=foot_h,
            label=random.choice(FOOTER_LABELS),
            role="footer", render_mode="real_text",
            angle=_maybe_angle(1.0, 0.18),
            order_idx=order,
        ))
        order += 1

    section_top = margin + (nav_h + random.randint(6, 18) if has_navbar else 0)
    section_bot = canvas_h - margin - (foot_h + random.randint(6, 18) if has_footer else 0)
    section_w = canvas_w - 2 * margin

    if section_bot - section_top < 70:
        return containers, cards

    if style.style_type == "dense_hand":
        n_sections = random.choices([1, 2, 3], weights=[2, 5, 4])[0]
    elif style.style_type == "sparse_sketch":
        n_sections = random.choices([1, 2], weights=[7, 3])[0]
    else:
        n_sections = random.choices([1, 2, 3], weights=[5, 4, 2])[0]

    gap = random.randint(6, 14)
    avail = section_bot - section_top - gap * (n_sections - 1)
    weights = [random.uniform(0.6, 1.6) for _ in range(n_sections)]
    wsum = sum(weights)
    heights = [int(avail * w / wsum) for w in weights]

    cursor = section_top
    for h in heights:
        if h < 50:
            cursor += h + gap
            continue
        sec = Element(
            cls=CLASS_SECTION, x=margin, y=cursor,
            w=section_w, h=h,
            role="section", render_mode="real_text",
            angle=_maybe_angle(0.8, 0.12),
            order_idx=order,
        )
        order += 1
        containers.append(sec)
        cards.extend(_fill_section(sec.x, sec.y, sec.w, sec.h, style))
        cursor += h + gap

    return containers, cards


def make_sidebar_layout(canvas_w, canvas_h, style) -> Tuple[List[Element], List[Element]]:
    margin = random.randint(10, 20)
    containers: List[Element] = []
    cards: List[Element] = []

    nav_p = {"clean": 0.50, "dense_hand": 0.65, "sparse_sketch": 0.35}[style.style_type]
    has_navbar = random.random() < nav_p
    nav_h = random.randint(40, 70) if has_navbar else 0

    if has_navbar:
        containers.append(Element(
            cls=CLASS_NAVBAR, x=margin, y=margin,
            w=canvas_w - 2 * margin, h=nav_h,
            label=random.choice(NAV_LABELS),
            role="navbar", render_mode="real_text",
            angle=_maybe_angle(0.8, 0.15),
        ))

    top = margin + (nav_h + random.randint(8, 18) if has_navbar else 0)
    bot = canvas_h - margin
    if bot - top < 100:
        return containers, cards

    side_left = random.random() < 0.7
    side_w = int(random.uniform(0.18, 0.28) * (canvas_w - 2 * margin))
    gap_x = random.randint(10, 18)
    if side_left:
        sx = margin
        mx = margin + side_w + gap_x
    else:
        mx = margin
        sx = canvas_w - margin - side_w
    main_w = canvas_w - 2 * margin - side_w - gap_x

    sidebar = Element(
        cls=CLASS_SECTION, x=sx, y=top, w=side_w, h=bot - top,
        role="section", angle=_maybe_angle(0.6, 0.12),
    )
    main = Element(
        cls=CLASS_SECTION, x=mx, y=top, w=main_w, h=bot - top,
        role="section", angle=_maybe_angle(0.6, 0.12),
    )
    containers.append(sidebar)
    containers.append(main)

    # Sidebar usually has stacked nav-style cards.
    pad = 6
    cy = sidebar.y + pad
    while cy + 28 < sidebar.y + sidebar.h - pad:
        h = random.randint(26, 38)
        w = sidebar.w - 2 * pad
        role = random.choices(["paragraph", "button"], weights=[3, 1])[0]
        cards.append(_card(sidebar.x + pad, cy, w, h, role, style))
        cy += h + random.randint(4, 10)

    cards.extend(_fill_section(main.x, main.y, main.w, main.h, style))
    return containers, cards


def _center(canvas_w, canvas_h, w, h):
    return (canvas_w - w) // 2, (canvas_h - h) // 2


def make_minimal_layout(canvas_w, canvas_h, style) -> Tuple[List[Element], List[Element]]:
    """Edge-case layouts: blank pages, single-element pages, etc. These break
    the "every image has 4 classes" prior that drives card hallucination."""
    kind = random.choices(
        ["blank", "single_button", "single_input", "login_form",
         "navbar_only", "footer_only", "section_only", "big_image",
         "buttons_row", "card_pair"],
        weights=[2, 4, 3, 6, 4, 2, 5, 3, 3, 3],
    )[0]

    containers: List[Element] = []
    cards: List[Element] = []
    margin = random.randint(12, 26)

    if kind == "blank":
        return containers, cards

    if kind == "single_button":
        w = random.randint(100, 180)
        h = random.randint(36, 50)
        x, y = _center(canvas_w, canvas_h, w, h)
        cards.append(_card(x, y, w, h, "button", style, order=0))
        return containers, cards

    if kind == "single_input":
        w = random.randint(200, 340)
        h = random.randint(34, 50)
        x, y = _center(canvas_w, canvas_h, w, h)
        cards.append(_card(x, y, w, h, "input", style, order=0))
        return containers, cards

    if kind == "login_form":
        form_w = int(canvas_w * random.uniform(0.55, 0.78))
        x_base = (canvas_w - form_w) // 2
        y = int(canvas_h * random.uniform(0.22, 0.32))
        h = random.randint(30, 40)
        cards.append(_card(x_base, y, form_w * random.uniform(0.5, 0.9), h,
                           "heading", style, order=0))
        y += h + 14
        order = 1
        for _ in range(random.randint(2, 3)):
            ih = random.randint(32, 42)
            cards.append(_card(x_base, y, form_w, ih, "input", style, order=order))
            order += 1
            y += ih + 12
        y += 4
        bw = int(form_w * random.uniform(0.4, 0.65))
        bh = random.randint(34, 44)
        cards.append(_card(x_base + (form_w - bw) // 2, y, bw, bh,
                           "button", style, order=order))
        return containers, cards

    if kind == "navbar_only":
        nav_h = random.randint(45, 75)
        containers.append(Element(
            cls=CLASS_NAVBAR, x=margin, y=margin,
            w=canvas_w - 2 * margin, h=nav_h,
            label=random.choice(NAV_LABELS),
            role="navbar", angle=_maybe_angle(1.0, 0.20),
        ))
        return containers, cards

    if kind == "footer_only":
        foot_h = random.randint(40, 70)
        containers.append(Element(
            cls=CLASS_FOOTER, x=margin, y=canvas_h - margin - foot_h,
            w=canvas_w - 2 * margin, h=foot_h,
            label=random.choice(FOOTER_LABELS),
            role="footer", angle=_maybe_angle(1.0, 0.20),
        ))
        return containers, cards

    if kind == "section_only":
        sec_h = int(canvas_h * random.uniform(0.4, 0.7))
        sec_y = (canvas_h - sec_h) // 2
        sec = Element(
            cls=CLASS_SECTION, x=margin, y=sec_y,
            w=canvas_w - 2 * margin, h=sec_h,
            role="section", angle=_maybe_angle(1.0, 0.18),
        )
        containers.append(sec)
        if random.random() < 0.55:
            cards.extend(_fill_section(sec.x, sec.y, sec.w, sec.h, style))
        return containers, cards

    if kind == "big_image":
        w = int(canvas_w * random.uniform(0.65, 0.92))
        h = int(canvas_h * random.uniform(0.45, 0.7))
        x, y = _center(canvas_w, canvas_h, w, h)
        cards.append(_card(x, y, w, h, "image", style, order=0))
        return containers, cards

    if kind == "buttons_row":
        n = random.randint(2, 4)
        gap = random.randint(14, 24)
        bw = random.randint(80, 130)
        bh = random.randint(34, 48)
        total = n * bw + (n - 1) * gap
        x0 = (canvas_w - total) // 2
        y = (canvas_h - bh) // 2
        for i in range(n):
            cards.append(_card(x0 + i * (bw + gap), y, bw, bh,
                               "button", style, order=i))
        return containers, cards

    if kind == "card_pair":
        w = int(canvas_w * 0.35)
        h = int(canvas_h * 0.40)
        gap = 30
        total = w * 2 + gap
        x0 = (canvas_w - total) // 2
        y = (canvas_h - h) // 2
        roles = random.sample(["image", "paragraph", "heading"], 2)
        cards.append(_card(x0, y, w, h, roles[0], style, order=0))
        cards.append(_card(x0 + w + gap, y, w, h, roles[1], style, order=1))
        return containers, cards

    return containers, cards


def make_layout(canvas_w: int, canvas_h: int, style) -> Tuple[List[Element], List[Element]]:
    """Top-level dispatcher. Style biases dispatch slightly: clean and
    sparse_sketch get more minimal layouts, dense_hand fewer."""
    if style.style_type == "clean":
        weights = (60, 15, 25)
    elif style.style_type == "dense_hand":
        weights = (75, 15, 10)
    else:
        weights = (50, 12, 38)

    kind = random.choices(
        ["standard", "sidebar", "minimal"], weights=weights,
    )[0]

    if kind == "standard":
        return make_standard_layout(canvas_w, canvas_h, style)
    if kind == "sidebar":
        return make_sidebar_layout(canvas_w, canvas_h, style)
    return make_minimal_layout(canvas_w, canvas_h, style)
