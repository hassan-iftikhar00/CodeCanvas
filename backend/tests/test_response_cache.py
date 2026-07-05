"""Tests for the generation response cache (B12).

Covers GenerationCache contract (get/put, TTL expiry, LRU eviction, thread
safety) and _generation_cache_key stability. Time-dependent tests inject a
fake clock via monkeypatch (same pattern as test_rate_limit.py) so tests are
fast and never flaky.
"""

import threading

import pytest

from app.utils import response_cache
from app.utils.response_cache import CachedResult, GenerationCache


class FakeClock:
    def __init__(self, start: float = 0.0) -> None:
        self._now = start

    def monotonic(self) -> float:
        return self._now

    def advance(self, seconds: float) -> None:
        self._now += seconds


@pytest.fixture
def clock(monkeypatch):
    fake = FakeClock()
    monkeypatch.setattr(response_cache, "time", fake)
    return fake


def _result(code: str = "code", source: str = "gemini") -> CachedResult:
    return CachedResult(generated_code=code, elements_json=[], source=source)


# ---------------------------------------------------------------------------
# Basic get/put
# ---------------------------------------------------------------------------

def test_empty_cache_returns_none(clock):
    cache = GenerationCache(max_size=10, ttl_seconds=60)
    assert cache.get("missing") is None


def test_put_then_get_returns_result(clock):
    cache = GenerationCache(max_size=10, ttl_seconds=60)
    cache.put("k", _result("hello"))
    got = cache.get("k")
    assert got is not None
    assert got.generated_code == "hello"


def test_put_overwrites_same_key(clock):
    cache = GenerationCache(max_size=10, ttl_seconds=60)
    cache.put("k", _result("first"))
    cache.put("k", _result("second"))
    assert cache.get("k").generated_code == "second"
    assert cache.size == 1


def test_size_reflects_entries(clock):
    cache = GenerationCache(max_size=10, ttl_seconds=60)
    assert cache.size == 0
    cache.put("a", _result())
    cache.put("b", _result())
    assert cache.size == 2


# ---------------------------------------------------------------------------
# TTL
# ---------------------------------------------------------------------------

def test_ttl_expiry_returns_none(clock):
    cache = GenerationCache(max_size=10, ttl_seconds=30)
    cache.put("k", _result())
    clock.advance(31)
    assert cache.get("k") is None


def test_ttl_not_yet_expired_returns_result(clock):
    cache = GenerationCache(max_size=10, ttl_seconds=30)
    cache.put("k", _result())
    clock.advance(29)
    assert cache.get("k") is not None


def test_expired_entry_removed_from_size(clock):
    cache = GenerationCache(max_size=10, ttl_seconds=10)
    cache.put("k", _result())
    clock.advance(11)
    cache.get("k")          # triggers removal
    assert cache.size == 0


# ---------------------------------------------------------------------------
# LRU eviction
# ---------------------------------------------------------------------------

def test_lru_evicts_oldest_when_full(clock):
    cache = GenerationCache(max_size=2, ttl_seconds=3600)
    cache.put("a", _result("a"))
    cache.put("b", _result("b"))
    cache.put("c", _result("c"))      # evicts "a" (oldest)
    assert cache.get("a") is None
    assert cache.get("b") is not None
    assert cache.get("c") is not None


def test_lru_access_refreshes_order(clock):
    cache = GenerationCache(max_size=2, ttl_seconds=3600)
    cache.put("a", _result("a"))
    cache.put("b", _result("b"))
    cache.get("a")                    # "a" becomes most-recently-used
    cache.put("c", _result("c"))      # should evict "b", not "a"
    assert cache.get("a") is not None
    assert cache.get("b") is None
    assert cache.get("c") is not None


def test_lru_overwrite_does_not_grow_beyond_max(clock):
    cache = GenerationCache(max_size=2, ttl_seconds=3600)
    cache.put("a", _result())
    cache.put("b", _result())
    cache.put("a", _result("a2"))     # overwrite, not new entry
    assert cache.size == 2


# ---------------------------------------------------------------------------
# Thread safety
# ---------------------------------------------------------------------------

def test_concurrent_puts_and_gets_do_not_raise():
    cache = GenerationCache(max_size=20, ttl_seconds=3600)
    errors = []

    def writer(n: int):
        try:
            for i in range(10):
                cache.put(f"key-{n}-{i}", _result(f"code-{n}-{i}"))
        except Exception as exc:
            errors.append(exc)

    def reader():
        try:
            for i in range(50):
                cache.get(f"key-0-{i % 10}")
        except Exception as exc:
            errors.append(exc)

    threads = [threading.Thread(target=writer, args=(t,)) for t in range(4)]
    threads += [threading.Thread(target=reader) for _ in range(2)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()

    assert errors == [], f"Thread errors: {errors}"


# ---------------------------------------------------------------------------
# Bad config
# ---------------------------------------------------------------------------

@pytest.mark.parametrize("max_size,ttl", [(0, 60), (1, 0), (1, -1)])
def test_bad_config_raises(max_size, ttl):
    with pytest.raises(ValueError):
        GenerationCache(max_size=max_size, ttl_seconds=ttl)


# ---------------------------------------------------------------------------
# Cache key (_generation_cache_key imported from main)
# ---------------------------------------------------------------------------

def _import_key_fn():
    import sys, os
    sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
    # Import only the helper — avoids running FastAPI app startup.
    from main import _generation_cache_key
    return _generation_cache_key


def test_key_is_deterministic():
    fn = _import_key_fn()
    k1 = fn("imgdata", "react", "canvas", None)
    k2 = fn("imgdata", "react", "canvas", None)
    assert k1 == k2


def test_key_differs_by_framework():
    fn = _import_key_fn()
    assert fn("img", "react", "canvas", None) != fn("img", "html", "canvas", None)


def test_key_differs_by_image():
    fn = _import_key_fn()
    assert fn("img1", "react", "canvas", None) != fn("img2", "react", "canvas", None)


def test_key_differs_by_source():
    fn = _import_key_fn()
    assert fn("img", "react", "canvas", None) != fn("img", "react", "upload-photo", None)


def test_key_canvas_with_no_annotations_stable():
    fn = _import_key_fn()
    k1 = fn("img", "react", "canvas", [])
    k2 = fn("img", "react", "canvas", [])
    assert k1 == k2


def test_key_upload_ignores_annotations():
    """Upload path: image carries the text, so annotation list must not affect key."""
    from pydantic import BaseModel

    class Ann(BaseModel):
        text: str
        x: float
        y: float
        width: float = 0.0
        height: float = 0.0

    fn = _import_key_fn()
    ann = Ann(text="Button", x=10, y=20)
    k_with_ann = fn("img", "react", "upload-photo", [ann])
    k_without = fn("img", "react", "upload-photo", None)
    assert k_with_ann == k_without
