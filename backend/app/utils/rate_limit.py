"""In-memory sliding-window rate limiter for the AI endpoint (B7).

Why a custom limiter and not slowapi:
- /api/predict sits BEHIND the Next.js proxy, so every request arrives from the
  proxy's IP. IP-based limiting (slowapi's default) would pool all users into a
  single bucket. The proxy authenticates the user and stamps the trusted Supabase
  user id into the request body, so we key on that instead — per-user and fair.
- The backend is a single uvicorn process, so process-local state is enough; a
  Redis/limits dependency is not justified at FYP scale.

If this ever scales to multiple workers/instances, swap the in-process dict for a
shared store (e.g. Redis) keyed the same way and keep the same check() contract.

The module has zero third-party dependencies and a runnable self-check at the
bottom (`python app/utils/rate_limit.py`) so the logic can be verified without a
test framework.
"""

from __future__ import annotations

import threading
import time
from collections import defaultdict, deque
from typing import Deque, Dict, Tuple


class SlidingWindowRateLimiter:
    """Per-key sliding-window log limiter.

    Each key (a user id, or an IP fallback) gets a deque of monotonic
    timestamps for the requests it made inside the last `window_seconds`.
    A request is allowed only while that count is below `max_requests`.

    A sliding window log is used over a fixed-window counter because fixed
    windows allow a double burst across the window boundary (up to 2x the limit
    in a short span). Memory is O(max_requests) per active key, which is tiny.
    """

    def __init__(self, max_requests: int, window_seconds: float) -> None:
        if max_requests < 1:
            raise ValueError("max_requests must be >= 1")
        if window_seconds <= 0:
            raise ValueError("window_seconds must be > 0")
        self.max_requests = int(max_requests)
        self.window_seconds = float(window_seconds)
        self._hits: Dict[str, Deque[float]] = defaultdict(deque)
        self._lock = threading.Lock()
        self._last_sweep = 0.0

    def check(self, key: str) -> Tuple[bool, float, int]:
        """Record an attempt for `key` and decide if it is allowed.

        Returns (allowed, retry_after_seconds, remaining):
          - allowed: False once `key` has `max_requests` hits inside the window.
          - retry_after_seconds: when blocked, seconds until the oldest hit ages
            out and a slot frees up; 0.0 when allowed.
          - remaining: slots left in the current window after this call (0 when
            blocked).

        A blocked attempt is NOT recorded, so a caller hammering the endpoint
        cannot keep pushing its own retry window further into the future.
        """
        now = time.monotonic()
        cutoff = now - self.window_seconds
        with self._lock:
            self._maybe_sweep(now)
            hits = self._hits[key]
            while hits and hits[0] <= cutoff:
                hits.popleft()

            if len(hits) >= self.max_requests:
                retry_after = self.window_seconds - (now - hits[0])
                return False, max(retry_after, 0.0), 0

            hits.append(now)
            return True, 0.0, self.max_requests - len(hits)

    def _maybe_sweep(self, now: float) -> None:
        """Drop keys whose windows are fully expired so the dict cannot grow
        without bound. Amortized: runs at most once per window. Must be called
        while holding the lock."""
        if now - self._last_sweep < self.window_seconds:
            return
        self._last_sweep = now
        cutoff = now - self.window_seconds
        stale = [
            key
            for key, hits in self._hits.items()
            if not hits or hits[-1] <= cutoff
        ]
        for key in stale:
            del self._hits[key]


if __name__ == "__main__":
    # Lightweight self-check — runnable with `python app/utils/rate_limit.py`.
    # Not a pytest suite (that is task B11); just enough to prove the contract.
    def _expect(cond: bool, msg: str) -> None:
        if not cond:
            raise AssertionError(msg)

    # Basic allow-up-to-limit then block.
    rl = SlidingWindowRateLimiter(max_requests=3, window_seconds=1.0)
    for i in range(3):
        allowed, retry, remaining = rl.check("user-a")
        _expect(allowed, f"request {i + 1} should be allowed")
        _expect(remaining == 2 - i, f"remaining wrong on request {i + 1}: {remaining}")

    allowed, retry, remaining = rl.check("user-a")
    _expect(not allowed, "4th request should be blocked")
    _expect(retry > 0.0, "retry_after should be positive when blocked")
    _expect(remaining == 0, "remaining should be 0 when blocked")

    # Keys are isolated.
    allowed, _, _ = rl.check("user-b")
    _expect(allowed, "different key should have its own budget")

    # Window slides: after the window passes, slots free up again.
    rl2 = SlidingWindowRateLimiter(max_requests=2, window_seconds=0.3)
    _expect(rl2.check("k")[0], "first ok")
    _expect(rl2.check("k")[0], "second ok")
    _expect(not rl2.check("k")[0], "third blocked")
    time.sleep(0.35)
    _expect(rl2.check("k")[0], "allowed again after window slides")

    # Bad config is rejected.
    for bad in ((0, 1.0), (1, 0.0), (1, -1.0)):
        try:
            SlidingWindowRateLimiter(*bad)
        except ValueError:
            pass
        else:
            raise AssertionError(f"expected ValueError for config {bad}")

    print("rate_limit self-check passed")
