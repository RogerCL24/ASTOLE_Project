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

- [Top-level AGENTS.md (hierarchy)](../../AGENTS.md)
- [Architecture](./ARCHITECTURE.md)
- [Changelog](./CHANGELOG.md)
- [Pipeline Design](./docs/PIPELINE_DESIGN.md)
- [Handoffs (5-block schema)](./docs/HANDOFFS.md)
- [CI Pipeline (GitHub Runners)](./docs/CI_PIPELINE.md)
- [Issue-driven Triage](./docs/ISSUE_DRIVEN_TRIAGE.md)
- [Docker Deployment Guide](./docs/DOCKER_DEPLOYMENT.md)
- [Runtime & CLI Operations](./docs/OPERATIONS.md)
- [Contracts & API](./docs/CONTRACTS_AND_API.md)
- [Skills & Prompts](./docs/SKILLS_AND_PROMPTS.md)
- [Skills catalogue](./skills/README.md)
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

## GitHub-native operations

Layer 1 can also be operated entirely from GitHub:

| Trigger | Workflow | Effect |
| --- | --- | --- |
| Open an issue with the `Manual triage request` template + label `astole-triage` | [`triage-issue.yml`](../../.github/workflows/triage-issue.yml) | Runs the pipeline against the JSON payload in the issue body and posts the TriageOutput as a comment. |
| Daily cron (or manual dispatch) | [`triage-batch.yml`](../../.github/workflows/triage-batch.yml) | Replays curated alerts and auto-opens incident issues for `severity >= critical`. |
| `git tag v*.*.*` | [`release-docker.yml`](../../.github/workflows/release-docker.yml) | Publishes `agents-api` and `rag-api` images to GHCR. |
| `push` / `pull_request` | `ci-tests` + `ci-contract-validation` + `ci-agent-md-validate` + `ci-docker-smoke` | Mandatory quality gates. |

See [`./docs/CI_PIPELINE.md`](./docs/CI_PIPELINE.md) and
[`./docs/ISSUE_DRIVEN_TRIAGE.md`](./docs/ISSUE_DRIVEN_TRIAGE.md) for full details.
