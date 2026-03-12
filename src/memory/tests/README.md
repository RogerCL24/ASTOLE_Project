# Tests - Memory & RAG Module

Esta carpeta contiene tests automatizados para verificar el funcionamiento correcto del módulo de memoria.

---

## 📋 Tests Disponibles

### test_chromadb_manager.py

**Qué verifica:**
- Inicialización de ChromaDB
- Indexación de ventanas
- Búsqueda semántica
- Estadísticas

**Ejecutar:**
```bash
python src/memory/tests/test_chromadb_manager.py
```

**Resultado esperado:**
```
🧪 Testing MemoryManager...
✅ MemoryManager listo
📊 CSV cargado: 100 filas
✅ test_window_001 indexada
✅ test_window_002 indexada
✅ test_window_003 indexada
✅ Encontrados 2 resultados
📋 Resultados:
  1. window_004
     Flujos: 10, Ataques: 3
  2. window_003
     Flujos: 10, Ataques: 1
📊 Stats: {'total_windows': 8, 'collection_name': 'netflow_windows'}
✅ Test completado
```

**Estado:** ✅ PASS (12 Mar 2026)

---

### test_ingest_from_ing1.py

**Qué verifica:**
- Worker thread se inicia automáticamente
- Cola encola ventanas correctamente
- Worker procesa ventanas en background
- Cola se vacía después de procesar

**Ejecutar:**
```bash
python src/memory/tests/test_ingest_from_ing1.py
```

**Resultado esperado:**
```
🧪 Testing index_window con cola...
📊 CSV cargado: 100 filas
✅ Worker thread iniciado
📤 window_001: queued (cola: 1)
📤 window_002: queued (cola: 2)
📤 window_003: queued (cola: 3)
📤 window_004: queued (cola: 4)
📤 window_005: queued (cola: 5)
⏳ Esperando que worker procese...
🔄 Worker ChromaDB iniciado
✅ window_001 indexada
✅ window_002 indexada
✅ window_003 indexada
✅ window_004 indexada
✅ window_005 indexada
📊 Estado final: {'queue_size': 0, 'worker_alive': True}
✅ Test completado
```

**Estado:** ✅ PASS (12 Mar 2026)

---

### test_chromadb_100_ventanas.py

**Qué verifica:**
- Escalabilidad de ChromaDB (Milestone 2)
- Indexación de 20, 50, 100 ventanas
- Tiempos de indexación y búsqueda
- Velocidad de procesamiento

**Ejecutar:**
```bash
python src/memory/tests/test_chromadb_100_ventanas.py
```

**Resultado esperado:**
```
🎯 SUITE DE TESTS - AST-54

🧪 TEST 1/3: LIGERO (20 ventanas × 500 filas)
✅ Indexación completada: 1.57s
   Velocidad: 12.77 ventanas/s

🧪 TEST 2/3: MEDIO (50 ventanas × 1,000 filas)
✅ Indexación completada: 5.23s
   Velocidad: 9.57 ventanas/s

🧪 TEST 3/3: PESADO (100 ventanas × 1,000 filas)
✅ Indexación completada: 11.23s
   Velocidad: 8.91 ventanas/s

📊 RESUMEN COMPARATIVO
Ventanas     Filas        T.Index      T.Búsq       Vel.
20           10,000       1.57s        0.48s        12.77 v/s
50           50,000       5.23s        0.43s        9.57 v/s
100          100,000      11.23s       0.42s        8.91 v/s

✅ TESTING COMPLETADO - AST-54
```

**Estado:** ✅ PASS (12 Mar 2026)  

---

### test_chromadb.py

**Qué verifica:**
- Test básico de ChromaDB (legacy M1)
- Inicialización simple

**Ejecutar:**
```bash
python src/memory/tests/test_chromadb.py
```

**Estado:** ✅ PASS (legacy - M1)

---

### test_ollama.py

**Qué verifica:**
- Conexión con Ollama funciona
- Llama 3 responde correctamente

**Ejecutar:**
```bash
# Primero iniciar Ollama
ollama serve

# Luego ejecutar test
python src/memory/tests/test_ollama.py
```

**Resultado esperado:**
```
✅ Ollama conectado
✅ Llama 3 responde
Respuesta: [texto generado por Llama 3]
```

**Estado:** ✅ PASS (12 Mar 2026)

---

### explore_dataset.py

**Qué hace:**
- Explora estructura del Dataset V3
- Muestra filas, columnas, distribución

**Ejecutar:**
```bash
python src/memory/tests/explore_dataset.py
```

**Resultado esperado:**
```
📊 Dataset NF-UNSW-NB15-v3
Filas: 100
Columnas: 55
Ataques: 18 (18%)
Benignos: 82 (82%)
Tipos: Fuzzers (16), Exploits (2)
```

**Estado:** ✅ Informativo

---

## 📊 Resumen Estado Tests

| Test | Estado | Última Ejecución |
|------|--------|------------------|
| test_chromadb_manager.py | ✅ PASS | 12 Mar 2026 |
| test_ingest_from_ing1.py | ✅ PASS | 12 Mar 2026 |
| test_rag_engine.py | ✅ PASS | 12 Mar 2026 |
| test_chromadb_100_ventanas.py | ✅ PASS | 12 Mar 2026 |
| test_chromadb.py | ✅ PASS | Legacy M1 |
| test_ollama.py | ✅ PASS | 12 Mar 2026 |
| explore_dataset.py | ✅ Info | 12 Mar 2026 |

**Total:** 7/7 tests passing ✅

---

## 🐛 Troubleshooting

**Error: "No such file"**
```bash
# Ejecutar desde raíz del proyecto
cd ~/Desktop/Proyectos/ASTOLE_Project
python src/memory/tests/test_chromadb_manager.py
```

**Error: "Connection refused" (Ollama)**
```bash
# Iniciar Ollama primero
ollama serve
# Luego ejecutar test
python src/memory/tests/test_ollama.py
```

**Warning: "UNEXPECTED embeddings.position_ids"**
- Normal, se puede ignorar
- No afecta funcionamiento

---

**Última actualización:** 12 Marzo 2026  
**Estado general:** Todos los tests passing ✅
