import json
import httpx
import asyncio
from pathlib import Path

# Configuración de rutas
BASE_DIR = Path(__file__).resolve().parents[2]
ALERTS_PATH = BASE_DIR / "docs" / "samples" / "live_alerts.json"
API_URL = "http://localhost:8000/triage"

async def test_single_alert():
    print(f"🔍 Buscando alertas en: {ALERTS_PATH}")
    
    if not ALERTS_PATH.exists():
        print(f"❌ Error: No se encuentra el archivo en {ALERTS_PATH}")
        return

    # 1. Carga robusta del JSON
    with ALERTS_PATH.open("r", encoding="utf-8") as f:
        data = json.load(f)

    if isinstance(data, dict):
        all_alerts = [data]
    elif isinstance(data, list):
        all_alerts = data
    else:
        print("❌ Estructura de JSON no reconocida.")
        return

    # 2. Seleccionamos la primera alerta
    single_alert = all_alerts[0]
    
    # 3. NORMALIZACIÓN: Traducir "Ingestión" -> "Agentes"
    # Corregir nombres en gnn_metadata
    gnn = single_alert.get("gnn_metadata", {})
    if "label_multiclase" in gnn:
        gnn["label_multiclass"] = gnn.pop("label_multiclase")
    if "binary_attack" in gnn:
        gnn["label_binary"] = gnn.pop("binary_attack")

    # Mover technical_details a network_data
    tech = single_alert.pop("technical_details", None)
    if tech:
        net = single_alert.setdefault("network_data", {})
        fields = ["duration_ms", "in_bytes", "out_bytes", "tcp_flags", "in_pkts", "out_pkts"]
        for field in fields:
            if field in tech:
                net.setdefault(field, tech[field])

    print(f"🚀 Enviando alerta ID: {single_alert.get('alert_id')} normalizada...")

    # 4. Envío a la Capa 1
    async with httpx.AsyncClient(timeout=60.0) as client:
        try:
            response = await client.post(API_URL, json=single_alert)
            
            if response.status_code == 200:
                print("\nOK: El Agente ha respondido correctamente.")
                result = response.json()
                print("-" * 30)
                # Use the canonical TriageOutput contract field name:
                # narrative.executive (not executive_summary).
                print(f"NARRATIVA: {result.get('narrative', {}).get('executive')}")
                print(f"SEVERIDAD: {result.get('severity')}")
                print("-" * 30)
            else:
                print(f"❌ ERROR {response.status_code}: {response.text}")
                
        except Exception as e:
            print(f"❌ Error de conexión: {e}")

if __name__ == "__main__":
    asyncio.run(test_single_alert())