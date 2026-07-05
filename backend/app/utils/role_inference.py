"""
Deterministic prompt hints for detected elements.

The detector labels every content unit as `card`; deciding whether a card is a
button / input / image / heading used to be delegated entirely to Gemini via
prose heuristics in the prompt. Under load Gemini ignores those heuristics
(e.g. rendering wide-thin "Password" rows as <p> instead of <input>), so the
unambiguous cases are now classified HERE, in code, and stamped into each
element's attributes for the prompt to print as explicit per-element hints:

  attributes["role_hint"]        e.g. "input"
  attributes["role_hint_reason"] e.g. 'label "Password"'

Containers additionally get a horizontal-alignment hint for their children so
the generated layout mirrors what was drawn instead of falling back to
conventional patterns (logo-left/links-right):

  attributes["child_alignment"]  "left" | "center" | "right" | "space-between" | "stacked"

Only confident classifications are stamped; ambiguous cards get no hint and
remain Gemini's call. Both the canvas and upload paths run through this.
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional, Tuple

CONTAINER_TYPES = {"navbar", "footer", "section"}

# Normalized (lowercased, trailing-colon-stripped) label texts that identify a
# form field. Matched as whole phrases or as any single word of the label.
_INPUT_WORDS = {
    "password", "email", "e-mail", "address", "username", "phone", "mobile",
    "search", "city", "state", "zip", "zipcode", "country", "age", "dob",
}
_INPUT_PHRASES = {
    "name", "first name", "last name", "full name", "user name",
    "confirm password", "repeat password", "phone number", "email address",
    "date of birth", "postal code", "card number",
}

# Action-style labels that identify a button. Matched as whole phrases; short
# labels starting with one of the verbs also count ("Buy now", "Save draft").
_BUTTON_VERBS = {
    "submit", "confirm", "login", "log", "sign", "signup", "register", "buy",
    "send", "save", "cancel", "ok", "continue", "next", "back", "get",
    "learn", "subscribe", "download", "order", "checkout", "apply", "book",
    "join", "start", "try", "watch", "add", "shop", "explore", "browse",
}
_BUTTON_PHRASES = {
    "log in", "sign in", "sign up", "get started", "learn more", "learn now",
    "buy now", "add to cart", "watch video", "read more", "contact us",
    "try free", "free trial",
}

# Labels that MARK an image slot rather than being real copy. Mirrors the
# synthetic dataset's IMAGE_LABELS (synthetic_data/layouts.py) — an image card
# is drawn either as an X-crossed box or as a box holding one of these words.
_IMAGE_MARKERS = {
    "image", "img", "photo", "picture", "media", "x",
    "image placeholder", "img placeholder", "photo placeholder",
}


def _normalize(text: str) -> str:
    return text.strip().rstrip(":").strip().lower()


def _bounds(element: Any) -> Tuple[float, float, float, float]:
    b = element.bounds or {}
    return (
        float(b.get("x", 0.0)),
        float(b.get("y", 0.0)),
        float(b.get("width", 0.0)),
        float(b.get("height", 0.0)),
    )


def _center_inside(inner: Any, outer: Any) -> bool:
    ix, iy, iw, ih = _bounds(inner)
    ox, oy, ow, oh = _bounds(outer)
    cx, cy = ix + iw / 2.0, iy + ih / 2.0
    return ox <= cx <= ox + ow and oy <= cy <= oy + oh


def _classify_text(text: str) -> Optional[Tuple[str, str]]:
    """Classify a card purely from its label text. Returns (role, reason) or None."""
    normalized = _normalize(text)
    if not normalized:
        return None
    words = normalized.split()

    # Image-marker labels ("[ image ]", "img placeholder", "[ X ]") name an
    # image slot — render a placeholder image, never the literal text.
    if normalized.strip("[]()").strip() in _IMAGE_MARKERS:
        return "image placeholder", f'image-marker label "{text.strip()}"'

    # Field words beat action verbs: "Confirm password" is an input even though
    # "Confirm" alone would be a button.
    if (
        normalized in _INPUT_PHRASES
        or any(w in _INPUT_WORDS for w in words)
        or text.strip().endswith(":")
    ):
        return "input", f'field-style label "{text.strip()}"'

    if normalized in _BUTTON_PHRASES or (
        len(words) <= 3 and words[0] in _BUTTON_VERBS
    ):
        return "button", f'action-style label "{text.strip()}"'

    return None


def _classify_card(
    element: Any,
    parent: Optional[Any],
) -> Optional[Tuple[str, str, bool]]:
    """Returns (role, reason, firm) or None when the card is ambiguous.

    firm=True → the hint came from label text or container position and the
    prompt may present it as an override. firm=False → shape-only guess (no
    label was available backend-side); on the upload path the text baked into
    the image must be allowed to win over it, so the prompt presents it as a
    default, not a command.
    """
    attrs = element.attributes or {}
    text = attrs.get("label_text") or ""

    # Position in a bar container trumps everything: navbar/footer children are
    # navigation items regardless of shape.
    if parent is not None and (parent.type or "").lower() == "navbar":
        return "nav item (brand or link)", "positioned inside the navbar", True
    if parent is not None and (parent.type or "").lower() == "footer":
        return "footer item (link or copyright)", "positioned inside the footer", True

    by_text = _classify_text(text)
    if by_text:
        role, reason = by_text
        return role, reason, True

    _, _, w, h = _bounds(element)
    if w <= 0 or h <= 0:
        return None
    aspect = w / h

    # Wide, thin row with a short label → form field (the label is the
    # placeholder). Long sentences are headings/paragraphs, not fields.
    if text and len(_normalize(text).split()) <= 3 and aspect >= 4.0:
        return (
            "input",
            f'wide-thin row (aspect {aspect:.1f}) with label "{text.strip()}"',
            True,
        )

    if not text:
        if aspect >= 4.0:
            return "input", f"wide-thin row (aspect {aspect:.1f}), no label", False
        if 0.5 <= aspect <= 2.5:
            # Squarish block with no label — media placeholder if reasonably big
            # relative to its parent (avoid tagging small icons/avatars).
            if parent is not None:
                _, _, pw, ph = _bounds(parent)
                if pw > 0 and ph > 0 and (w * h) / (pw * ph) >= 0.15:
                    return "image placeholder", "large squarish box, no label", False

    return None


def _find_parent(card: Any, containers: List[Any]) -> Optional[Any]:
    """Smallest container whose bounds contain the card's center."""
    best = None
    best_area = float("inf")
    for container in containers:
        if not _center_inside(card, container):
            continue
        _, _, w, h = _bounds(container)
        area = w * h
        if 0 < area < best_area:
            best, best_area = container, area
    return best


