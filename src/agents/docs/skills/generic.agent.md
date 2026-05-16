---
name: generic
level: L2
parent: router
description: |-
  Fallback specialist for the dataset's `Generic` class (cryptographic and
  unclassified anomalies). High false-positive rate — emphasizes calibrated
  uncertainty and explicit recommendations for analyst follow-up.
implementation: src/agents/agents/skills/generic.py
entrypoint: generic_skill
skill_bundle: src/agents/docs/skills/generic.skill.md
tools:
  - read_state
  - litellm.acompletion
  - rag_retrieve_with_count
user-invocable: false
agent-invocable: true
---

# Generic Specialist (L2)

Catch-all for residual malicious patterns. Full instructions in
[`SKILL.md`](../../skills/generic/SKILL.md).

## Hard rules

1. When uncertain, raise `false_positive_probability` and explain why.
2. Recommend additional investigation queries instead of escalation.
3. Strict JSON output.
