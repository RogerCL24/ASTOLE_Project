"""External RAG API for the Agent layer.

This service exposes a thin HTTP contract over the ChromaDB memory managed by
Engineer 3 so the LangGraph pipeline can consume historical context as an
external dependency.
"""

from __future__ import annotations

from typing import List

from fastapi import FastAPI
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
    stats = manager.get_stats()
    return {"status": "ok", "windows_indexed": stats.get("total_windows", 0)}


@app.post("/query", response_model=QueryResponse)
async def query_memory(payload: QueryRequest) -> QueryResponse:
    """Retrieve semantic context snippets from ChromaDB."""
    results = manager.search_similar(payload.query, n_results=payload.top_k)
    docs = []
    if isinstance(results, dict):
        docs = (results.get("documents") or [[]])[0] or []
    snippets = [str(doc).strip() for doc in docs if str(doc).strip()]
    return QueryResponse(snippets=snippets)
