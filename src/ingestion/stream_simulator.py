import pandas as pd
import time
import json
from pathlib import Path
from datetime import datetime
import sys
from memory.ingest_from_ing1 import index_window, get_queue_status, _window_queue

# Ensure `src/` is on sys.path so imports like `from memory...` work when
# executing the script directly (not as a package).
BASE_DIR = Path(__file__).resolve().parents[2]
SRC_DIR = BASE_DIR / "src"
sys.path.insert(0, str(SRC_DIR))

# Configuración de rutas
DATASET_PATH = BASE_DIR / "data" / "NF-UNSW-NB15-v3.csv"
OUTPUT_ALERTS = BASE_DIR / "docs" / "samples" / "live_alerts.json"

def simulate_stream():
    print("🚀 Iniciando Motor de Ingestión ASTOLE (Milestone 2)")
    print("📡 Conectado a ChromaDB (Docker) vía interface asíncrona.")
    print("-" * 50)

    try:
        # 1. Carga eficiente del dataset
        # Usamos chunksize por si el archivo es gigante
        reader = pd.read_csv(DATASET_PATH, chunksize=50000)
        
        for chunk in reader:
            # 2. Lógica de Agrupación Temporal (Issue 1 del M2)
            # Creamos el ID de ventana basado en bloques de 60 segundos
            chunk['window_id'] = chunk['FLOW_START_MILLISECONDS'] // 60000
            
            grouped = chunk.groupby('window_id')
            
            max_windows = 20
            count = 0
            for win_id, data in grouped:
                if count >= max_windows:
                    print("✅ Simulación completada (límite de ventanas alcanzado).")
                    break

                str_win_id = f"WIN_{int(win_id)}"
                
                # A. ENVIAR A RAG (Ingeniero 3) - 55 columnas
                # Ingesta masiva optimizada (Issue 3 del M2)
                result = index_window(str_win_id, data)
                
                # B. TRIGGER DE ANOMALÍAS (Issue 2 del M2)
                # Si hay algún Label == 1, generamos la alerta para Ing 2
                ataques = data[data['Label'] == 1]
                
                if not ataques.empty:
                    trigger_alert(str_win_id, ataques.iloc[0])
                
                print(f"📦 Ventana {str_win_id} enviada | Flujos: {len(data)} | Alerta: {'SI' if not ataques.empty else 'NO'}")
                
                # Pequeño sleep para que podamos ver el progreso en consola
                # En producción esto sería tiempo real
                time.sleep(0.1)
                count += 1

    except Exception as e:
        print(f"❌ Error crítico en el simulador: {e}")

def trigger_alert(window_id, row):
    """Genera el JSON según el CONTRACT.md para el Ingeniero 2"""
    ts_ms = float(row['FLOW_START_MILLISECONDS'])
    dt_object = datetime.fromtimestamp(ts_ms / 1000.0)
    
    alert = {
        "alert_id": f"AST-{window_id}-{int(ts_ms)}",
        "timestamp": dt_object.strftime('%Y-%m-%dT%H:%M:%SZ'),
        "gnn_metadata": {
            "label_multiclase": str(row['Attack']),
            "binary_attack": int(row['Label']),
            "confidence_score": 0.98 # Simulado por el momento
        },
        "network_data": {
            "src_ip": str(row['IPV4_SRC_ADDR']),
            "dst_ip": str(row['IPV4_DST_ADDR']),
            "src_port": int(row['L4_SRC_PORT']),
            "dst_port": int(row['L4_DST_PORT']),
            "protocol": int(row['PROTOCOL']),
            "l7_proto": float(row['L7_PROTO'])
        }
    }
    
    # Guardamos la alerta "en vivo" para que el Ing 2 la lea
    with open(OUTPUT_ALERTS, 'w') as f:
        json.dump(alert, f, indent=4)

if __name__ == "__main__":
    simulate_stream()
    
    print("\n⏳ Esperando a que el worker de ChromaDB termine de indexar...")
    
    # Esta función bloquea el cierre del programa hasta que la cola esté vacía
    _window_queue.join() 
    
    print("✅ Todo guardado. Cerrando ASTOLE de forma segura.")