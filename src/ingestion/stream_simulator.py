import pandas as pd
import time
import json
import random
import os
import tempfile
from pathlib import Path
from datetime import datetime, timezone
import sys

BASE_DIR = Path(__file__).resolve().parents[2]
SRC_DIR = BASE_DIR / "src"
SIMULATION_CONFIG_PATH = BASE_DIR / "simulation_config.json"

if str(SRC_DIR) not in sys.path:
    sys.path.insert(0, str(SRC_DIR))

from memory.ingest_from_ing1 import index_window, wait_for_completion

try:
    from services.ip_intel_service import IPIntelService

    _IP_INTEL = IPIntelService.get_instance()
except Exception:
    _IP_INTEL = None

# Configuración de rutas
DATASET_PATH = BASE_DIR / "data" / "NF-UNSW-NB15-v3.csv"
OUTPUT_ALERTS = BASE_DIR / "docs" / "samples" / "live_alerts.json"
OUTPUT_METRICS = BASE_DIR / "docs" / "samples" / "system_metrics.json"
MAX_HISTORY_ITEMS = 1000


def _utc_now_z() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def atomic_write_json(path: Path, payload, *, indent: int = 4) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)

    fd, tmp_path = tempfile.mkstemp(prefix=f".{path.name}.", suffix=".tmp", dir=str(path.parent))
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as f:
            json.dump(payload, f, indent=indent)
            f.write("\n")

        os.replace(tmp_path, path)
    finally:
        try:
            os.unlink(tmp_path)
        except FileNotFoundError:
            pass


def reset_output_files():
    initial_metrics = {
        "last_update": _utc_now_z(),
        "performance": {
            "windows_processed": 0,
            "total_flows_analyzed": 0,
            "total_alerts_triggered": 0,
            "avg_latency_ms": 0,
            "compression_rate_percent": 0,
            "traffic_history": [],
            "latency_history_ms": [],
        },
        "status": "RUNNING",
    }

    atomic_write_json(OUTPUT_ALERTS, [], indent=4)
    atomic_write_json(OUTPUT_METRICS, initial_metrics, indent=4)


def load_simulation_config():
    default_config = {
    "speed": 1,
    "last_updated": None,
    "mode": "normal",
    }

    try:
        with open(SIMULATION_CONFIG_PATH, "r") as config_file:
            config = json.load(config_file)
            if isinstance(config, dict):
                return {**default_config, **config}
    except FileNotFoundError:
        pass
    except json.JSONDecodeError:
        print("⚠️ simulation_config.json inválido. Usando velocidad por defecto.")

    return default_config


def normalize_simulation_start_state():
    config = load_simulation_config()
    if str(config.get("status", "RUNNING")).upper() != "STOPPED":
        return config

    reset_config = {
        **config,
        "status": "RUNNING",
        "action": None,
        "mode": "fast-forward" if str(config.get("speed", 1)).upper() == "MAX" else "normal",
        "last_updated": _utc_now_z(),
    }

    try:
        atomic_write_json(SIMULATION_CONFIG_PATH, reset_config, indent=2)
    except OSError:
        print("⚠️ No se pudo normalizar simulation_config.json al arrancar.")

    return reset_config


def is_simulation_stopped(config=None):
    if config is None:
        config = load_simulation_config()

    return str(config.get("status", "RUNNING")).upper() == "STOPPED"


def get_window_target_seconds(config=None):
    if config is None:
        config = load_simulation_config()

    speed = config.get("speed", 1)

    if str(speed).upper() == "MAX" or config.get("mode") == "fast-forward":
        return 1.0

    try:
        speed_value = float(speed)
    except (TypeError, ValueError):
        speed_value = 1.0

    if speed_value <= 0:
        speed_value = 1.0

    simulated_window_seconds = 60.0
    return max(simulated_window_seconds / speed_value, 1.0)


def get_speed_label(config):
    speed = config.get("speed", 1)

    if str(speed).upper() == "MAX" or config.get("mode") == "fast-forward":
        return "MAX"

    return f"{speed}x"


def wait_for_stop_or_delay(target_seconds):
    elapsed = 0.0
    poll_interval = 0.5

    while elapsed < target_seconds:
        config = load_simulation_config()
        if is_simulation_stopped(config):
            return True

        step = min(poll_interval, target_seconds - elapsed)
        time.sleep(step)
        elapsed += step

    return False


