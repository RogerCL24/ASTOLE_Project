# 📜 Contrato de Interfaz JSON (ASTOLE)

Este documento define cómo se comunican los módulos del proyecto. **Es obligatorio respetar los nombres de los campos.**

## 🟢 Cuándo usar este JSON
- **Ingeniero 1 → Ingeniero 2:** Para notificar una anomalía detectada.
- **Ingeniero 2 → Ingeniero 4:** Para enviar la narrativa final al Dashboard.
- **Ingeniero 3 → Ingeniero 2:** Para pasar los fragmentos de contexto recuperados.

## 🔴 Cuándo NO usar este JSON
- **Ingeniero 1 → Ingeniero 3:** Para el volcado masivo (Bulk) de logs. Ahí se enviará el DataFrame completo o un archivo Parquet para eficiencia.

## Estructura del Objeto
```json
{
  "alert_id": "ID único de la alerta",
  "timestamp": "ISO 8601 format",
  "gnn_metadata": {
    "label_multiclase": "Tipo de ataque (DoS, Fuzzers, etc.)",
    "confidence": 0.00
  },
  "network_data": {
    "src_ip": "IP Origen",
    "dst_ip": "IP Destino",
    "src_port": 0,
    "dst_port": 0,
    "protocol": "TCP/UDP"
  }
}
```

### Ejemplo
```json
{
  "alert_id": "AST-2026-001",
  "timestamp": "2026-03-02T22:15:00Z",
  "gnn_metadata": {
    "label_binaria": "Attack",
    "label_multiclase": "DoS",
    "confidence_score": 0.94
  },
  "network_data": {
    "src_ip": "192.168.1.50",
    "dst_ip": "10.0.0.5",
    "src_port": 443,
    "dst_port": 80,
    "protocol": "TCP",
    "duration": 0.0045,
    "total_bytes": 1024
  },
  "top_features": {
    "f_duration": 0.0045,
    "f_in_pkts": 12,
    "f_out_pkts": 8,
    "f_tcp_flags": "AS"
  }
}
```