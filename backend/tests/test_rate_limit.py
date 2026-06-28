"""First backend test suite (B11): the AI-endpoint rate limiter.

Covers the SlidingWindowRateLimiter contract that /api/predict relies on
(Decision #23). Timing is made deterministic by swapping the module's `time`
reference for a fake clock, so the suite is fast and never flaky. One test uses
real threads to prove the lock actually serializes concurrent callers.
"""

import threading

import pytest

from app.utils import rate_limit
from app.utils.rate_limit import SlidingWindowRateLimiter


class FakeClock:
    """Controllable stand-in for the `time` module the limiter imports.

    The limiter only ever calls `time.monotonic()`, so that is all we model.
    Tests advance time explicitly instead of sleeping.
    """

    def __init__(self, start: float = 1000.0) -> None:
        self._now = start

    def monotonic(self) -> float:
        return self._now

    def advance(self, seconds: float) -> None:
        self._now += seconds


@pytest.fixture
def clock(monkeypatch):
    """Replace the limiter's time source with a fake, controllable clock."""
    fake = FakeClock()
    monkeypatch.setattr(rate_limit, "time", fake)
    return fake


# --- construction / config validation -------------------------------------

@pytest.mark.parametrize(
    "max_requests, window_seconds",
    [(0, 1.0), (-1, 1.0), (1, 0.0), (1, -1.0)],
)
def test_invalid_config_raises(max_requests, window_seconds):
    with pytest.raises(ValueError):
        SlidingWindowRateLimiter(max_requests, window_seconds)


def test_valid_config_coerces_types():
    rl = SlidingWindowRateLimiter(max_requests=5, window_seconds=30)
    assert rl.max_requests == 5
    assert isinstance(rl.max_requests, int)
    assert rl.window_seconds == 30.0
    assert isinstance(rl.window_seconds, float)


# --- core allow / block behaviour -----------------------------------------

def test_allows_up_to_limit_then_blocks(clock):
    rl = SlidingWindowRateLimiter(max_requests=3, window_seconds=60.0)

    for i in range(3):
        allowed, retry_after, remaining = rl.check("user-a")
        assert allowed is True
        assert retry_after == 0.0
        assert remaining == 2 - i  # 2, 1, 0 slots left after each call

    allowed, retry_after, remaining = rl.check("user-a")
    assert allowed is False
    assert remaining == 0
    assert retry_after > 0.0


def test_retry_after_never_exceeds_window(clock):
    rl = SlidingWindowRateLimiter(max_requests=1, window_seconds=60.0)
    rl.check("user-a")  # consume the only slot

    _, retry_after, _ = rl.check("user-a")
    assert 0.0 < retry_after <= 60.0


def test_retry_after_counts_down_as_time_passes(clock):
    rl = SlidingWindowRateLimiter(max_requests=1, window_seconds=60.0)
    rl.check("user-a")  # hit recorded at t=0

    clock.advance(20.0)
    _, retry_after, _ = rl.check("user-a")
    # Oldest hit was 20s ago, so ~40s remain until it ages out.
    assert retry_after == pytest.approx(40.0, abs=1e-6)


# --- per-key isolation -----------------------------------------------------

def test_keys_have_independent_budgets(clock):
    rl = SlidingWindowRateLimiter(max_requests=1, window_seconds=60.0)

    assert rl.check("user-a")[0] is True
    assert rl.check("user-a")[0] is False  # user-a exhausted
    assert rl.check("user-b")[0] is True   # user-b unaffected


# --- window sliding --------------------------------------------------------

def test_slot_frees_after_window_passes(clock):
    rl = SlidingWindowRateLimiter(max_requests=2, window_seconds=10.0)

    assert rl.check("k")[0] is True   # t=0
    assert rl.check("k")[0] is True   # t=0
    assert rl.check("k")[0] is False  # full

    clock.advance(10.001)  # both hits age out
    assert rl.check("k")[0] is True


def test_window_is_rolling_not_fixed(clock):
    """Hits expire individually as they age out, not all at once on a boundary."""
    rl = SlidingWindowRateLimiter(max_requests=2, window_seconds=10.0)

    rl.check("k")          # hit at t=0
    clock.advance(5.0)
    rl.check("k")          # hit at t=5
    assert rl.check("k")[0] is False  # both still inside the 10s window

    clock.advance(5.5)     # now t=10.5: the t=0 hit aged out, the t=5 one has not
    allowed, _, remaining = rl.check("k")
    assert allowed is True
    assert remaining == 0  # this call refilled the freed slot, leaving none


# --- blocked attempts must not extend the window --------------------------

def test_blocked_attempts_are_not_recorded(clock):
    """A caller that keeps hammering while blocked must not push its own retry
    window further out. Only successful hits count toward the window."""
    rl = SlidingWindowRateLimiter(max_requests=1, window_seconds=10.0)

    assert rl.check("k")[0] is True   # hit at t=0

    clock.advance(5.0)
    assert rl.check("k")[0] is False  # blocked at t=5; must NOT be recorded

    clock.advance(5.001)  # t=10.001: only the t=0 hit existed, and it aged out
    # If the t=5 blocked attempt had been recorded, this would still be blocked.
    assert rl.check("k")[0] is True


# --- housekeeping: stale keys are swept ------------------------------------

def test_stale_keys_are_swept_to_bound_memory(clock):
    """Fully-expired keys are dropped so the internal map cannot grow forever."""
    rl = SlidingWindowRateLimiter(max_requests=1, window_seconds=10.0)

    rl.check("old-user")
    assert "old-user" in rl._hits

    # Move past the window so old-user is stale, then trigger a sweep (the sweep
    # runs at most once per window) via activity on a different key.
    clock.advance(11.0)
    rl.check("new-user")

    assert "old-user" not in rl._hits
    assert "new-user" in rl._hits


# --- concurrency: the lock must serialize callers -------------------------

def test_concurrent_callers_never_exceed_limit():
    """Many threads hammering one key must yield exactly max_requests allows.

    Uses the real clock with a long window so nothing ages out mid-test; the
    only thing under test is that the threading.Lock prevents a race from
    admitting more than the limit.
    """
    limit = 50
    rl = SlidingWindowRateLimiter(max_requests=limit, window_seconds=3600.0)

    allowed_count = 0
    count_lock = threading.Lock()
    start = threading.Event()

    def worker():
        start.wait()  # release all threads at once to maximize contention
        nonlocal allowed_count
        if rl.check("shared")[0]:
            with count_lock:
                allowed_count += 1

    threads = [threading.Thread(target=worker) for _ in range(200)]
    for t in threads:
        t.start()
    start.set()
    for t in threads:
        t.join()

    assert allowed_count == limit
