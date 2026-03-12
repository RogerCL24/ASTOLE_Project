"""
Test Ingesta desde Ing1
"""

import sys
from pathlib import Path
import time

# Añadir src/ al path
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from memory.ingest_from_ing1 import index_window, get_queue_status
import pandas as pd

print("🧪 Testing index_window con cola...\n")

# Cargar CSV
csv_path = Path(__file__).resolve().parents[3] / "docs" / "samples" / "raw_sample_53_cols.csv"
df = pd.read_csv(csv_path)

print(f"📊 CSV cargado: {len(df)} filas\n")

# Simular Ing1 enviando 5 ventanas rápido
for i in range(5):
    window_id = f"window_{i+1:03d}"
    window_df = df.iloc[i*10:(i+1)*10]  # 10 filas cada ventana
    
    result = index_window(window_id, window_df)
    print(f"📤 {window_id}: {result['status']} (cola: {result.get('queue_size', 0)})")
    
    time.sleep(0.1)  # Ing1 va rápido

print("\n⏳ Esperando que worker procese...")
time.sleep(5)  # Dar tiempo al worker

# Ver estado final
status = get_queue_status()
print(f"\n📊 Estado final: {status}")

print("\n✅ Test completado")
