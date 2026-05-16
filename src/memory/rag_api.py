"""External RAG API for the Agent layer.

This service exposes a thin HTTP contract over the ChromaDB memory managed by
Engineer 3 so the LangGraph pipeline can consume historical context as an
external dependency.

The Chroma manager (``MemoryManager``) is synchronous and may take tens of
milliseconds per call (embedding + similarity search). We therefore offload
those calls to a worker thread via ``run_in_threadpool`` to avoid blocking
FastAPI's event loop under concurrent load.

Environment variables
---------------------
RAG_USE_MOCK : "true" | "false"  (default: "false")
    When set to "true" the service starts without initialising ChromaDB or
    loading any embedding model.  All query endpoints return empty results.
    This is used in CI smoke tests to avoid the ~1-minute model-download
    delay that would otherwise fail the Docker healthcheck.
"""

from __future__ import annotations

import os
from typing import List, Optional

from fastapi import FastAPI
from fastapi.concurrency import run_in_threadpool
from pydantic import BaseModel, Field

# ---------------------------------------------------------------------------
# Startup mode: mock vs real
# ---------------------------------------------------------------------------

_USE_MOCK: bool = os.getenv("RAG_USE_MOCK", "false").lower() == "true"

# The MemoryManager initialises ChromaDB and downloads/loads the
# sentence-transformers model at construction time.  In CI (RAG_USE_MOCK=true)
# we skip this entirely so uvicorn can bind the port immediately and pass
# the healthcheck without waiting for model downloads.
if _USE_MOCK:
    _manager: Optional[object] = None
else:
    from src.memory.chromadb_manager import MemoryManager
    _manager = MemoryManager()


app = FastAPI(title="ASTOLE RAG API", version="1.0.0")


class QueryRequest(BaseModel):
    """Request payload expected by the external RAG contract."""

    query: str = Field(..., min_length=2)
    top_k: int = Field(default=5, ge=1, le=20)


class QueryResponse(BaseModel):
    """Response payload consumed by Engineer 2 agents."""

    snippets: List[str] = Field(default_factory=list)


@app.get("/health")
async def health() -> dict:
    """Lightweight health endpoint for docker-compose readiness checks.

    Intentionally does NOT call MemoryManager.get_stats() because that call
    loads chromadb + embeddings and can take >30 s on a cold start.  Docker
    healthchecks fire with a 5-second timeout; a slow stats call would always
    fail during startup.  The endpoint returns immediately so the container
    transitions from 'starting' to 'healthy' as soon as uvicorn is ready.
    """
    return {"status": "ok", "mock": _USE_MOCK}


@app.get("/stats")
async def stats() -> dict:
    """Return ChromaDB indexing stats (heavier call, not used for healthcheck)."""
    if _USE_MOCK or _manager is None:
        return {"status": "ok", "mock": True, "windows_indexed": 0}
    result = await run_in_threadpool(_manager.get_stats)  # type: ignore[attr-defined]
    return {"status": "ok", "mock": False, **result}


@app.post("/query", response_model=QueryResponse)
async def query_memory(payload: QueryRequest) -> QueryResponse:
    """Retrieve semantic context snippets from ChromaDB."""
    if _USE_MOCK or _manager is None:
        return QueryResponse(snippets=[])

    def _search() -> dict:
        return _manager.search_similar(payload.query, n_results=payload.top_k)  # type: ignore[attr-defined]

    results = await run_in_threadpool(_search)
    docs = []
    if isinstance(results, dict):
        docs = (results.get("documents") or [[]])[0] or []
    snippets = [str(doc).strip() for doc in docs if str(doc).strip()]
    return QueryResponse(snippets=snippets)
