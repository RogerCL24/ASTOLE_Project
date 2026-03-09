import pandas as pd
import json
from datetime import datetime, timedelta
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parents[2]
DATASET_PATH = BASE_DIR / "data" / "NF-UNSW-NB15-v3.csv"

def generate_mock_stream():
    print("🚀 Generando lista de 15 alertas variadas...")
    try:
        # Leemos un bloque más grande para tener variedad de ataques
        df = pd.read_csv(DATASET_PATH, nrows=5000)
        
        # Seleccionamos una mezcla: 5 benignos y 10 ataques aleatorios
        benignos = df[df['Label'] == 0].sample(5)
        ataques = df[df['Label'] == 1].sample(10)
        
        mezcla = pd.concat([benignos, ataques]).sample(frac=1).reset_index(drop=True)
        
        mock_stream = []
        base_time = datetime.now()

        for i, row in mezcla.iterrows():
            # Simulamos que las alertas han ocurrido en los últimos 15 minutos
            fake_ts = (base_time - timedelta(minutes=i)).strftime('%Y-%m-%dT%H:%M:%SZ')
            
            alert = {
                "alert_id": f"MOCK-V3-{1000 + i}",
                "timestamp": fake_ts,
                "gnn_metadata": {
                    "label_multiclase": str(row['Attack']),
                    "binary_attack": int(row['Label']),
                    "confidence_score": 0.85 + (i * 0.01) # Simulado
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
                    "in_pkts": int(row['IN_PKTS']),
                    "out_pkts": int(row['OUT_PKTS'])
                }
            }
            mock_stream.append(alert)

        output_path = BASE_DIR / "docs" / "samples" / "mock_stream.json"
        with open(output_path, 'w') as f:
            json.dump(mock_stream, f, indent=4)
            
        print(f"✅ mock_stream.json generado con 15 alertas en {output_path}")

    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    generate_mock_stream()