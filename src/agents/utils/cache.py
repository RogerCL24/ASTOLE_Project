"""ASTOLE — In-memory alert cache with optional Redis backend.

Caches triage results by (src_ip, attack_type, window_id) to avoid
re-processing duplicate alerts within the same 60-second window.
"""

from __future__ import annotations

import hashlib
import json
import logging
from functools import lru_cache
from typing import Any, Dict, Optional

from src.agents.core.config import CACHE_ENABLED, CACHE_TTL_S

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# In-memory LRU fallback (used when Redis is unavailable)
# ---------------------------------------------------------------------------

_memory_cache: Dict[str, Dict[str, Any]] = {}


def _make_key(src_ip: str, attack_type: str, window_id: str) -> str:
    """Deterministic cache key from alert identifiers."""
    raw = f"{src_ip}|{attack_type}|{window_id}"
    return hashlib.sha256(raw.encode()).hexdigest()


def get_cached_result(
    src_ip: str,
    attack_type: str,
    window_id: str,
) -> Optional[Dict[str, Any]]:
    """Look up a cached triage result. Returns None on miss."""
    if not CACHE_ENABLED or not window_id:
        return None

    key = _make_key(src_ip, attack_type, window_id)

    # Try Redis first
    result = _redis_get(key)
    if result is not None:
        return result

    # Fallback to in-memory
    return _memory_cache.get(key)


def set_cached_result(
    src_ip: str,
    attack_type: str,
    window_id: str,
    result: Dict[str, Any],
) -> None:
    """Store a triage result in the cache."""
    if not CACHE_ENABLED or not window_id:
        return

    key = _make_key(src_ip, attack_type, window_id)

    # Try Redis first
    if _redis_set(key, result):
        return

    # Fallback to in-memory (bounded size)
    if len(_memory_cache) > 10_000:
        # Evict oldest entries
        keys_to_remove = list(_memory_cache.keys())[:5_000]
        for k in keys_to_remove:
            _memory_cache.pop(k, None)
    _memory_cache[key] = result


# ---------------------------------------------------------------------------
# Redis backend (graceful degradation if unavailable)
# ---------------------------------------------------------------------------

@lru_cache(maxsize=1)
def _get_redis_client():
    """Lazy-init Redis client. Returns None if Redis is unavailable."""
    try:
        import redis
        from src.agents.core.config import REDIS_URL
        client = redis.from_url(REDIS_URL, decode_responses=True)
        client.ping()
        logger.info("Redis cache connected: %s", REDIS_URL)
        return client
    except Exception:
        logger.info("Redis unavailable, using in-memory cache fallback")
        return None


def _redis_get(key: str) -> Optional[Dict[str, Any]]:
    client = _get_redis_client()
    if client is None:
        return None
    try:
        data = client.get(f"astole:{key}")
        if data:
            return json.loads(data)
    except Exception as e:
        logger.warning("Redis GET error: %s", e)
    return None


def _redis_set(key: str, value: Dict[str, Any]) -> bool:
    client = _get_redis_client()
    if client is None:
        return False
    try:
        client.setex(f"astole:{key}", CACHE_TTL_S, json.dumps(value, ensure_ascii=False))
        return True
    except Exception as e:
        logger.warning("Redis SET error: %s", e)
        return False
