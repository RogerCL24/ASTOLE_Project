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


## [0.3.0-ui] - 2026-04-02

### Added
- **Dynamic Routing**: Configurado el Sidebar para navegación entre Capa 1 (Triaje) y Telemetría.
- **Telemetry Dashboard**: Creada la página de KPIs con visualización de latencia, compresión y volumen de flujos.
- **Hydration Fix**: Corregido el error de renderizado inicial (SSR) mediante datos de fallback en la página de telemetría.

## [0.4.0-ui] - 2026-04-02

### Added
- **Capa 1 Triage Refresh**: Rediseñado el dashboard principal como centro de respuesta rápida con narrativa de incidentes compacta, Top Atacantes y métricas operativas separadas.
- **Top Atacantes**: Lista compacta de las 5 IPs de origen con mayor volumen de alertas en la ventana actual.
- **Telemetry Slicer**: Selector histórico en Telemetría para consultar Últimas 20, Últimas 100, Últimas 1000 o Todo el Histórico.
- **Protocol Analytics**: Gráfico de distribución de protocolos en Telemetría filtrado por el rango seleccionado.

### Changed
- **Header KPIs**: Simplificado el encabezado del Triaje para dejar solo Alertas y Reducción de Ruido; latencia y ventanas procesadas se movieron a Telemetría.
- **Narrative Feed**: La narrativa de incidentes ahora se renderiza en una caja visual propia, con scroll interno más suave y solo las alertas más recientes visibles.
- **Threat Composition**: El donut de amenazas se alimenta de alertas reales y se mantiene alineado con el historial operativo.
- **Engine Status**: El estado del motor en el Sidebar ahora refleja `RUNNING`, `STOPPED` y `COMPLETED` con colores diferenciados.

### Fixed
- **Hydration Mismatch**: Reducidos los desajustes SSR/cliente usando formato de tiempo estable y evitando accesos inseguros a datos opcionales.
- **Layout Overflow**: Eliminado el hueco negro entre la gráfica y la narrativa mediante ajustes de altura y alineación de la fila principal.
- **Runtime Safety**: Corregido el acceso a `technical_details.duration_ms` cuando faltaban campos en algunas alertas.

## [0.5.0-ui] - 2026-04-03

### Added
- **Vista Táctica de Activos**: Ficha interactiva al expandir la vista táctica con IP completa, IoC, vectores detectados y logs recientes.
- **Tooltips IP instantáneos**: Hover sobre cubos muestra la IP completa sin retardo.
- **Top Atacantes Pro**: Etiqueta del vector principal por IP (coloreado con la misma paleta del donut).

### Changed
- **Activos 3D Performance**: Cubos estáticos; solo severidad Crítica con brillo pulsante ligero (`animate-pulse`).
- **Severidad estricta**: Mapeo visual consistente (Critical carmesí, High naranja, Medium amarillo, Low carbón).
- **Terminología SOC**: “Índice de Compromiso (IoC)” y “Vectores de Intrusión Detectados”.
- **Claridad temporal**: Prefijo “Log Time:” en narrativa y logs para distinguir datos históricos del dataset.
- **Telemetría**: Refinos de visualización y formateo de hora estable (Madrid).

### Fixed
- **Timezone**: Visualización consistente en `Europe/Madrid` para tiempos mostrados en Triaje/Telemetría.
- **Donut colors**: Paleta consistente con el UI y sin colores repetidos.

## [0.6.0-ui] - 2026-04-06

### Added
- **Sala de Investigación (Capa 2)**: Nueva consola 2 columnas (Evidencia + Chat RAG) con estética consistente (glass/terminal).
- **Entrada sin caso**: Estado inicial con selector y “Últimas 5 alertas críticas” clicables desde `/api/stats`.
- **Pivotaje ORIGEN/DESTINO**: Lista de alertas relacionadas scrolleable para pivotar por sesión sin romper el layout.
- **Intel Drawer (Incidentes)**: Ayuda contextual para interpretar el feed y el CTA “Investigar con IA”.

### Changed
- **Navegación de investigación**: El CTA del feed abre `/investigacion` pasando `id`, `src_ip`, `attack_type`, `dst_port`, `timestamp` por query.
- **Legibilidad en narrativa**: Refinos de tipografía/contraste y scroll interno más “humano”.

### Fixed
- **Severidad al pivotar**: El vector/severidad se extrae correctamente desde el esquema real de alertas (`gnn_metadata.label_multiclase`, `gnn_metadata.binary_attack`) evitando el fallback “Actividad”.
- **App Router searchParams**: Ajuste para evitar errores de APIs dinámicas (unwrap seguro de `searchParams`).