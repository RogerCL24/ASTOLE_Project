# ASTOLE Pull Request

## Summary

<!-- 1-3 bullets describing the why and the scope of this PR -->

## Pipeline impact

- [ ] Touches `Router` (`src/agents/agents/router.py` or `SKILL_MAP`)
- [ ] Touches `Skill` (`src/agents/agents/skills/*` or `prompts/*.md`)
- [ ] Touches `RAG enrichment` (`src/agents/graph/rag_node.py`)
- [ ] Touches `Summarizer` (`src/agents/agents/summarizer.py`)
- [ ] Touches `Contracts` (`src/agents/models/*.py` or `docs/specs/CONTRACT.md`)
- [ ] Touches `Docker / Compose / CI`

## Multi-agent pipeline checklist

- [ ] All new agents include a `*.agent.md` with valid YAML frontmatter
- [ ] All new skills include a `*.skill.md` with valid YAML frontmatter
- [ ] Handoff is emitted (5-block) and circuit breaker invariants hold
- [ ] `[PLAN_VACIO]` / `[ERROR]` is correctly distinguished
- [ ] Updated `AGENTS.md` and `src/agents/agents/skills/README.md` if a skill was added

## Tests

- [ ] `pytest src/agents/tests` passes locally
- [ ] `ci-tests` workflow is green
- [ ] `ci-docker-smoke` is green (if Docker / runtime touched)
- [ ] `ci-agent-md-validate` is green (if Markdown agents/skills touched)
- [ ] `ci-contract-validation` is green (if contracts touched)

## Documentation

- [ ] Updated `CHANGELOG.md`
- [ ] Updated `ARCHITECTURE.md` if architecture changed
- [ ] Added or updated diagrams in Mermaid where relevant

## Closes

<!-- Closes #123 -->
