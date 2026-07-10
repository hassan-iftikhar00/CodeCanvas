"""Tests for _previous_code_is_degenerate (main.py).

Incremental regeneration patches previousCode instead of regenerating; a
degenerate base (repair-destroyed stub, id-less pre-linker output) recycles
its damage forever. Faithful generations stamp every element with data-cc-id
(Decision #28), so distinct-id coverage is the trust signal.
"""

from main import _previous_code_is_degenerate


def code_with_ids(*ns: int) -> str:
    return "\n".join(f'<div data-cc-id="cc-{n}">x</div>' for n in ns)


def test_full_coverage_is_trusted():
    assert _previous_code_is_degenerate(code_with_ids(1, 2, 3, 4, 5), 5) is False


def test_stub_with_sparse_ids_is_degenerate():
    # Live case: repair stub carried 3 distinct ids for 9 elements.
    assert _previous_code_is_degenerate(code_with_ids(2, 6, 7), 9) is True


def test_idless_code_is_degenerate():
    assert _previous_code_is_degenerate("<div>Card</div>", 4) is True


def test_duplicate_ids_count_once():
    code = code_with_ids(1, 1, 1, 1)
    assert _previous_code_is_degenerate(code, 4) is True


def test_coverage_just_above_threshold_is_trusted():
    # 7 distinct ids for 10 elements = 0.7 >= 0.6.
    assert _previous_code_is_degenerate(code_with_ids(*range(1, 8)), 10) is False


def test_zero_elements_is_degenerate():
    assert _previous_code_is_degenerate(code_with_ids(1), 0) is True


def test_class_stub_with_full_id_coverage_is_degenerate():
    # Live case: repair damage glued id-less '<p>Card</p>' stubs on top of
    # otherwise fully-id'd code — coverage alone passed it.
    code = (
        code_with_ids(1, 2, 3, 4, 5, 6, 7)
        + '\n<div style="position:absolute"><p className="text-gray-700">Card</p></div>'
    )
    assert _previous_code_is_degenerate(code, 7) is True


def test_navbar_stub_is_degenerate():
    code = code_with_ids(1, 2) + "\n<span>Navbar</span>"
    assert _previous_code_is_degenerate(code, 2) is True


def test_class_word_inside_longer_text_is_fine():
    # "Card" as part of real copy is not a stub.
    code = code_with_ids(1, 2) + "\n<label>Credit Card Number</label>"
    assert _previous_code_is_degenerate(code, 2) is False


def test_class_word_in_attribute_is_fine():
    code = code_with_ids(1, 2) + '\n<input placeholder="Card number" />'
    assert _previous_code_is_degenerate(code, 2) is False