def simulate_stream():
    print("🚀 Iniciando Motor de Ingestión ASTOLE (v2.5)")
    print("📡 Conectado a ChromaDB (Docker) vía interface asíncrona.")
    print("-" * 50)

    reset_output_files()
    normalize_simulation_start_state()

    total_count = 0
    total_flows = 0
    total_alerts = 0
    dropped_windows = 0
    start_sim_time = time.time()
    latencies = []
    
    try:
        while True:
            speed_config = load_simulation_config()
            if is_simulation_stopped(speed_config):
                print("🛑 Señal STOP recibida. Finalizado")
                save_system_metrics(total_count, total_flows, total_alerts, latencies, status="STOPPED")
                return total_count, total_flows, total_alerts, latencies, start_sim_time, dropped_windows

            reader = pd.read_csv(DATASET_PATH, chunksize=50000)
            chunk_index = 0

            for chunk in reader:
                chunk_index += 1
                print(f"📚 Leyendo bloque {chunk_index} del dataset | filas: {len(chunk):,}")

                chunk['window_id'] = chunk['FLOW_START_MILLISECONDS'] // 60000
                grouped = chunk.groupby('window_id')

                for win_id, data in grouped:
                    speed_config = load_simulation_config()
                    if is_simulation_stopped(speed_config):
                        print("🛑 Señal STOP recibida. Finalizado")
                        save_system_metrics(total_count, total_flows, total_alerts, latencies, status="STOPPED")
                        return total_count, total_flows, total_alerts, latencies, start_sim_time, dropped_windows

                    str_win_id = f"WIN_{int(win_id)}"
                    current_flows = len(data)
                    total_flows += current_flows
                    window_start = time.time()

                    # A. ENVIAR A RAG
                    start_win = time.time()
                    result = index_window(str_win_id, data)
                    # Renombrado a Latencia de Encolado (Queuing Latency)
                    queuing_latency = time.time() - start_win
                    latencies.append(queuing_latency)

                    # MANEJO DE FIABILIDAD: Si la cola está llena, reintentamos una vez
                    if isinstance(result, dict) and result.get('status') == 'queue_full':
                        print(f"⚠️ Cola llena en {str_win_id}. Reintentando en 1s...")
                        if wait_for_stop_or_delay(1):
                            print("🛑 Señal STOP recibida. Finalizado")
                            save_system_metrics(total_count, total_flows, total_alerts, latencies, status="STOPPED")
                            return total_count, total_flows, total_alerts, latencies, start_sim_time, dropped_windows
                        result = index_window(str_win_id, data)
                        if isinstance(result, dict) and result.get('status') == 'queue_full':
                            print(f"❌ Ventana {str_win_id} perdida.")
                            dropped_windows += 1
                            continue

                    # B. TRIGGER DE ANOMALÍAS
                    ataques = data[data['Label'] == 1]
                    window_alert_count = len(ataques)
                    if not ataques.empty:
                        total_alerts += 1
                        trigger_alert(str_win_id, ataques.iloc[0])

                    print(f"📦 [{total_count+1}] Ventana {str_win_id} enviada | Latencia encolado: {queuing_latency:.4f}s | Flujos: {len(data)} | Alerta: {'SI' if not ataques.empty else 'NO'}")

                    # C. ACTUALIZAR MÉTRICAS PARA ING 4 (DASHBOARD)
                    save_system_metrics(
                        total_count + 1,
                        total_flows,
                        total_alerts,
                        latencies,
                        current_window_flows=current_flows,
                        current_window_alerts=window_alert_count,
                        current_window_label=str_win_id,
                        status="RUNNING",
                    )

                    speed_config = load_simulation_config()
                    target_window_seconds = get_window_target_seconds(speed_config)
                    speed_label = get_speed_label(speed_config)
                    elapsed_window_seconds = time.time() - window_start
                    delay_seconds = max(target_window_seconds - elapsed_window_seconds, 0.0)
                    print(
                        f"⏱️ Velocidad activa: {speed_label} | ventana simulada: 60s | "
                        f"objetivo: {target_window_seconds:.2f}s | transcurrido: {elapsed_window_seconds:.2f}s | "
                        f"pausa: {delay_seconds:.2f}s"
                    )

                    if wait_for_stop_or_delay(delay_seconds):
                        print("🛑 Señal STOP recibida. Finalizado")
                        save_system_metrics(
                            total_count + 1,
                            total_flows,
                            total_alerts,
                            latencies,
                            current_window_flows=current_flows,
                            current_window_alerts=window_alert_count,
                            current_window_label=str_win_id,
                            status="STOPPED",
                        )
                        return total_count + 1, total_flows, total_alerts, latencies, start_sim_time, dropped_windows

                    total_count += 1

            print("🔁 Dataset completado. Reiniciando lectura para simulación infinita...")

    except Exception as e:
        print(f"❌ Error crítico en el simulador: {e}")

    # Retornamos los resultados para el reporte final
    return total_count, total_flows, total_alerts, latencies, start_sim_time, dropped_windows # <--- Retorno para el main

