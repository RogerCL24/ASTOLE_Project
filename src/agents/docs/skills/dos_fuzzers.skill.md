---
name: dos_fuzzers
description: |-
  Use when an alert is classified as DoS or Fuzzers in NF-UNSW-NB15-v3.
  Detects SYN floods, UDP floods, slowloris, fuzz campaigns. Distinguishes
  attack patterns from legitimate volumetric spikes via flow asymmetry,
  TCP flags, and packet-rate heuristics. ALWAYS use this skill for the
  "DoS" or "Fuzzers" multiclass labels, even if the analyst could
  conceivably hand-craft a verdict.
trigger_labels: [DoS, Fuzzers]
attention: critical
---

# DoS / Fuzzers Skill

## When to use

Whenever the router selects this skill (`SKILL_MAP["DoS"]` or
`SKILL_MAP["Fuzzers"]`). Do NOT use this skill for:

- Reconnaissance fan-outs → `recon_analysis`
- Backdoor / C2 channels → `exploits_backdoor`
- Worm-like lateral propagation → `shellcode_worms`

## Strategy

| Signal | Where it comes from | Why it matters |
| --- | --- | --- |
| Packet/second ratio | `network_data.packets_in_per_second` | Volumetric indicator |
| In/out asymmetry | `network_data.flow_pkts_s` & `flow_byts_s` | DoS is typically unidirectional |
| Flow duration | `network_data.flow_duration` | Ultra-short = SYN flood; long = Slowloris |
| TCP flags | `network_data.tcp_flags` | SYN-only = SYN flood; many RST = port-scan fuzzing |
| Historical IP | `rag_context` | Sustained campaigns from same source |

## Subagents (parallel within skill)

| Subagent | Purpose |
| --- | --- |
| `volumetric_check` | Computes pps/byps and asymmetry indicators |
| `tcp_flag_check` | Detects SYN-flood / RST-storm patterns |
| `historical_check` | Correlates with prior DoS campaigns from RAG |

## RAG query template

```
Historical DoS or Fuzzers attacks from IP {src_ip} towards
{dst_ip}:{dst_port} in the last 60 seconds. Flows with high
packets-per-second ratio.
```

## External intelligence (MCP / tools)

| Tool | Used for |
| --- | --- |
| `ip_reputation_lookup(src_ip)` | Score amplification |
| `mitre_attack_lookup("DoS")` | Add MITRE techniques to recommendations |

## Output requirements

Strict JSON validating against `SkillAssessment`:

- `threat_type` ∈ {DoS, Fuzzers}
- `threat_level` ∈ {critical, high, medium, low, none}
- `is_real_threat`: bool
- `false_positive_probability`: float ∈ [0,1]
- `key_indicators`: list[str] — at least 1 volumetric signal
- `recommended_actions`: list[str] — concrete (rate-limit, block, etc.)
- `iocs`: list[str]
- `technical_detail`: ≤120 words (≤200 in `deep` tier)

## Threat-level rubric

| Level | Trigger |
| --- | --- |
| `critical` | >1000 pkts/s OR >10 attack flows on same destination in window |
| `high` | Clear DoS pattern, >100 pkts/s, sustained |
| `medium` | Suspicious volume, possibly legitimate (CDN, load test) |
| `low` | Low-volume fuzzing or anomaly without clear impact |

## Few-shot examples

| Input pattern | Expected verdict |
| --- | --- |
| SYN-only, high pps, repeated windows | `threat_level=critical`, `is_real_threat=true` |
| Short burst during deployment, no RAG recurrence | `threat_level=low`, `is_real_threat=false` |

## Reference prompt

Active system prompt: [`src/agents/prompts/dos_fuzzers.md`](../../prompts/dos_fuzzers.md)

## Tier budgets

| Tier | max_tokens | RAG snippets |
| --- | --- | --- |
| `fast` | 350 | 2 |
| `standard` | 600 | 3 |
| `deep` | 800 | 5 |

## Out of scope

- Final escalation decision (summarizer)
- Narrative generation (summarizer)
- Routing decisions (router)
