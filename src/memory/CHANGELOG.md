# 📓 Record - ASTOLE - Memory & RAG

## [2026-05-22] - Hito: Milestone 3 y Milestone 4 Completados

**Responsable:** Ingeniero 3 (Andrea Blanco)

### Logros:

#### Milestone 3 — RAG Engine (100% Completado):
- **`rag_api.py`**: FastAPI en puerto 8001, endpoint `/query` compatible con Ing2 (Sergio).
  - Recibe `QueryRequest(query, top_k)` y devuelve `QueryResponse(snippets[])`
  - Modo mock con variable de entorno `RAG_USE_MOCK=true` para CI/CD
  - Offload a threadpool para no bloquear el event loop
- **`chromadb_manager.py`** actualizado:
  - IPs origen/destino y tipos de ataque en metadata para filtrado exacto con `where`
  - Soporte Docker (`CHROMA_HOST`, `CHROMA_PORT`) y local
  - Método `delete_collection()` para re-indexado limpio
  - `search_similar()` acepta filtro `where` opcional

#### Milestone 4 — Chat de Investigación (100% Completado):
- **`investigator.py`**: Agente de investigación local con llama3 via Ollama.
  - Resumen estadístico pre-calculado desde ChromaDB (puertos, hosts, tipos, timestamps)
  - Método `generate_recommendation()` para RECOMENDACIÓN en streaming
  - Historial de conversación por caso
- **`investigator_api.py`**: FastAPI en puerto 8003 con SSE streaming.
  - 9 tipos de preguntas con respuesta directa desde ChromaDB (sin modelo)
  - RECOMENDACIÓN siempre generada por llama3 en streaming real
  - Pausa inicial para que el analista vea los puntos de "pensando"
  - Limpieza de markdown en respuestas del modelo
- **`ingest_alerts.py`**: Indexa `live_alerts.json` en colección `alerts` de ChromaDB.
  - Filtrado exacto por `src_ip` para búsqueda instantánea por IP
  - Resumen estadístico: puertos únicos, tipos de ataque, hosts, timestamps

### Arquitectura M4 — Chat de Investigación:

```
Analista pregunta
       ↓
investigator_api.py (puerto 8003)
       ↓
¿Pregunta directa? (puertos, hosts, tipos, fechas...)
  SÍ → ChromaDB colección "alerts" → VEREDICTO + EVIDENCIA directo
      → llama3 genera RECOMENDACIÓN en streaming
  NO → llama3 con resumen estadístico → formato completo
       ↓
Frontend Next.js (SSE streaming)
```

### Colecciones ChromaDB:

| Colección | Contenido | Búsqueda |
|---|---|---|
| `netflow_windows` | Ventanas de 60s de tráfico completo | Semántica + filtro IP metadata |
| `alerts` | Alertas detectadas por GNN (Ing1) | Exacta por `src_ip` |

### Preguntas que responde el investigator:

**Respuesta directa (ChromaDB + llama3 para recomendación):**
1. ¿A qué puertos ha atacado esta IP?
2. ¿Qué tipos de ataque ha usado?
3. ¿A qué hosts ha atacado?
4. ¿Cuántos hosts ha comprometido?
5. ¿Cuál es el puerto más atacado?
6. ¿Qué host está en mayor riesgo?
7. ¿Cuándo fue el primer y último ataque?
8. ¿Cuántos ataques en total?
9. ¿Debo escalar este incidente?

**Respuesta via llama3 completo:**
- Preguntas de interpretación, patrones, contexto general

### Descubrimientos técnicos:

- Las IPs atacantes son minoría en cada ventana de 60s → búsqueda semántica en ventanas poco fiable para IPs concretas.
- La colección `alerts` (alertas ya filtradas) permite filtrado exacto y es más precisa.
- llama3 en CPU tarda ~30-120s; phi3:mini tarda ~15-30s con menor calidad.
- El resumen estadístico pre-calculado en Python (Counter) es más fiable que pedir al modelo que cuente.
- Streaming SSE con `asyncio.sleep(0.008)` da efecto de escritura natural.

### Ficheros de producción añadidos:

```
src/memory/
├── chromadb_manager.py     # Actualizado con metadata IPs y colección alerts
├── rag_api.py              # FastAPI puerto 8001 — contrato con Ing2
├── investigator.py         # Agente llama3 + resumen estadístico
├── investigator_api.py     # FastAPI puerto 8003 — SSE streaming
├── ingest_alerts.py        # Indexar live_alerts.json en colección alerts
frontend/app/api/investigator/
└── route.ts                # Proxy Next.js → puerto 8003
```

---

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

### Siguientes pasos (en aquel momento):

- **AST-52**: Reunión coordinación con Ing1 para integración definitiva.
- **AST-54**: Testing masivo con 100+ ventanas del dataset.
- **Milestone 3**: RAG Engine con `get_context_for_alert()` para Ing2.

---

## Estructura de Archivos
```
src/memory/
├── chromadb_manager.py       # MemoryManager principal
├── ingest_from_ing1.py       # index_window() con cola
├── rag_api.py                # RAG Engine para Ing2 (M3)
├── investigator.py           # Chat investigación llama3 (M4)
├── investigator_api.py       # API SSE streaming (M4)
├── ingest_alerts.py          # Indexar alertas GNN (M4)
├── chromadb_data/            # BD persistente (gitignored)
└── CHANGELOG.md              # Este archivo
```