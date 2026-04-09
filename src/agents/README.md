# ASTOLE Layer 1 - Agents

Layer 1 is the triage intelligence layer of ASTOLE. It receives alert payloads
from ingestion/detection, routes each alert to specialized analysis skills,
retrieves external context, and returns a structured response for the dashboard.

## What this layer contains

- LangGraph pipeline (`router -> skill -> rag_enrichment -> summarizer`)
- FastAPI service (`/triage`, `/triage/batch`, `/health`, `/metrics`)
- Specialized skill modules by attack family
- Prompt packs and RAG query templates
- External RAG integration client and RAG API adapter
- Operational CLI for docker lifecycle, health checks and smoke calls
- Pydantic contracts for input/output compatibility with adjacent layers

## Documentation index

- [Architecture](./ARCHITECTURE.md)
- [Changelog](./CHANGELOG.md)
- [Docker Deployment Guide](./docs/DOCKER_DEPLOYMENT.md)
- [Runtime & CLI Operations](./docs/OPERATIONS.md)
- [Contracts & API](./docs/CONTRACTS_AND_API.md)
- [Skills & Prompts](./docs/SKILLS_AND_PROMPTS.md)
- [Observability, Cost & Tracing](./docs/OBSERVABILITY.md)

## Docker-first execution (recommended)

From repository root:

```bash
docker compose up --build -d
```

Layer 1 related services:

- `agents-api` -> `http://localhost:8010`
- `rag-api` -> `http://localhost:8001`
- `chromadb` -> `http://localhost:8002`

Health checks:

```bash
python -m src.agents.cli --api-url http://localhost:8010 health
```

Smoke triage with real sample:

```bash
python -m src.agents.cli --api-url http://localhost:8010 triage --payload docs/samples/live_alerts.json
```
