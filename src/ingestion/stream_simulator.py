import pandas as pd
import time
import json
import random
from pathlib import Path
from datetime import datetime
import sys

BASE_DIR = Path(__file__).resolve().parents[2]
SRC_DIR = BASE_DIR / "src"

if str(SRC_DIR) not in sys.path:
    sys.path.insert(0, str(SRC_DIR))

from memory.ingest_from_ing1 import index_window, wait_for_completion

# Configuración de rutas
DATASET_PATH = BASE_DIR / "data" / "NF-UNSW-NB15-v3.csv"
OUTPUT_ALERTS = BASE_DIR / "docs" / "samples" / "live_alerts.json"

def simulate_stream(max_windows=100):
    print("🚀 Iniciando Motor de Ingestión ASTOLE (Milestone 2)")
    print("📡 Conectado a ChromaDB (Docker) vía interface asíncrona.")
    print("-" * 50)

    # CONTADOR GLOBAL (fuera del loop de chunks)
    total_count = 0

    # --- Inicializar métricas ---
    total_flows = 0
    total_alerts = 0
    start_sim_time = time.time()
    latencies = []
    
    try:
        # 1. Carga eficiente del dataset
        # Usamos chunksize por si el archivo es gigante
        reader = pd.read_csv(DATASET_PATH, chunksize=50000)
        
        for chunk in reader:

            # Si ya procesamos suficientes ventanas, salir del loop de chunks
            if total_count >= max_windows:
                break
            
            # 2. Lógica de Agrupación Temporal (Issue 1 del M2)
            # Creamos el ID de ventana basado en bloques de 60 segundos
            chunk['window_id'] = chunk['FLOW_START_MILLISECONDS'] // 60000
            
            grouped = chunk.groupby('window_id')
            

            for win_id, data in grouped:
                # Verificar límite GLOBAL
                if total_count >= max_windows:
                    print("✅ Simulación completada (límite de ventanas alcanzado).")
                    break
                    
                str_win_id = f"WIN_{int(win_id)}"
                
                # 1. Acumular métricas por ventana
                current_flows = len(data)
                total_flows += current_flows

                # A. ENVIAR A RAG (Ingeniero 3) - 55 columnas
                # Ingesta masiva optimizada (Issue 3 del M2)
                start_win = time.time()
                result = index_window(str_win_id, data)
                win_latency = time.time() - start_win
                latencies.append(win_latency)

                print(f"⏱️ Latencia de indexación: {win_latency:.4f}s")

                # B. TRIGGER DE ANOMALÍAS (Issue 2 del M2)
                # Si hay algún Label == 1, generamos la alerta para Ing 2
                ataques = data[data['Label'] == 1]

                if not ataques.empty:
                    total_alerts += 1
                    trigger_alert(str_win_id, ataques.iloc[0])
                
                print(f"📦 Ventana {str_win_id} enviada | Flujos: {len(data)} | Alerta: {'SI' if not ataques.empty else 'NO'}")
                
                # Pequeño sleep para que podamos ver el progreso en consola
                # En producción esto sería tiempo real
                time.sleep(0.1)

                total_count += 1  # Incrementar contador GLOBAL              
    except Exception as e:
        print(f"❌ Error crítico en el simulador: {e}")

    print(f"\n📊 Total ventanas procesadas: {total_count}")

    # --- REPORTE FINAL ---
    end_sim_time = time.time()

    if latencies:
        avg_latency = (sum(latencies) / len(latencies)) * 1000  # en ms
    else:
        avg_latency = 0.0

    # Cálculo de la Tasa de Compresión
    # $$Compression = 1 - \frac{Total\_Alerts}{Total\_Flows}$$
    compression = (1 - (total_alerts / total_flows)) * 100 if total_flows > 0 else 0.0

    print("\n" + "="*40)
    print("📊 REPORTE DE RENDIMIENTO ASTOLE")
    print("="*40)
    print(f"✅ Ventanas procesadas:    {max_windows}")
    print(f"📈 Flujos analizados:     {total_flows:,}")
    print(f"🚨 Alertas generadas:     {total_alerts}")
    print(f"📉 Tasa de Compresión:    {compression:.4f}%")
    print(f"⏱️ Latencia media/win:    {avg_latency:.2f} ms")
    print(f"🚀 Tiempo total sim:      {end_sim_time - start_sim_time:.2f} s")
    print("="*40)

def trigger_alert(window_id, row):
    """Genera el JSON según el CONTRACT.md para el Ingeniero 2"""
    ts_ms = float(row['FLOW_START_MILLISECONDS'])
    dt_object = datetime.fromtimestamp(ts_ms / 1000.0)
    
    simulated_confidence = round(random.uniform(0.92, 0.99), 2)

    alert = {
        "alert_id": f"AST-{window_id}-{int(ts_ms)}",
        "timestamp": dt_object.strftime('%Y-%m-%dT%H:%M:%SZ'),
        "gnn_metadata": {
            "label_multiclase": str(row['Attack']),
            "binary_attack": int(row['Label']),
            "confidence_score": simulated_confidence
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
    
    wait_for_completion()
   
    print("✅ Todo guardado. Cerrando ASTOLE de forma segura.")