def annotate_role_hints(elements: List[Any]) -> None:
    """Stamp role_hint / role_hint_reason onto unambiguous cards (in place)."""
    containers = [
        el for el in elements if (el.type or "").lower() in CONTAINER_TYPES
    ]
    for element in elements:
        if (element.type or "").lower() in CONTAINER_TYPES:
            continue
        parent = _find_parent(element, containers)
        classified = _classify_card(element, parent)
        if classified is None:
            continue
        role, reason, firm = classified
        if element.attributes is None:
            element.attributes = {}
        element.attributes["role_hint"] = role
        element.attributes["role_hint_reason"] = reason
        element.attributes["role_hint_firm"] = firm


def _children_of(container: Any, elements: List[Any], containers: List[Any]) -> List[Any]:
    return [
        el
        for el in elements
        if el is not container
        and (el.type or "").lower() not in CONTAINER_TYPES
        and _find_parent(el, containers) is container
    ]


Rect = Tuple[float, float, float, float]

# Nominal size for zero-sized items (canvas text annotations arrive as points).
_NOMINAL_TEXT_W = 80.0
_NOMINAL_TEXT_H = 20.0


def _item_rects(container: Any, children: List[Any]) -> List[Rect]:
    """Card children bounds + the container's own positioned text labels."""
    rects: List[Rect] = [_bounds(c) for c in children]
    attrs = container.attributes or {}
    for pt in attrs.get("positioned_texts") or []:
        try:
            x = float(pt.get("x", 0.0))
            y = float(pt.get("y", 0.0))
            w = float(pt.get("width", 0.0)) or _NOMINAL_TEXT_W
            h = float(pt.get("height", 0.0)) or _NOMINAL_TEXT_H
        except (TypeError, ValueError):
            continue
        rects.append((x, y, w, h))
    return rects


def _alignment_of(container: Any, rects: List[Rect]) -> Optional[str]:
    """Horizontal alignment of a container's items, from drawn positions."""
    rects = [(x, y, w, h) for x, y, w, h in rects if w > 0 and h > 0]
    if not rects:
        return None

    ox, _, ow, _ = _bounds(container)
    if ow <= 0:
        return None

    # Items stacked vertically (no y-overlap between any pair) have no
    # horizontal-row alignment story worth telling.
    if len(rects) >= 2:
        intervals = sorted((y, y + h) for _, y, _, h in rects)
        overlapping = any(
            intervals[i + 1][0] < intervals[i][1] for i in range(len(intervals) - 1)
        )
        if not overlapping:
            return "stacked"

    # Where does the item group sit inside the container's width?
    left_edge = min(x for x, _, _, _ in rects)
    right_edge = max(x + w for x, _, w, _ in rects)
    group_center = (left_edge + right_edge) / 2.0
    container_center = ox + ow / 2.0
    offset = (group_center - container_center) / ow  # -0.5 .. 0.5
    span = (right_edge - left_edge) / ow

    if span >= 0.8 and len(rects) >= 2:
        return "space-between"
    if offset <= -0.15:
        return "left"
    if offset >= 0.15:
        return "right"
    return "center"


def annotate_alignment(elements: List[Any]) -> None:
    """Stamp child_alignment onto containers with children (in place)."""
    containers = [
        el for el in elements if (el.type or "").lower() in CONTAINER_TYPES
    ]
    for container in containers:
        children = _children_of(container, elements, containers)
        alignment = _alignment_of(container, _item_rects(container, children))
        if alignment is None:
            continue
        if container.attributes is None:
            container.attributes = {}
        container.attributes["child_alignment"] = alignment
