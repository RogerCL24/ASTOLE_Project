"""ASTOLE — FastAPI entrypoint for the Multi-Agent Layer.

Endpoints:
  POST /triage         — Process an alert and return TriageOutput
  POST /triage/batch   — Process multiple alerts in parallel
  GET  /health         — Health check
  GET  /metrics        — Accumulated cost and token metrics
"""

from __future__ import annotations

import asyncio
import logging
import time
from contextlib import asynccontextmanager
from typing import Any, Dict, List

import litellm
import uvicorn
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from src.agents.core.config import API_HOST, API_PORT, API_WORKERS, setup_litellm
from src.agents.graph import triage_graph
from src.agents.models.input_schemas import InputAlert
from src.agents.models.output_schemas import TriageOutput
from src.agents.utils.cache import get_cached_result, set_cached_result
from src.agents.utils.cost_tracker import cost_tracker

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(name)s] %(levelname)s: %(message)s")
logger = logging.getLogger("astole.api")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup/shutdown events."""
    setup_litellm()
    litellm.callbacks = [cost_tracker]
    logger.info("ASTOLE Multi-Agent Layer started")
    yield
    logger.info("ASTOLE Multi-Agent Layer stopped")


app = FastAPI(
    title="ASTOLE — Layer 1: Multi-Agent Triage Pipeline",
    description="Network alert triage pipeline based on LangGraph with specialized skills per attack type.",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, restrict to dashboard domain
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.post("/triage", response_model=TriageOutput)
async def triage(alert: InputAlert) -> Dict[str, Any]:
    """
    Process an alert and return a structured triage report.

    Pipeline:
    1. Router classifies and selects the appropriate skill
    2. Skill analyzes with LLM + RAG context
    3. Summarizer generates the hierarchical narrative
    """
    start = time.monotonic()

    # Check cache
    cache_key_args = (
        alert.network_data.src_ip,
        alert.gnn_metadata.label_multiclase.value,
        alert.window_id,
    )
    cached = get_cached_result(*cache_key_args)
    if cached:
        cached["metadata"]["cache_hit"] = True
        return cached

    # Build initial state
    initial_state: Dict[str, Any] = {
        # Dump using canonical contract aliases (v1.1) for trace consistency.
        "input": alert.model_dump(mode="json", by_alias=True),
        "skill_activated": "",
        "confidence_tier": "standard",
        "rag_context": "",
        "rag_snippets_count": 0,
        "assessment": {},
        "tokens_used": {"router": 0, "skill": 0, "summarizer": 0, "total": 0},
        "cost_usd": 0.0,
        "models_used": [],
        "cache_hit": False,
        "errors": [],
    }

    # Snapshot global cost-tracker totals before the pipeline runs so we
    # can compute a per-request delta and propagate it into TriageOutput.
    cost_before = cost_tracker.get_totals()

    # Run graph
    try:
        result = await triage_graph.ainvoke(initial_state)
    except Exception as e:
        logger.error("Pipeline execution error: %s", e)
        raise HTTPException(status_code=500, detail=f"Pipeline error: {str(e)}")

    triage_output = result.get("triage_output")
    if not triage_output:
        raise HTTPException(status_code=500, detail="Pipeline produced no output")

    # Per-request cost = totals_after - totals_before. This keeps
    # TriageOutput.metadata.cost_usd consistent with the global /metrics
    # endpoint without requiring per-node cost propagation.
    cost_after = cost_tracker.get_totals()
    request_cost = max(0.0, cost_after["total_cost_usd"] - cost_before["total_cost_usd"])
    triage_output["metadata"]["cost_usd"] = round(request_cost, 6)

    # Calculate processing time
    elapsed_ms = int((time.monotonic() - start) * 1000)
    triage_output["metadata"]["processing_time_ms"] = elapsed_ms

    # Save to cache
    set_cached_result(*cache_key_args, result=triage_output)

    return triage_output


@app.post("/triage/batch")
async def triage_batch(alerts: List[InputAlert]) -> List[Dict[str, Any]]:
    """
    Process a batch of alerts in parallel.
    Useful for processing all alerts in a 60s window.
    Maximum 50 alerts per batch.
    """
    if len(alerts) > 50:
        raise HTTPException(status_code=400, detail="Maximum 50 alerts per batch")

    tasks = [triage(alert) for alert in alerts]
    results = await asyncio.gather(*tasks, return_exceptions=True)

    outputs = []
    for i, result in enumerate(results):
        if isinstance(result, Exception):
            logger.error("Error in alert %d: %s", i, result)
            outputs.append({"error": str(result), "alert_id": alerts[i].alert_id})
        else:
            outputs.append(result)

    return outputs


@app.get("/health")
async def health() -> Dict[str, str]:
    """Health check."""
    return {"status": "ok", "service": "astole-triage"}


@app.get("/metrics")
async def metrics() -> Dict[str, Any]:
    """Accumulated token and cost metrics."""
    return cost_tracker.get_totals()


if __name__ == "__main__":
    uvicorn.run(
        "src.agents.main:app",
        host=API_HOST,
        port=API_PORT,
        workers=API_WORKERS,
        reload=True,
    )
