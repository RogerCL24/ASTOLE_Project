"""External RAG API for the Agent layer.

This service exposes a thin HTTP contract over the ChromaDB memory managed by
Engineer 3 so the LangGraph pipeline can consume historical context as an
external dependency.

The Chroma manager (``MemoryManager``) is synchronous and may take tens of
milliseconds per call (embedding + similarity search). We therefore offload
those calls to a worker thread via ``run_in_threadpool`` to avoid blocking
FastAPI's event loop under concurrent load.
"""

from __future__ import annotations

from typing import List

from fastapi import FastAPI
from fastapi.concurrency import run_in_threadpool
from pydantic import BaseModel, Field

from src.memory.chromadb_manager import MemoryManager

app = FastAPI(title="ASTOLE RAG API", version="1.0.0")
manager = MemoryManager()


class QueryRequest(BaseModel):
    """Request payload expected by the external RAG contract."""

    query: str = Field(..., min_length=2)
    top_k: int = Field(default=5, ge=1, le=20)


class QueryResponse(BaseModel):
    """Response payload consumed by Engineer 2 agents."""

    snippets: List[str] = Field(default_factory=list)


@app.get("/health")
async def health() -> dict:
    """Lightweight health endpoint for docker-compose readiness checks."""
    stats = await run_in_threadpool(manager.get_stats)
    return {"status": "ok", "windows_indexed": stats.get("total_windows", 0)}


@app.post("/query", response_model=QueryResponse)
async def query_memory(payload: QueryRequest) -> QueryResponse:
    """Retrieve semantic context snippets from ChromaDB."""
    def _search() -> dict:
        return manager.search_similar(payload.query, n_results=payload.top_k)

    results = await run_in_threadpool(_search)
    docs = []
    if isinstance(results, dict):
        docs = (results.get("documents") or [[]])[0] or []
    snippets = [str(doc).strip() for doc in docs if str(doc).strip()]
    return QueryResponse(snippets=snippets)