def trigger_alert(window_id, row):
    ts_ms = float(row['FLOW_START_MILLISECONDS'])
    dt_object = datetime.fromtimestamp(ts_ms / 1000.0, tz=timezone.utc)
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

    if _IP_INTEL is not None:
        try:
            alert["ip_intel"] = {
                "src": _IP_INTEL.get_info(alert["network_data"]["src_ip"]),
                "dst": _IP_INTEL.get_info(alert["network_data"]["dst_ip"]),
            }
        except Exception:
            pass
    
    alert_history = []
    try:
        with open(OUTPUT_ALERTS, 'r') as f:
            previous_alerts = json.load(f)
            if isinstance(previous_alerts, list):
                alert_history = previous_alerts
            elif isinstance(previous_alerts, dict):
                alert_history = [previous_alerts]
    except (FileNotFoundError, json.JSONDecodeError):
        alert_history = []

    alert_history.append(alert)
    alert_history = alert_history[-MAX_HISTORY_ITEMS:]

    atomic_write_json(OUTPUT_ALERTS, alert_history, indent=4)

def save_system_metrics(
    win_count,
    total_flows,
    total_alerts,
    latencies,
    current_window_flows=None,
    current_window_alerts=None,
    current_window_label=None,
    status="RUNNING",
):
    METRICS_PATH = BASE_DIR / "docs" / "samples" / "system_metrics.json"
    avg_latency = (sum(latencies) / len(latencies)) * 1000 if latencies else 0
    compression = (1 - (total_alerts / total_flows)) * 100 if total_flows > 0 else 0
    latency_history_ms = [round(value * 1000, 4) for value in latencies[-MAX_HISTORY_ITEMS:]]

    traffic_history = []
    try:
        with open(METRICS_PATH, "r") as f:
            previous_metrics = json.load(f)
            previous_history = previous_metrics.get("performance", {}).get("traffic_history", [])
            if isinstance(previous_history, list):
                traffic_history = previous_history
    except (FileNotFoundError, json.JSONDecodeError):
        traffic_history = []

    if current_window_flows is not None and current_window_alerts is not None:
        traffic_history.append(
            {
                "tiempo": current_window_label or f"WIN_{win_count}",
                "Tráfico Normal": max(int(current_window_flows) - int(current_window_alerts), 0),
                "Tráfico Anómalo": max(int(current_window_alerts), 0),
            }
        )
        traffic_history = traffic_history[-MAX_HISTORY_ITEMS:]
    
    metrics = {
        "last_update": _utc_now_z(),
        "performance": {
            "windows_processed": win_count,
            "total_flows_analyzed": total_flows,
            "total_alerts_triggered": total_alerts,
            "avg_latency_ms": round(avg_latency, 2),
            "compression_rate_percent": round(compression, 4),
            "traffic_history": traffic_history,
            "latency_history_ms": latency_history_ms,
        },
        "status": status
    }

    atomic_write_json(METRICS_PATH, metrics, indent=4)


if __name__ == "__main__":
    # 1. Ejecutar simulación
    win_count, total_flows, total_alerts, latencies, start_time, dropped_windows = simulate_stream()
    
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
    print(f"❌ Ventanas fallidas:     {dropped_windows}")
    print(f"📉 Tasa de Compresión:    {comp:.4f}%")
    print(f"⏱️ Latencia media/win:    {avg_lat:.2f} ms")
    print(f"🚀 Tiempo total sim:      {end_time - start_time:.2f} s")
    print("="*40)
    
    print("✅ Todo guardado. Cerrando ASTOLE de forma segura.")