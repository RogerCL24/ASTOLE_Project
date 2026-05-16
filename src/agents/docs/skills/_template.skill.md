---
name: _template
description: |-
  Template for new specialist skills. Copy this file as `<name>.skill.md`
  and the matching `<name>.agent.md`, then implement `<name>.py`.
  Register the skill in router.py SKILL_MAP and graph/workflow.py SKILL_NODES.
trigger_labels: []
attention: standard
---

# {Skill Name} Skill

## When to use

Describe the routing condition under which this skill is invoked. Mention
which sibling skills are intentionally NOT covering this case.

## Strategy

| Signal | Why it matters |
| --- | --- |
| ... | ... |

## Subagents (parallel within skill)

| Subagent | Purpose |
| --- | --- |
| `...` | `...` |

## External intelligence (MCP / tools)

| Tool | Used for |
| --- | --- |
| `mitre_attack_lookup` | TTP mapping |
| `ip_reputation_lookup` | Score amplification |
| `cve_lookup` | Vulnerable-service hypothesis |

## RAG query template

```
... use {src_ip}, {dst_ip}, {l7_proto}, {dst_port} placeholders ...
```

## Output requirements

- Strict JSON validating `SkillAssessment`.
- ≥1 `key_indicator`.
- ≥1 `recommended_action`.

## Threat-level rubric

| Level | Trigger |
| --- | --- |
| ... | ... |

## Reference prompt

`src/agents/prompts/<name>.md`

## Tier budgets

| Tier | max_tokens | RAG snippets |
| --- | --- | --- |
| `fast` | 350 | 2 |
| `standard` | 600 | 3 |
| `deep` | 800 | 5 |

## Registration checklist

1. Add `<name>.py` in `src/agents/agents/skills/`.
2. Add `<name>.agent.md` + `<name>.skill.md` in `src/agents/docs/skills/`.
3. Add prompt file `src/agents/prompts/<name>.md`.
4. Add label → skill mapping in `src/agents/agents/router.py::SKILL_MAP`.
5. Register node in `src/agents/graph/workflow.py::SKILL_NODES`.
6. Append entry to `src/agents/docs/skills/README.md`.
7. Add unit test in `src/agents/tests/test_pipeline.py`.
