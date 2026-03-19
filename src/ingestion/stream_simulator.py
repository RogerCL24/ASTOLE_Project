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
    print("🚀 Iniciando Motor de Ingestión ASTOLE (v2.5)")
    print("📡 Conectado a ChromaDB (Docker) vía interface asíncrona.")
    print("-" * 50)

    total_count = 0
    total_flows = 0
    total_alerts = 0
    start_sim_time = time.time()
    latencies = []
    
    try:
        reader = pd.read_csv(DATASET_PATH, chunksize=50000)
        
        for chunk in reader:
            if total_count >= max_windows:
                break
            
            chunk['window_id'] = chunk['FLOW_START_MILLISECONDS'] // 60000
            grouped = chunk.groupby('window_id')

            for win_id, data in grouped:
                if total_count >= max_windows:
                    break
                    
                str_win_id = f"WIN_{int(win_id)}"
                current_flows = len(data)
                total_flows += current_flows

                # A. ENVIAR A RAG
                start_win = time.time()
                index_window(str_win_id, data)
                win_latency = time.time() - start_win
                latencies.append(win_latency)

                # B. TRIGGER DE ANOMALÍAS
                ataques = data[data['Label'] == 1]
                if not ataques.empty:
                    total_alerts += 1
                    trigger_alert(str_win_id, ataques.iloc[0])
                
                print(f"📦 [{total_count+1}/{max_windows}] Ventana {str_win_id} enviada | Flujos: {len(data)} | Alerta: {'SI' if not ataques.empty else 'NO'}")
                
                # C. ACTUALIZAR MÉTRICAS PARA ING 4 (DASHBOARD)
                save_system_metrics(total_count + 1, total_flows, total_alerts, latencies) # <--- ¡IMPORTANTE!

                time.sleep(0.1)
                total_count += 1 

    except Exception as e:
        print(f"❌ Error crítico en el simulador: {e}")

    # Retornamos los resultados para el reporte final
    return total_count, total_flows, total_alerts, latencies, start_sim_time # <--- Retorno para el main

def trigger_alert(window_id, row):
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
        },
        "technical_details": {
            "duration_ms": int(row['FLOW_DURATION_MILLISECONDS']),
            "in_bytes": int(row['IN_BYTES']),
            "out_bytes": int(row['OUT_BYTES']),
            "tcp_flags": int(row['TCP_FLAGS']),
            "in_pkts": int(row['IN_PKTS']),
            "out_pkts": int(row['OUT_PKTS'])
        }
    }
    
    with open(OUTPUT_ALERTS, 'w') as f:
        json.dump(alert, f, indent=4)

def save_system_metrics(win_count, total_flows, total_alerts, latencies):
    METRICS_PATH = BASE_DIR / "docs" / "samples" / "system_metrics.json"
    avg_latency = (sum(latencies) / len(latencies)) * 1000 if latencies else 0
    compression = (1 - (total_alerts / total_flows)) * 100 if total_flows > 0 else 0
    
    metrics = {
        "last_update": datetime.now().strftime('%Y-%m-%dT%H:%M:%SZ'),
        "performance": {
            "windows_processed": win_count,
            "total_flows_analyzed": total_flows,
            "total_alerts_triggered": total_alerts,
            "avg_latency_ms": round(avg_latency, 2),
            "compression_rate_percent": round(compression, 4)
        },
        "status": "RUNNING" if win_count < 100 else "COMPLETED"
    }

    with open(METRICS_PATH, 'w') as f:
        json.dump(metrics, f, indent=4)


if __name__ == "__main__":
    # 1. Ejecutar simulación
    win_count, total_flows, total_alerts, latencies, start_time = simulate_stream(max_windows=100)
    
    print("\n⏳ Esperando a que el worker de ChromaDB termine de indexar...")
    wait_for_completion()
    
    # 2. MOSTRAR REPORTE FINAL (Ahora sí, al final de todo y con variables reales) # <--- REORGANIZADO
    end_time = time.time()
    avg_lat = (sum(latencies) / len(latencies)) * 1000 if latencies else 0
    comp = (1 - (total_alerts / total_flows)) * 100 if total_flows > 0 else 0

    print("\n" + "="*40)
    print("📊 REPORTE FINAL DE RENDIMIENTO ASTOLE")
    print("="*40)
    print(f"✅ Ventanas procesadas:    {win_count}")
    print(f"📈 Flujos analizados:     {total_flows:,}")
    print(f"🚨 Alertas generadas:     {total_alerts}")
    print(f"📉 Tasa de Compresión:    {comp:.4f}%")
    print(f"⏱️ Latencia media/win:    {avg_lat:.2f} ms")
    print(f"🚀 Tiempo total sim:      {end_time - start_time:.2f} s")
    print("="*40)
    
    print("✅ Todo guardado. Cerrando ASTOLE de forma segura.")