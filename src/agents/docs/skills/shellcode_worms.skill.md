---
name: shellcode_worms
description: |-
  Use when an alert is classified as Shellcode or Worms in NF-UNSW-NB15-v3.
  High-impact, low-frequency families. Lateral fan-out → assume worm.
  Recommend immediate containment.
trigger_labels: [Shellcode, Worms]
attention: critical
---

# Shellcode / Worms Skill

## When to use

Whenever the router selects this skill. Treat as high-impact even when
confidence is moderate — false negatives are extremely costly here.

## Strategy

| Signal | Why it matters |
| --- | --- |
| Lateral fan-out (multiple internal destinations) | Worm propagation |
| Single payload with executable signature | Shellcode injection |
| Internal-to-internal flow with off-hours timestamp | Active outbreak |

## Subagents (parallel within skill)

| Subagent | Purpose |
| --- | --- |
| `lateral_movement_check` | Detects fan-out to multiple internal IPs |
| `payload_signature_check` | Executable-pattern match in payload size + entropy |
| `outbreak_correlation` | RAG/window correlation for active campaigns |

## External intelligence (MCP / tools)

| Tool | Used for |
| --- | --- |
| `cve_lookup(l7_proto, dst_port)` | Candidate vuln behind shellcode |
| `mitre_attack_lookup("Worms")` | Map to lateral-movement TTPs |

## RAG query template

```
Shellcode or worm propagation history involving {src_ip}, similar
payload sizes or lateral movement patterns from {l7_proto}.
```

## Threat-level rubric

| Level | Trigger |
| --- | --- |
| `critical` | Lateral fan-out → worm |
| `high` | Single payload + service-vulnerability hypothesis |
| `medium` | Suspicious payload without corroboration |
| `low` | Anomalous but isolated |

## Reference prompt

Active system prompt: [`src/agents/prompts/shellcode_worms.md`](../../prompts/shellcode_worms.md)

## Tier budgets

| Tier | max_tokens | RAG snippets |
| --- | --- | --- |
| `fast` | 400 | 2 |
| `standard` | 700 | 3 |
| `deep` | 800 | 5 |
