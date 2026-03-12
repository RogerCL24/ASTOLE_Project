"""
Test ChromaDB Manager
"""

import sys
from pathlib import Path

# Añadir src/ al path
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from memory.chromadb_manager import MemoryManager
import pandas as pd

print("🧪 Testing MemoryManager...\n")

# Crear manager
manager = MemoryManager()

# Cargar CSV de Ing1
csv_path = Path(__file__).resolve().parents[3] / "docs" / "samples" / "raw_sample_53_cols.csv"
df = pd.read_csv(csv_path)

print(f"📊 CSV cargado: {len(df)} filas\n")

# Indexar primera ventana (filas 0-9)
window_1 = df.iloc[0:10]
manager.add_netflow_window("test_window_001", window_1)

# Indexar segunda ventana (filas 10-19)
window_2 = df.iloc[10:20]
manager.add_netflow_window("test_window_002", window_2)

# Indexar tercera ventana (filas 20-29)
window_3 = df.iloc[20:30]
manager.add_netflow_window("test_window_003", window_3)

print()

# Buscar ventanas con ataques
results = manager.search_similar("ataques Fuzzers", n_results=2)

print("📋 Resultados:")
for i, (id, metadata) in enumerate(zip(results['ids'][0], results['metadatas'][0])):
    print(f"  {i+1}. {id}")
    print(f"     Flujos: {metadata['flows_count']}, Ataques: {metadata['attacks_count']}")

print()

# Stats
stats = manager.get_stats()
print(f"📊 Stats: {stats}")

print("\n✅ Test completado")
