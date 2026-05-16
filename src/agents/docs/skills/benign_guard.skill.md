---
name: benign_guard
description: |-
  Deterministic short-circuit for benign flows (binary_attack=0 or
  label=Benign). Returns a fully structured assessment WITHOUT calling any
  LLM. ALWAYS use this when the router classifies a flow as benign — it
  saves tokens and keeps latency near-zero.
trigger_labels: [Benign]
attention: low
llm_required: false
---

# Benign Guard Skill

## When to use

Whenever the router selects `benign_guard`. Conditions:

- `binary_attack == 0`, OR
- `label_multiclase == "Benign"`

## Strategy

- Zero LLM calls.
- Returns canonical benign assessment with:
  - `threat_level = "none"`
  - `is_real_threat = false`
  - `false_positive_probability = 1.0 - confidence_score`
  - `recommended_actions = ["passive_monitoring"]`
  - Empty IOCs.
- If invoked with `binary_attack=1`, append a self-diagnostic note to
  `errors[]` (router likely misrouted).

## Subagents

None — the skill is rule-based and intentionally minimal.

## RAG query template

Not used (skill is rule-based).

## Reference prompt

Not applicable. See implementation:
[`agents/skills/benign_guard.py`](../../agents/skills/benign_guard.py).

## Tier budgets

| Tier | max_tokens | RAG snippets |
| --- | --- | --- |
| any | 0 | 0 |
