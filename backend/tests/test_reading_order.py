"""Tests for sort_reading_order (inference.py).

A plain y-sort leaves same-row boxes in arbitrary order because hand-drawn
rows are never pixel-aligned; Gemini follows the prompt's list order when
composing grids, so two cells in one row could render swapped. These tests
pin the reading-order contract: top-to-bottom, left-to-right within a row,
containers untouched.
"""

from dataclasses import dataclass, field
from typing import Dict

from app.models.inference import _cards_share_row, sort_reading_order


@dataclass
class El:
    type: str
    bounds: Dict[str, float]
    attributes: Dict = field(default_factory=dict)


def card(x, y, w=100, h=50):
    return El("card", {"x": x, "y": y, "width": w, "height": h})


def ids(elements):
    return [(e.type, e.bounds["x"], e.bounds["y"]) for e in elements]


class TestCardsShareRow:
    def test_same_row_with_jitter(self):
        a = card(0, 100)
        b = card(200, 108)  # 8px jitter, 50px tall → 84% overlap
        assert _cards_share_row(a, b)

    def test_different_rows(self):
        a = card(0, 100, h=50)
        b = card(0, 200, h=50)
        assert not _cards_share_row(a, b)

    def test_marginal_overlap_below_half_is_not_a_row(self):
        a = card(0, 100, h=50)
        b = card(200, 140, h=50)  # 10px overlap / 50 = 20%
        assert not _cards_share_row(a, b)

    def test_zero_height_never_shares_row(self):
        a = card(0, 100, h=0)
        b = card(200, 100, h=50)
        assert not _cards_share_row(a, b)


class TestSortReadingOrder:
    def test_same_row_sorted_by_x_despite_y_jitter(self):
        # Right cell drawn 6px higher: plain y-sort would list it first.
        left = card(50, 106)
        right = card(400, 100)
        elements = [right, left]
        sort_reading_order(elements)
        assert elements == [left, right]

    def test_rows_stay_top_to_bottom(self):
        top = card(0, 100)
        bottom = card(0, 300)
        elements = [bottom, top]
        sort_reading_order(elements)
        assert elements == [top, bottom]

    def test_grid_two_rows_each_left_to_right(self):
        a1, a2, a3 = card(0, 100), card(150, 104), card(300, 98)
        b1, b2 = card(0, 200), card(150, 196)
        elements = [a3, b2, a1, b1, a2]
        sort_reading_order(elements)
        assert elements == [a1, a2, a3, b1, b2]

    def test_container_stays_before_its_children(self):
        # Section y-overlaps its own children; it must not be x-sorted into
        # the row and must stay listed first (smaller y).
        section = El("section", {"x": 0, "y": 90, "width": 600, "height": 300})
        c1, c2 = card(50, 120), card(300, 118)
        elements = [c2, section, c1]
        sort_reading_order(elements)
        assert elements == [section, c1, c2]

    def test_containers_keep_pure_y_order(self):
        navbar = El("navbar", {"x": 0, "y": 0, "width": 600, "height": 60})
        footer = El("footer", {"x": 0, "y": 500, "width": 600, "height": 60})
        elements = [footer, navbar]
        sort_reading_order(elements)
        assert elements == [navbar, footer]

    def test_single_card_row_untouched(self):
        a = card(0, 100)
        b = card(0, 300)
        elements = [a, b]
        sort_reading_order(elements)
        assert elements == [a, b]

    def test_missing_bounds_treated_as_origin(self):
        bare = El("card", {})
        other = card(100, 50)
        elements = [other, bare]
        sort_reading_order(elements)  # must not raise
        assert len(elements) == 2

    def test_empty_list(self):
        elements = []
        sort_reading_order(elements)
        assert elements == []
