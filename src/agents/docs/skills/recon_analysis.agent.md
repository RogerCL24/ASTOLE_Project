---
name: recon_analysis
level: L2
parent: router
description: |-
  Specialized analyst for pre-exploitation reconnaissance and web-app
  probing. Detects port scans, fingerprinting, SQLi/XSS probes, and
  monitoring-tool false positives. Sensitive to fan-out patterns.
implementation: src/agents/agents/skills/recon_analysis.py
entrypoint: recon_analysis_skill
skill_bundle: src/agents/docs/skills/recon_analysis.skill.md
tools:
  - read_state
  - litellm.acompletion
  - rag_retrieve_with_count
user-invocable: false
agent-invocable: true
---

# Reconnaissance / Analysis Specialist (L2)

Pre-exploitation phase analyst. Full instructions in
[`SKILL.md`](../../skills/recon_analysis/SKILL.md).

## Hard rules

1. Differentiate scanning, probing, and legitimate monitoring traffic.
2. Down-weight allowlisted scanner IPs.
3. Up-weight when historical RAG context shows follow-up exploitation.
4. Strict JSON output.
