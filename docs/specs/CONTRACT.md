# 📜 Contrato de Interfaz JSON (ASTOLE) - Versión 1.1

Este documento define la estructura de datos oficial. Los campos marcados son extraídos directamente del dataset **NF-UNSW-NB15-v3**.

## 🟢 Estructura del Objeto de Alerta

```json
{
  "alert_id": "Identificador único (ej. AST-V3-[timestamp])",
  "timestamp": "ISO 8601 format (UTC)",
  "gnn_metadata": {
    "label_multiclase": "Categoría del ataque (Attack)",
    "binary_attack": "0 (Benign) o 1 (Ataque)",
    "confidence_score": "Probabilidad de acierto (0.0 a 1.0)"
  },
  "network_data": {
    "src_ip": "IPV4_SRC_ADDR",
    "dst_ip": "IPV4_DST_ADDR",
    "src_port": "L4_SRC_PORT",
    "dst_port": "L4_DST_PORT",
    "protocol": "Protocolo IANA (numeric)",
    "l7_proto": "Protocolo de Capa 7 (numeric)"
  },
  "technical_details": {
    "duration_ms": "FLOW_DURATION_MILLISECONDS",
    "in_bytes": "Bytes entrantes",
    "out_bytes": "Bytes salientes",
    "tcp_flags": "Suma acumulada de flags TCP",
    "in_pkts": "Paquetes entrantes",
    "out_pkts": "Paquetes salientes"
  }
}
```

> [!WARNING]
> **Nota para Ingeniería de IA**: El campo ``confidence_score`` en ``live_alerts.json`` es actualmente simulado por el Ingestor. El módulo GNN deberá sobreescribir este valor con la salida de la función ``model.predict()``.
