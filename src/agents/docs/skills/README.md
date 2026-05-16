# ASTOLE Skills Catalogue

Each skill is a unit of specialist analysis owned by the Router (L1) and
executed as an L2 specialist. Artifacts are split by concern:

```
src/agents/
├── agents/skills/           # Python implementation
│   ├── base_skill.py
│   ├── subagents.py
│   ├── <name>.py
│   └── __init__.py
├── docs/skills/             # Documentation & definitions  ← YOU ARE HERE
│   ├── <name>.agent.md      # agent definition (YAML frontmatter)
│   ├── <name>.skill.md      # skill bundle (strategy, subagents, intel)
│   ├── _template.skill.md   # template for new skills
│   └── README.md            # this file
└── prompts/                 # LLM system prompts (loaded at runtime)
    └── <name>.md
```

## Catalogue

| Skill | Trigger labels | Attention | LLM | Subagents |
| --- | --- | --- | --- | --- |
| [`benign_guard`](./benign_guard.skill.md) | Benign | low | no | — |
| [`dos_fuzzers`](./dos_fuzzers.skill.md) | DoS, Fuzzers | critical | yes | volumetric_check, tcp_flag_check, historical_check |
| [`exploits_backdoor`](./exploits_backdoor.skill.md) | Exploits, Backdoor | critical | yes | port_signature_check, payload_pattern_check, c2_persistence_check |
| [`recon_analysis`](./recon_analysis.skill.md) | Reconnaissance, Analysis | standard | yes | port_scan_detector, web_probe_detector, scanner_allowlist_check |
| [`shellcode_worms`](./shellcode_worms.skill.md) | Shellcode, Worms | critical | yes | lateral_movement_check, payload_signature_check, outbreak_correlation |
| [`generic`](./generic.skill.md) | Generic | standard | yes | entropy_check, tls_fingerprint_check, correlation_check |

## Adding a new skill

Use [`_template.skill.md`](./_template.skill.md) and follow the registration
checklist at the bottom of that file.

## How a skill is invoked

```
Router (L1) selects skill → graph routes to skill_node (L2) →
skill runs subagents (parallel) + RAG pre-fetch + threat-intel (parallel) →
produces SkillAssessment → RAG enrichment correlates → Summarizer (L1)
```

## Token budget per skill (standard tier)

| Skill | Tokens (target) |
| --- | --- |
| benign_guard | 0 |
| generic | 500 |
| dos_fuzzers | 600 |
| recon_analysis | 600 |
| exploits_backdoor | 700 |
| shellcode_worms | 700 |
