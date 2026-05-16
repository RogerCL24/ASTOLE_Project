# ASTOLE Multi-Agent Triage System

> Hub-and-spoke + planner-executor pattern for real-time security alert
> triage on NF-UNSW-NB15-v3.

## Architecture

Pattern: **Pipeline-and-skill with mandatory N-stage flow**. The orchestrator
(`triage_graph` compiled from `src/agents/graph/workflow.py`) routes every alert
through a strict, non-skippable pipeline. Each stage delegates to a single
specialist node and produces a structured handoff for the next stage.

```
ASTOLE Triage Pipeline (L0)
├── Router (L1 — Classifier Planner)
│   ├── benign_guard         (L2 — short-circuit benign flows)
│   ├── dos_fuzzers          (L2 — DoS / Fuzzers analysis)
│   ├── exploits_backdoor    (L2 — Exploits / Backdoor analysis)
│   ├── recon_analysis       (L2 — Reconnaissance / Analysis)
│   ├── shellcode_worms      (L2 — Shellcode / Worms)
│   └── generic              (L2 — fallback specialist)
├── RAG Enrichment (L1 — External Context Coordinator)
│   └── rag_retrieve         (L2 — ChromaDB-backed RAG client)
└── Summarizer (L1 — CISO Responder)
    └── narrative_builder    (L2 — hierarchical executive/tactical/impact narrative)
```

## Agents

### Level 0 — Orchestrator

| Agent | Role | Capability |
| --- | --- | --- |
| **triage_graph** | Pipeline orchestrator | Compiles the LangGraph state machine. Does not execute LLM work directly; only delegates between nodes. |

### Level 1 — Stage Planners

| Agent | Role | Definition |
| --- | --- | --- |
| **Router** | Classifies alert into attack family + confidence tier | [`docs/agents/router.agent.md`](src/agents/docs/agents/router.agent.md) |
| **RAG Enrichment** | Retrieves external organizational context | [`docs/agents/rag_enrichment.agent.md`](src/agents/docs/agents/rag_enrichment.agent.md) |
| **Summarizer** | Produces hierarchical executive narrative | [`docs/agents/summarizer.agent.md`](src/agents/docs/agents/summarizer.agent.md) |

### Level 2 — Skill Executors

| Agent | Parent | Capability |
| --- | --- | --- |
| **benign_guard** | Router | Deterministic benign assessment, zero LLM cost |
| **dos_fuzzers** | Router | Volumetric and protocol-fuzzing threat analysis |
| **exploits_backdoor** | Router | Active compromise + persistence detection |
| **recon_analysis** | Router | Pre-exploitation probing and web-app analysis |
| **shellcode_worms** | Router | Payload injection + lateral propagation |
| **generic** | Router | Cryptographic / unclassified threats fallback |
| **rag_retrieve** | RAG Enrichment | Semantic ChromaDB query + retry/fallback |
| **narrative_builder** | Summarizer | Builds final TriageOutput contract |

Each L2 specialist has a corresponding skill bundle under
[`src/agents/docs/skills/`](src/agents/docs/skills/) with `*.skill.md` + `.agent.md`.

## Mandatory pipeline (4 stages)

ANY incoming alert flows through ALL stages in this exact order:

```
1. Router          → classifies and selects specialist (rule-first, LLM fallback)
2. Skill           → produces SkillAssessment (structured JSON)
3. RAG Enrichment  → adds external context from organizational memory
4. Summarizer      → generates TriageOutput (executive + tactical + impact)
```

The orchestrator NEVER decides on its own to skip a stage. If a stage has no
work it must explicitly emit `[PLAN_VACIO]` with justification; if blocked, it
must emit `[ERROR]`. See [`src/agents/docs/HANDOFFS.md`](src/agents/docs/HANDOFFS.md).

## Handoff contract (5 mandatory blocks)

Each step between nodes uses a structured handoff stored in `AgentState.handoffs`:

| Block | Content |
| --- | --- |
| **task** | Precise instruction for the receiver |
| **scope** | Files / fields / records the receiver may touch |
| **accumulated_context** | Concrete data from previous stages |
| **constraints** | What the receiver must NOT do, including existence-validation reminder |
| **attention_points** | Risks, dependencies, pending decisions |

See [`src/agents/docs/HANDOFFS.md`](src/agents/docs/HANDOFFS.md) for full schema.

## Circuit breakers

Before any non-delegation action each node verifies:

- Am I about to produce work that belongs to another node? → VIOLATE
- Am I reading state for anything other than building my output? → VIOLATE
- Does another node already cover this concern? → VIOLATE

Implementation lives in `src/agents/core/circuit_breaker.py`.

## Plan vacío vs Error

Every stage MUST tag its output:

| Tag | Meaning | Pipeline action |
| --- | --- | --- |
| `[PLAN_VACIO]` + reason | No work needed in this stage | Continue to next stage |
| `[ERROR]` + reason | Work needed but blocked | Retry once; abort + report if persists |

## GitHub-native operations

The system integrates with GitHub Actions for CI, smoke tests, contract
validation, and issue-driven triage. See:

- [`.github/workflows/`](.github/workflows/) — runners and reusable workflows
- [`src/agents/docs/CI_PIPELINE.md`](src/agents/docs/CI_PIPELINE.md) — runner topology
- [`src/agents/docs/ISSUE_DRIVEN_TRIAGE.md`](src/agents/docs/ISSUE_DRIVEN_TRIAGE.md) — auto-issue + manual-trigger flow

## Reference docs

- [`src/agents/README.md`](src/agents/README.md) — entry point
- [`src/agents/ARCHITECTURE.md`](src/agents/ARCHITECTURE.md) — runtime architecture
- [`src/agents/docs/PIPELINE_DESIGN.md`](src/agents/docs/PIPELINE_DESIGN.md) — pipeline design rationale
- [`src/agents/CHANGELOG.md`](src/agents/CHANGELOG.md) — changelog

## Extension

To add a new skill: copy `src/agents/docs/skills/_template.skill.md` and follow
`src/agents/docs/SKILLS_AND_PROMPTS.md`. To register the skill, update:

1. `SKILL_MAP` in [`src/agents/agents/router.py`](src/agents/agents/router.py)
2. `SKILL_NODES` in [`src/agents/graph/workflow.py`](src/agents/graph/workflow.py)
3. The agent index in this file
