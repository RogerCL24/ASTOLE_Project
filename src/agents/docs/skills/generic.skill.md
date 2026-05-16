---
name: generic
description: |-
  Use as a fallback specialist for the dataset's `Generic` class
  (cryptographic and unclassified anomalies). High false-positive rate —
  emphasize calibrated uncertainty and explicit follow-up recommendations.
trigger_labels: [Generic]
attention: standard
---

# Generic Skill

## When to use

Whenever the router selects this skill, including when the LLM router
fallback returns an unrecognized label.

## Strategy

- Treat as a residual catch-all.
- Raise `false_positive_probability` when uncertain.
- Recommend additional investigation queries (e.g., correlate by src_ip,
  inspect TLS fingerprints) instead of automatic escalation.

## Subagents (parallel within skill)

| Subagent | Purpose |
| --- | --- |
| `entropy_check` | Flow entropy / cryptographic-anomaly heuristic |
| `tls_fingerprint_check` | Known JA3 / cipher anomalies |
| `correlation_check` | RAG correlation for prior misclassifications |

## RAG query template

```
Anomalous or cryptographic-class flow patterns matching {src_ip}
{l7_proto} {dst_port}. Look for prior misclassifications.
```

## Threat-level rubric

| Level | Trigger |
| --- | --- |
| `medium` | Strong anomaly + RAG corroboration |
| `low` | Anomaly without context |
| `none` | Calibration suggests false positive |

## Reference prompt

Active system prompt: [`src/agents/prompts/generic.md`](../../prompts/generic.md)

## Tier budgets

| Tier | max_tokens | RAG snippets |
| --- | --- | --- |
| `fast` | 300 | 1 |
| `standard` | 500 | 2 |
| `deep` | 700 | 4 |
