import pandas as pd
import json
from datetime import datetime
from pathlib import Path

# Configuración: rutas relativas al root del proyecto
BASE_DIR = Path(__file__).resolve().parents[2]
DATASET_PATH = BASE_DIR / "data" / "NF-UNSW-NB15-v3.csv"

def generate_first_alert():
    print("🔍 Analizando el dataset para generar la primera alerta...")
    
    try:
        # Leemos un bloque pequeño para testear
        df = pd.read_csv(DATASET_PATH, nrows=100)
        
        # Buscamos la primera fila que SEA un ataque (Label == 1)
        # Si no hay ninguna en las primeras 100, cogemos la primera disponible
        ataques = df[df['Label'] == 1]
        if not ataques.empty:
            row = ataques.iloc[0]
            print("🚨 Ataque real encontrado para el sample.")
        else:
            row = df.iloc[0]
            print("ℹ️ No se encontró ataque en las primeras 100 filas, usando registro benigno.")

        # Manejo de Timestamp (notación científica a float)
        ts_ms = float(row['FLOW_START_MILLISECONDS'])
        dt_object = datetime.fromtimestamp(ts_ms / 1000.0)
        iso_ts = dt_object.strftime('%Y-%m-%dT%H:%M:%SZ')

        # Crear el objeto según el contrato corregido
        alert = {
            "alert_id": f"AST-V3-{int(ts_ms)}",
            "timestamp": iso_ts,
            "gnn_metadata": {
                "label_multiclase": str(row['Attack']), # 'Benign', 'Exploits', etc.
                "binary_attack": int(row['Label']),    # 0 o 1
                "confidence_score": 1.0 
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

        # Guardar en docs para que el equipo lo vea
        output_path = BASE_DIR / "docs" / "sample_alert.json"
        
        # Aseguramos que la carpeta docs existe
        output_path.parent.mkdir(parents=True, exist_ok=True)
        
        with open(output_path, 'w') as f:
            json.dump(alert, f, indent=4)

        print(f"✅ ¡Alerta generada con éxito en: {output_path}")
        print("-" * 30)
        print(json.dumps(alert, indent=2))

    except FileNotFoundError:
        print(f"❌ Error: No se encontró el dataset en {DATASET_PATH}")
    except Exception as e:
        print(f"❌ Error inesperado: {e}")

if __name__ == "__main__":
    generate_first_alert()