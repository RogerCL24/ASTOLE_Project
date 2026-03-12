# Memory & RAG Module

**Ingeniero 3:** Andrea Blanco  
**Stack:** ChromaDB + RAG + Chat con Llama 3 local

---

## 📋 Descripción

Sistema de memoria vectorial con ChromaDB para almacenamiento histórico de alertas, motor RAG para recuperación de contexto, y chat de investigación con Llama 3 local.

**Responsabilidades:**
- **Storage Feed:** Recibir e indexar ventanas de 60s desde Ing1
- **Context Feed:** Proveer contexto histórico a Ing2 para narrativas
- **Investigation:** Chat con Llama 3 para análisis interactivo 

---

## 📁 Archivos de Producción

### chromadb_manager.py

**Qué es:** Gestor de la base de datos vectorial ChromaDB.

**Qué hace:**
- Guarda ventanas de tráfico de red de 60 segundos
- Convierte datos a embeddings (vectores numéricos)
- Permite buscar ventanas similares por contenido semántico

**Funciones principales:**
```python
from memory.chromadb_manager import MemoryManager

manager = MemoryManager()

# Indexar ventana
manager.add_netflow_window("window_001", dataframe)

# Buscar ventanas similares
results = manager.search_similar("ataques SSH", n_results=5)

# Ver estadísticas
stats = manager.get_stats()
```

**Uso:**
- Ing1 envía ventanas → se indexan automáticamente
- RAG Engine busca contexto histórico aquí

---

### ingest_from_ing1.py

**Qué es:** Sistema de ingesta con cola para recibir ventanas desde Ing1.

**Qué hace:**
- Recibe ventanas de Ing1 sin bloquearlo
- Las encola en background (máximo 100)
- Un worker thread las indexa en ChromaDB

**Funciones principales:**
```python
from memory.ingest_from_ing1 import index_window

# Ing1 llama esto cuando genera cada ventana
result = index_window("window_042", window_dataframe)
# Returns: {'status': 'queued', 'window_id': 'window_042', 'queue_size': 5}
```

**Cómo Ing1 puede usarla:**
```python
# En el código de Ing1 (Roger)
from memory.ingest_from_ing1 import index_window

for window in generated_windows:
    result = index_window(window.id, window.dataframe)
    # Continúa inmediatamente, no espera
    # Worker procesa en paralelo
```

**Ventajas:**
- No bloquea a Ing1 (retorna en <0.001s)
- Procesa ventanas en background
- Cola de hasta 100 ventanas

---

## 📂 Carpetas

### tests/

**Qué se guarda:** Tests automatizados de todos los componentes.

**Archivos:**
- `test_chromadb_manager.py` - Test de indexación y búsqueda
- `test_ingest_from_ing1.py` - Test de cola e ingesta
- `test_chromadb_100_ventanas.py` - Test de escalabilidad (M2)
- Otros tests legacy

Ver documentación completa en [`tests/README.md`](tests/README.md)

---

### chromadb_data/

**Qué se guarda:** Base de datos persistente de ChromaDB.

**Contenido:**
- Archivos SQLite con metadatos
- Índices HNSW (búsqueda vectorial)
- Embeddings de todas las ventanas indexadas

**Importante:**
- ⚠️ NO commitear a Git (está en `.gitignore`)
- ⚠️ NO borrar esta carpeta (se pierden datos)
- ✅ ChromaDB lee/escribe automáticamente aquí

**Ubicación:** `src/memory/chromadb_data/`

---

## 🧪 Testing

Ver documentación completa de tests: [`tests/README.md`](tests/README.md)

---

## 📚 Documentación Adicional

- [`CHANGELOG.md`](CHANGELOG.md) - Historial de cambios detallado
- [`tests/README.md`](tests/README.md) - Documentación tests y resultados

---

**Última actualización:** 12 Marzo 2026
