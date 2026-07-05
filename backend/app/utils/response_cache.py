"""In-memory LRU+TTL cache for AI generation results (B12).

Keyed on (sketch_image_hash, framework, sketch_source, text_annotations_hash)
so that identical inputs return immediately without calling Roboflow or Gemini.
The cache is bounded (LRU eviction) and time-limited (TTL) so memory use
stays predictable and stale results do not outlive a deploy.

This is process-local (single uvicorn instance). For a multi-worker deployment,
move the store to Redis and keep the same get()/put() contract.

Env vars (all optional, have safe defaults):
  CACHE_ENABLED=true          set false to disable globally
  CACHE_TTL_SECONDS=1800      entry lifetime in seconds (default 30 min)
  CACHE_MAX_SIZE=50           max entries before LRU eviction kicks in
"""

from __future__ import annotations

import threading
import time
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional


@dataclass
class CachedResult:
    generated_code: str
    elements_json: List[Dict[str, Any]]
    source: str                                      # "gemini", "template", etc.
    created_at: float = field(default_factory=lambda: time.monotonic())


class GenerationCache:
    """Thread-safe bounded LRU cache with per-entry TTL.

    Uses an insertion-ordered dict (Python 3.7+) for O(1) LRU tracking:
    on every hit the entry is moved to the tail; on overflow the head
    (oldest) entry is evicted.
    """

    def __init__(self, max_size: int = 50, ttl_seconds: float = 1800.0) -> None:
        if max_size < 1:
            raise ValueError("max_size must be >= 1")
        if ttl_seconds <= 0:
            raise ValueError("ttl_seconds must be > 0")
        self._max_size = max_size
        self._ttl = ttl_seconds
        self._store: Dict[str, CachedResult] = {}
        self._lock = threading.Lock()

    def get(self, key: str) -> Optional[CachedResult]:
        with self._lock:
            entry = self._store.get(key)
            if entry is None:
                return None
            if time.monotonic() - entry.created_at > self._ttl:
                del self._store[key]
                return None
            # Move to tail to refresh LRU position.
            del self._store[key]
            self._store[key] = entry
            return entry

    def put(self, key: str, result: CachedResult) -> None:
        with self._lock:
            if key in self._store:
                del self._store[key]
            elif len(self._store) >= self._max_size:
                oldest = next(iter(self._store))
                del self._store[oldest]
            self._store[key] = result

    @property
    def size(self) -> int:
        with self._lock:
            return len(self._store)
