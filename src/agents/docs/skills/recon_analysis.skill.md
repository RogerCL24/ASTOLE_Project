---
name: recon_analysis
description: |-
  Use when an alert is classified as Reconnaissance or Analysis in
  NF-UNSW-NB15-v3. Detects port scans, fingerprinting, SQLi/XSS probes.
  Down-weight known monitoring traffic; up-weight when RAG shows historical
  follow-up exploitation.
trigger_labels: [Reconnaissance, Analysis]
attention: standard
---

# Reconnaissance / Analysis Skill

## When to use

Whenever the router selects this skill. Pre-exploitation phase.

## Strategy

| Signal | Why it matters |
| --- | --- |
| Wide port fan-out from one source | Port scanning |
| Repeated short flows on different ports | Fingerprinting |
| Anomalous URL parameters | SQLi / XSS probing |
| Known scanner IP from monitoring | Likely false positive |

## Subagents (parallel within skill)

| Subagent | Purpose |
| --- | --- |
| `port_scan_detector` | Fan-out / sweep detection |
| `web_probe_detector` | URL pattern anomalies |
| `scanner_allowlist_check` | Down-weight known monitoring traffic |

## External intelligence (MCP / tools)

| Tool | Used for |
| --- | --- |
| `ip_reputation_lookup(src_ip)` | Scanner-vs-malicious classification |
| `mitre_attack_lookup("Reconnaissance")` | TTP mapping |

## RAG query template

```
Reconnaissance or Analysis activity from {src_ip} hitting service
{l7_proto}. Historical scanning patterns or follow-up exploitation.
```

## Threat-level rubric

| Level | Trigger |
| --- | --- |
| `high` | Wide fan-out + RAG shows prior exploitation by same source |
| `medium` | Targeted probing with no prior context |
| `low` | Single anomaly, possibly monitoring |
| `none` | Allowlisted scanner IP |

## Reference prompt

Active system prompt: [`src/agents/prompts/recon_analysis.md`](../../prompts/recon_analysis.md)

## Tier budgets

| Tier | max_tokens | RAG snippets |
| --- | --- | --- |
| `fast` | 350 | 2 |
| `standard` | 600 | 3 |
| `deep` | 800 | 5 |
