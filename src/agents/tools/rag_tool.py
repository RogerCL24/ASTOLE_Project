"""ASTOLE — RAG Tool: interface with ChromaDB (Engineer 3).

Abstracts communication with the vector memory service.
Includes mock for development independent of Eng 3.
"""

from __future__ import annotations

import logging
import os
from typing import List

import httpx

from src.agents.core.config import RAG_API_URL, RAG_RETRIES, RAG_TIMEOUT_S, RAG_TOP_K

logger = logging.getLogger(__name__)

# When True, rag_retrieve returns mock data (offline development).
# Default is false to favor real integration in production-like environments.
_USE_MOCK = os.getenv("RAG_USE_MOCK", "false").lower() == "true"


async def rag_retrieve(query: str, top_k: int | None = None) -> str:
    """
    Query the ChromaDB API from Engineer 3.

    Args:
        query: Semantic search text (e.g. "DoS attacks from 192.168.1.50")
        top_k: Number of snippets to retrieve (default: RAG_TOP_K)

    Returns:
        Concatenated string with relevant snippets, separated by '---'.
    """
    k = top_k or RAG_TOP_K

    if _USE_MOCK:
        return _mock_retrieve(query, k)

    try:
        async with httpx.AsyncClient(timeout=RAG_TIMEOUT_S) as client:
            resp = await client.post(
                f"{RAG_API_URL}/query",
                json={"query": query, "top_k": k},
            )
            resp.raise_for_status()
            data = resp.json()
            snippets: List[str] = data.get("snippets", [])
            if not snippets:
                return "No historical context available."
            return "\n---\n".join(snippets)
    except httpx.TimeoutException:
        logger.warning("RAG timeout (%ds) for query: %s", RAG_TIMEOUT_S, query[:80])
        return "Context unavailable (memory query timeout)."
    except Exception as e:
        logger.error("Error querying RAG: %s", e)
        return "Context unavailable (memory connection error)."


async def rag_retrieve_with_count(query: str, top_k: int | None = None) -> tuple[str, int]:
    """Same as rag_retrieve but also returns the snippet count."""
    k = top_k or RAG_TOP_K

    if _USE_MOCK:
        text = _mock_retrieve(query, k)
        count = text.count("---") + 1 if "---" in text else (1 if text and "No historical context" not in text else 0)
        return text, count

    last_error: Exception | None = None
    for _ in range(RAG_RETRIES + 1):
        try:
            async with httpx.AsyncClient(timeout=RAG_TIMEOUT_S) as client:
                resp = await client.post(
                    f"{RAG_API_URL}/query",
                    json={"query": query, "top_k": k},
                )
                resp.raise_for_status()
                data = resp.json()
                snippets: List[str] = data.get("snippets", [])
                if not snippets:
                    return "No historical context available.", 0
                return "\n---\n".join(snippets), len(snippets)
        except Exception as e:
            last_error = e
            continue
    logger.error("Error querying RAG after retries: %s", last_error)
    return "Context unavailable.", 0


def _mock_retrieve(query: str, top_k: int) -> str:
    """Mock for development without real ChromaDB."""
    mock_snippets = [
        "[MOCK] Previous flow detected from same source IP 45s ago — "
        "similar pattern with high packets-per-second ratio.",
        "[MOCK] History: IP has appeared in 3 previous alerts in the last 24h, "
        "all classified as attacks with confidence > 0.85.",
        "[MOCK] Destination 10.0.0.5 received anomalous traffic from 2 distinct IPs "
        "in the last 60-second window.",
    ]
    return "\n---\n".join(mock_snippets[:top_k])
