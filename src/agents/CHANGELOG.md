# Changelog - ASTOLE Layer 1 (Agents)

## [0.3.0-docs] - 2026-04-09

### Added (0.3.0-docs)

- **Documentation Hub**: Created `src/agents/README.md` as index for Layer 1 docs.
- **Docs Folder**: Added `src/agents/docs/` with complete technical/operational documentation:
  - `DOCKER_DEPLOYMENT.md`
  - `OPERATIONS.md`
  - `CONTRACTS_AND_API.md`
  - `SKILLS_AND_PROMPTS.md`
  - `OBSERVABILITY.md`
- **Mermaid Diagrams**: Added architecture, runtime, sequence, and operations diagrams.

### Changed (0.3.0-docs)

- **Architecture Doc**: Updated `ARCHITECTURE.md` with dockerized boundary and references to full docs.
- **Layer Scope Clarification**: Explicitly documented that Layer 1 is deployed and managed dockerized to integrate with all other ASTOLE layers.

## [0.1.0-int] - 2026-03-31

### Added (0.1.0-int)

- **Integration Bridge**: Creado `bridge_test.py` para validar el flujo desde la Capa de Ingestión (JSON) hasta el Summarizer.
- **Normalización de Datos**: Script de test incluye lógica para adaptar el esquema de Ingestión al contrato de Agentes.

### Fixed (0.1.0-int)

- **Contract Alignment**: Corregido `label_binary` en `input_schemas.py` de `str` a `int` para cumplir con el `contract.md` oficial.
- **Enum Serialization**: Corregido el formateo de `label_multiclass` en el Summarizer para evitar fugas de tipos de Python (`AttackCategory`) en la narrativa de la IA.
- **Output Mapping**: Corregida la visualización de `severity` en los tests de integración (mapeo a nivel de raíz del objeto de salida).

### Changed (0.1.0-int)

- **Prompt Refinement**: Sincronizadas las claves de búsqueda entre el System Prompt y el código de Python (`suggested_queries` vs `investigation_queries`).
