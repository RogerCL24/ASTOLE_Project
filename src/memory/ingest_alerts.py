"""
Ingest Alerts - Indexar live_alerts.json en ChromaDB
Colección separada 'alerts' para búsqueda exacta por IP
Ingeniero 3: Andrea Blanco
Milestone 4
"""

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from memory.chromadb_manager import MemoryManager

BASE_DIR = Path(__file__).resolve().parents[2]
ALERTS_PATH = BASE_DIR / "docs" / "samples" / "live_alerts.json"


def ingest_alerts():
    print("[IngestAlerts] Initializing...")
    manager = MemoryManager()

    # Colección separada para alertas
    alerts_collection = manager.client.get_or_create_collection(
        name="alerts",
        metadata={"description": "Alertas de ataques indexadas para búsqueda por IP"}
    )

    # Leer alertas
    with open(ALERTS_PATH, "r", encoding="utf-8") as f:
        alerts = json.load(f)

    print(f"[IngestAlerts] Found {len(alerts)} alerts to index")

    indexed = 0
    skipped = 0

    for alert in alerts:
        alert_id = alert.get("alert_id", "")
        if not alert_id:
            continue

        src_ip = alert.get("network_data", {}).get("src_ip", "")
        dst_ip = alert.get("network_data", {}).get("dst_ip", "")
        attack_type = alert.get("gnn_metadata", {}).get("label_multiclase", "Unknown")
        dst_port = alert.get("network_data", {}).get("dst_port", 0)
        confidence = alert.get("gnn_metadata", {}).get("confidence_score", 0)
        timestamp = alert.get("timestamp", "")

        # Texto descriptivo para embedding
        text = f"""
Alerta {alert_id}:
- IP origen: {src_ip}
- IP destino: {dst_ip}
- Tipo de ataque: {attack_type}
- Puerto destino: {dst_port}
- Confianza GNN: {confidence}
- Timestamp: {timestamp}
""".strip()

        # Metadata para filtrado exacto
        metadata = {
            "alert_id": alert_id,
            "src_ip": src_ip,
            "dst_ip": dst_ip,
            "attack_type": attack_type,
            "dst_port": int(dst_port),
            "confidence": float(confidence),
            "timestamp": timestamp,
        }

        embedding = manager.embedder.encode(text).tolist()

        try:
            alerts_collection.add(
                documents=[text],
                embeddings=[embedding],
                metadatas=[metadata],
                ids=[alert_id]
            )
            indexed += 1
        except Exception as e:
            error_msg = str(e).lower()
            if "already exists" in error_msg or "duplicate" in error_msg:
                alerts_collection.update(
                    documents=[text],
                    embeddings=[embedding],
                    metadatas=[metadata],
                    ids=[alert_id]
                )
                indexed += 1
            else:
                skipped += 1

        if indexed % 100 == 0:
            print(f"[IngestAlerts] Indexed {indexed}/{len(alerts)}...")

    print(f"[IngestAlerts] Done. Indexed: {indexed}, Skipped: {skipped}")
    print(f"[IngestAlerts] Total alerts in collection: {alerts_collection.count()}")


if __name__ == "__main__":
    ingest_alerts()