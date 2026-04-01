# Changelog - ASTOLE - Frontend

## [0.2.0-ui] - 2026-04-01

### Added
- **Live Data Connection**: Creado endpoint interno en Next.js (`/api/stats`) para servir datos reales desde archivos JSON localizados en `docs/samples/`.
- **Real-time Polling**: Implementado refresco automático cada 5 segundos en el Dashboard principal mediante `useEffect` y `fetch`.
- **Dynamic Threat Mapping**: El gráfico de "Composición de Amenazas" ahora se genera automáticamente analizando las etiquetas GNN de los logs reales.

### Changed
- **Dashboard Data**: Sustituidos los datos "hardcoded" por métricas reales del motor:
  - Volumen de flujos analizados.
  - Tasa de compresión/reducción de ruido (GNN).
  - Latencia media de procesamiento.
- **Alert Cards**: Ahora muestran IPs de origen/destino reales, IDs de alerta y timestamps dinámicos extraídos de `live_alerts.json`.

### Fixed
- **Dependency Hell**: Solucionado conflicto de versiones entre React 19 y Tremor/Recharts forzando el uso de React 18.3.1 y `--legacy-peer-deps`.
- **Layout Sync**: Alineada la visualización de severidad con la lógica de la Capa 1 (Capa de Agentes).