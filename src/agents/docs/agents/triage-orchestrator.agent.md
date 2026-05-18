---
name: triage-orchestrator
level: L0
description: |-
  ASTOLE pipeline orchestrator. Receives an InputAlert, drives every alert
  through the mandatory 4-stage pipeline (Router → Skill → RAG → Summarizer)
  and returns a validated TriageOutput. Does not produce technical analysis
  itself — only delegates between nodes via the LangGraph state machine.
implementation: src/agents/graph/workflow.py
entrypoint: triage_graph
tools:
  - langgraph.StateGraph
  - delegate_to_node
user-invocable: true
---

# Triage Orchestrator (L0)

**THIS IS AN ORCHESTRATOR. IT DOES NOT PERFORM ANALYSIS DIRECTLY. IT DELEGATES EVERY STAGE.**

The orchestrator is implemented as a compiled LangGraph in
[`src/agents/graph/workflow.py`](../graph/workflow.py). Its single
responsibility is to wire planners (L1) and executors (L2) into a strict
pipeline and pass the shared `AgentState` between them.

## Hierarchy

```
triage_graph (L0)
├── Router (L1)
│   └── benign_guard | dos_fuzzers | exploits_backdoor | recon_analysis | shellcode_worms | generic
├── RAG Enrichment (L1)
│   └── rag_retrieve
└── Summarizer (L1)
    └── narrative_builder
```

## Hard rules

1. **Mandatory 4-stage pipeline.** Every alert flows through Router → Skill →
   RAG → Summarizer. No stage can be skipped. If a stage has no work, it must
   tag its output `[PLAN_VACIO]` with justification.
2. **L1 → L2 delegation only.** Each stage produces a structured handoff that
   the next stage consumes. The orchestrator never bypasses a node.
3. **Circuit breaker first.** Before any node executes, it checks:
   - Am I producing the right artifact for this stage?
   - Am I reading only the state I need to build my output?
   - Could another node cover this concern?
4. **Plan vacío vs error distinction is mandatory.** See `[PLAN_VACIO]` /
   `[ERROR]` semantics in [`src/agents/docs/HANDOFFS.md`](../docs/HANDOFFS.md).
5. **Existence validation.** Every handoff must remind the receiver to check
   whether its work is already done (cache hit, prior assessment, etc.).

## Failure handling

- **Stage failure:** 1 retry with extra context.
- **Persistent failure:** abort the pipeline, return a structured error in
  `TriageOutput` and log to LangSmith.
- **QA-style validation failure:** the summarizer marks the result as
  `is_escalated=true` so downstream layers (dashboard / SOC analyst) are alerted.

## Observability

Every node updates `AgentState` with:

- `tokens_used.<node>` for token accounting
- `models_used` for traceability
- `handoffs[<stage>]` for full structured trace
- `errors[]` for any non-fatal anomaly

## Out of scope

- Direct LLM calls
- Reading or modifying network data beyond pipeline coordination
- Ingestion or post-processing of TriageOutput beyond returning it
