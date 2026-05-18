---
name: benign_guard
level: L2
parent: router
description: |-
  Deterministic short-circuit for canonical benign flows. Avoids spending
  LLM tokens when the GNN already classified the flow as benign with high
  confidence. Produces a fully structured assessment so downstream nodes
  keep a stable contract.
implementation: src/agents/agents/skills/benign_guard.py
entrypoint: benign_guard_skill
skill_bundle: src/agents/docs/skills/benign_guard.skill.md
tools:
  - read_state
user-invocable: false
agent-invocable: true
---

# Benign Guard (L2)

Zero-LLM-cost specialist. Always returns:

- `threat_level = "none"`
- `is_real_threat = false`
- `false_positive_probability = 1.0 - confidence_score`
- Empty IOCs list

## Hard rules

1. Never call any LLM.
2. Always populate `assessment.recommended_actions` with passive monitoring.
3. If `binary_attack=1` is observed here, append to `errors[]` (the router
   should never have routed an attack here).
