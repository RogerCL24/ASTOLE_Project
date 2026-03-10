# 📓 Record - ASTOLE - Memory & RAG

## [2026-03-09] - Hito: Milestone 1 Completado + Avance Milestone 2

**Responsable:** Ingeniero 3 (Andrea)

### Logros:

#### Milestone 1 (100% Completado):
- **Setup Completo**: ChromaDB instalado con persistencia local y Sentence Transformers (all-MiniLM-L6-v2).
- **MemoryManager**: Clase principal implementada con:
  - `add_netflow_window()`: Indexación de ventanas con embeddings
  - `search_similar()`: Búsqueda semántica en ChromaDB
  - `get_stats()`: Estadísticas de la base de datos
- **Integración Asíncrona con Ing1**: `index_window()` con cola (Queue + threading) para recepción no bloqueante.
- **Exploración Dataset V3**: Análisis de 100 filas con 55 columnas.
- **Ollama + Llama 3**: Instalación local para módulo investigación.
- **Dockerización**: Docker Compose con ChromaDB (puerto 8000).

#### Milestone 2 (60% Avanzado):
- **Indexación ventanas 60s**: `add_netflow_window()` convierte DataFrame → texto → embedding → ChromaDB.
- **Búsquedas semánticas**: `search_similar()` funcional con ranking por similitud.
- **Cola para Ing1**: `index_window()` con Queue (max 100 ventanas), worker thread background.

### Descubrimientos técnicos:

- Dataset V3: 55 columnas (no 53), distribución 82% benignos / 18% ataques.
- Etiquetas: `Label` binario, `Attack` categórico (invertidas).
- Cola permite a Ing1 enviar ventanas sin bloqueo (<0.001s retorno).
- ChromaDB en `src/memory/chromadb_data/` persiste entre ejecuciones.
- Sentence Transformers genera embeddings de 384 dimensiones.

### Siguientes pasos:

- **AST-52**: Reunión coordinación con Ing1 para integración definitiva.
- **AST-54**: Testing masivo con 100+ ventanas del dataset.
- **Milestone 3**: RAG Engine con `get_context_for_alert()` para Ing2.

---

## Estructura de Archivos
```
src/memory/
├── chromadb_manager.py       # MemoryManager principal
├── ingest_from_ing1.py        # index_window() con cola
├── explore_dataset.py         # Exploración dataset
├── test_chromadb.py           # Tests básicos
├── test_ollama.py             # Tests Ollama
├── chromadb_data/             # BD persistente (gitignored)
└── CHANGELOG.md               # Este archivo
