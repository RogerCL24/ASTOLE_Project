# Memory & RAG Module

**Ingeniero 3:** Andrea Blanco  
**Stack:** ChromaDB + RAG + Chat con Llama 3 local

---

## 📋 Descripción

Sistema de memoria vectorial con ChromaDB para almacenamiento histórico de alertas, motor RAG para recuperación de contexto, y chat de investigación con Llama 3 local.

**Responsabilidades:**
- **Storage Feed (M2):** Recibir e indexar ventanas de 60s desde Ing1
- **Context Feed (M3):** Proveer contexto histórico a Ing2 para narrativas
- **Investigation (M4):** Chat con Llama 3 para análisis interactivo de incidentes

---

## 📁 Archivos de Producción

### chromadb_manager.py

**Qué es:** Gestor de la base de datos vectorial ChromaDB.

**Qué hace:**
- Guarda ventanas de tráfico de red de 60 segundos con embeddings semánticos
- Guarda metadata de IPs y tipos de ataque para filtrado exacto
- Permite búsqueda semántica y filtrada por IP

**Funciones principales:**
```python
from memory.chromadb_manager import MemoryManager

manager = MemoryManager()
manager.add_netflow_window("window_001", dataframe)
results = manager.search_similar("ataques SSH", n_results=5)
results_filtered = manager.search_similar("ataque", where={"top_src_ips": {"$contains": "1.2.3.4"}})
stats = manager.get_stats()
```

**Colecciones ChromaDB:**

| Colección | Contenido | Quién la usa |
|---|---|---|
| `netflow_windows` | Ventanas de 60s de tráfico completo | Ing2 via rag_api, Investigator |
| `alerts` | Alertas detectadas por GNN | Investigator (M4) |

---

### ingest_from_ing1.py

**Qué es:** Sistema de ingesta con cola para recibir ventanas desde Ing1.

**Qué hace:**
- Recibe ventanas de Ing1 sin bloquearlo (retorna en <0.001s)
- Las encola en background (máximo 100)
- Un worker thread las indexa en ChromaDB

```python
from memory.ingest_from_ing1 import index_window
result = index_window("window_042", window_dataframe)
# Returns: {'status': 'queued', 'window_id': 'window_042'}
```

---

### rag_api.py (M3)

**Qué es:** API REST que expone ChromaDB a Ing2 (Sergio).

**Puerto:** 8001  
**Endpoint principal:** `POST /query`

```python
# Contrato con Ing2
POST /query
{"query": "ataques DoS IP 1.2.3.4", "top_k": 5}
→ {"snippets": ["Ventana WIN_XXX: ...", ...]}
```

**Arranque:**
```bash
python src/memory/rag_api.py
# Con mock para CI: RAG_USE_MOCK=true python src/memory/rag_api.py
```

---

### investigator.py (M4)

**Qué es:** Agente de investigación local con Llama 3 via Ollama.

**Qué hace:**
- Pre-calcula resumen estadístico de alertas por IP (puertos, hosts, tipos, fechas)
- Genera RECOMENDACIÓN en streaming con llama3
- Mantiene historial de conversación por caso

**Arranque CLI:**
```bash
ollama serve  # En otra terminal
python src/memory/investigator.py
```

---

### investigator_api.py (M4)

**Qué es:** API FastAPI con SSE streaming para el frontend de Ing4.

**Puerto:** 8003  
**Endpoint principal:** `POST /chat`

```json
POST /chat
{
  "question": "¿A qué puertos ha atacado esta IP?",
  "case_id": "AST-WIN_23737707-...",
  "src_ip": "175.45.176.0",
  "attack_type": "Backdoor",
  "dst_port": "53",
  "dst_ip": "149.171.126.10",
  "frequency": 249,
  "victims": 9
}
→ SSE stream con tokens
```

**Lógica de respuesta:**

```
Pregunta directa (puertos, hosts, tipos, fechas, escalada)
  → ChromaDB colección "alerts" → VEREDICTO + EVIDENCIA
  → llama3 genera RECOMENDACIÓN en streaming

Pregunta abierta (interpretación, patrones)
  → llama3 con resumen estadístico completo
```

**Arranque:**
```bash
python src/memory/investigator_api.py
```

---

### ingest_alerts.py (M4)

**Qué es:** Script para indexar `live_alerts.json` en ChromaDB colección `alerts`.

**Cuándo ejecutarlo:** Después de correr el simulador, antes de usar el investigator.

```bash
python src/memory/ingest_alerts.py
```

---

## 🚀 Arranque Completo del Módulo

```bash
# 1. Activar entorno
venv\Scripts\activate  # Windows
source venv/bin/activate  # Linux/Mac

# 2. Arrancar Ollama
ollama serve

# 3. Correr el simulador (genera ventanas + alertas)
python src/ingestion/stream_simulator.py

# 4. Indexar alertas en ChromaDB
python src/memory/ingest_alerts.py

# 5. Arrancar APIs
python src/memory/rag_api.py          # Puerto 8001 (para Ing2)
python src/memory/investigator_api.py  # Puerto 8003 (para Ing4)
```

---

## 📂 Carpetas

### chromadb_data/

Base de datos persistente de ChromaDB. ⚠️ No commitear a Git (en `.gitignore`).

---

## 📚 Documentación Adicional

- [`CHANGELOG.md`](CHANGELOG.md) - Historial de cambios detallado
- [`tests/README.md`](tests/README.md) - Documentación tests y resultados

---

**Última actualización:** 22 Mayo 2026