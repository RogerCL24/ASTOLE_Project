# Changelog - ASTOLE Layer 1 (Agents)

## [0.1.0-int] - 2026-03-31

### Added
- **Integration Bridge**: Creado `bridge_test.py` para validar el flujo desde la Capa de Ingestión (JSON) hasta el Summarizer.
- **Normalización de Datos**: Script de test incluye lógica para adaptar el esquema de Ingestión al contrato de Agentes.

### Fixed
- **Contract Alignment**: Corregido `label_binary` en `input_schemas.py` de `str` a `int` para cumplir con el `contract.md` oficial.
- **Enum Serialization**: Corregido el formateo de `label_multiclass` en el Summarizer para evitar fugas de tipos de Python (`AttackCategory`) en la narrativa de la IA.
- **Output Mapping**: Corregida la visualización de `severity` en los tests de integración (mapeo a nivel de raíz del objeto de salida).

### Changed
- **Prompt Refinement**: Sincronizadas las claves de búsqueda entre el System Prompt y el código de Python (`suggested_queries` vs `investigation_queries`).