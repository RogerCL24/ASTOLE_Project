# Changelog - ASTOLE Layer 1 (Agents)

## [0.5.0-pipeline] - 2026-05-16

### Added (0.5.0-pipeline)

- **L0/L1/L2 hierarchy** declared in `AGENTS.md` and `*.agent.md` files.
- **Skills bundle format** — every skill has a `*.skill.md` with YAML
  frontmatter colocated next to its `*.py` and `*.agent.md` in
  `src/agents/agents/skills/`.
- **Structured handoffs** (`src/agents/core/handoffs.py`):
  - `Handoff` dataclass with the 5 mandatory blocks (`task`, `scope`,
    `accumulated_context`, `constraints`, `attention_points`).
  - `PlanStatus` enum (`OK` / `PLAN_VACIO` / `ERROR`).
  - Auto-injected existence-validation reminder in every handoff.
- **Circuit breakers** (`src/agents/core/circuit_breaker.py`) — per-stage
  invariants for router / skill / rag / summarizer.
- **AgentState extension** — added `handoffs`, `plan_statuses`,
  `circuit_violations`, `subagent_results`, `intel` keys.
- **Parallel execution within skill super-step** — skill assessment, RAG
  pre-fetch and external-intelligence calls run concurrently.
- **Subagent runtime** — micro-tasks per skill (`port_signature_check`,
  `payload_pattern_check`, etc.).
- **External intelligence tools** — MITRE ATT&CK lookup, IP reputation,
  CVE lookup, exposed via an MCP-style client.
- **GitHub Runners** under `.github/workflows/`:
  - `ci-tests.yml`, `ci-contract-validation.yml`, `ci-docker-smoke.yml`,
    `ci-agent-md-validate.yml`, `release-docker.yml`,
    `triage-issue.yml`, `triage-batch.yml`.
- **Templates** under `.github/`:
  - `ISSUE_TEMPLATE/incident-report.yml`, `manual-triage.yml`,
    `skill-improvement.yml`, `config.yml`.
  - `PULL_REQUEST_TEMPLATE.md`, `CODEOWNERS`.

### Fixed (0.5.0-pipeline)

- **Summarizer fallback severity**: `_fallback_summary()` no longer leaks
  `severity='none'` (invalid for `SeverityLevel`). The fallback path now
  goes through `_map_severity()` and translates `'none'` to `'info'`.
- **Router LLM fallback tokens**: `tokens_used['total']` is now
  incremented consistently when the LLM fallback path runs.
- **Cost tracker race**: `get_totals()` now captures `num_calls` inside the
  lock so it is always consistent with the totals.
- **RAG API event-loop blocking**: `/health` and `/query` handlers now
  offload synchronous Chroma calls to a worker thread via
  `fastapi.concurrency.run_in_threadpool`.
- **Dockerfile / requirements drift**: removed the layer-specific
  `src/agents/requirements.txt`; the repo-root `requirements.txt` is the
  single source of truth.
- **bridge_test.py**: now reads `narrative.executive` (matches current
  contract) instead of the non-existent `narrative.executive_summary`.
- **test_pipeline.py**: API integration test now mocks
  `litellm.acompletion` and asserts `200 OK` deterministically.
- **Cost propagation**: `main.py` snapshots `cost_tracker` totals before
  and after each pipeline run and writes the per-request delta into
  `triage_output.metadata.cost_usd`.

### Changed (0.5.0-pipeline)

- Consolidated `src/agents/skills/` into `src/agents/agents/skills/`. The
  duplicate folder has been removed.
- Removed the `scripts/` folder.

## [0.3.0-docs] - 2026-04-09

### Added (0.3.0-docs)

- **Documentation Hub**: Created `src/agents/README.md` as index for Layer 1 docs.
- **Docs Folder**: Added `src/agents/docs/` with complete technical/operational documentation:
  - `DOCKER_DEPLOYMENT.md`
  - `OPERATIONS.md`
  - `CONTRACTS_AND_API.md`
  - `SKILLS_AND_PROMPTS.md`
  - `OBSERVABILITY.md`
- **Mermaid Diagrams**: Added architecture, runtime, sequence, and operations diagrams.

### Changed (0.3.0-docs)

- **Architecture Doc**: Updated `ARCHITECTURE.md` with dockerized boundary and references to full docs.
- **Layer Scope Clarification**: Explicitly documented that Layer 1 is deployed and managed dockerized to integrate with all other ASTOLE layers.

## [0.1.0-int] - 2026-03-31

### Added (0.1.0-int)

- **Integration Bridge**: Creado `bridge_test.py` para validar el flujo desde la Capa de Ingestión (JSON) hasta el Summarizer.
- **Normalización de Datos**: Script de test incluye lógica para adaptar el esquema de Ingestión al contrato de Agentes.

### Fixed (0.1.0-int)

- **Contract Alignment**: Corregido `label_binary` en `input_schemas.py` de `str` a `int` para cumplir con el `contract.md` oficial.
- **Enum Serialization**: Corregido el formateo de `label_multiclass` en el Summarizer para evitar fugas de tipos de Python (`AttackCategory`) en la narrativa de la IA.
- **Output Mapping**: Corregida la visualización de `severity` en los tests de integración (mapeo a nivel de raíz del objeto de salida).

### Changed (0.1.0-int)

- **Prompt Refinement**: Sincronizadas las claves de búsqueda entre el System Prompt y el código de Python (`suggested_queries` vs `investigation_queries`).
