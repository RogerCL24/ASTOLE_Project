# IP Intel (CSV → Parquet) — Setup rápido

Este proyecto puede enriquecer IPs (país/ASN/ISP y señal de proxy) a partir de rangos IP2Location/IP2Proxy.
El enriquecimiento lo carga `IPIntelService` desde Parquet en `data/ip_intel/`.

## 1) Archivos necesarios (desde el Drive del equipo)
Descarga estos **CSVs sin headers** (Lite) y colócalos con estos nombres exactos:

- `IP2LOCATION-LITE-ASN.CSV`
- `IP2LOCATION-LITE-DB1.CSV`
- `IP2PROXY-LITE-PX2.CSV`

Ruta por defecto esperada:
- `src/ingestion/raw_data/`

> Nota: si ya existen en tu workspace pero quieres actualizar la versión, reemplázalos y vuelve a generar Parquet.

## 2) Instalar dependencias Python
En la raíz del repo:

- Crear/activar venv (si no lo tienes):
  - `python3 -m venv venv`
  - `source venv/bin/activate`
- Instalar deps:
  - `pip install -r requirements.txt`

`pyarrow` ya está en `requirements.txt` (necesario para Parquet).

## 3) Convertir CSV → Parquet
Ejecuta el optimizador (usa defaults y escribe en `data/ip_intel/`):

- `python scripts/optimize_ip_data.py`

Opcionalmente, puedes indicar rutas explícitas:

- `python scripts/optimize_ip_data.py --dbasn src/ingestion/raw_data/IP2LOCATION-LITE-ASN.CSV --db1 src/ingestion/raw_data/IP2LOCATION-LITE-DB1.CSV --px2 src/ingestion/raw_data/IP2PROXY-LITE-PX2.CSV --out-dir data/ip_intel`

Al terminar deben existir:
- `data/ip_intel/dbasn.parquet`
- `data/ip_intel/db1.parquet`
- `data/ip_intel/px2.parquet`

## 4) Nota importante (cache del servicio)
`IPIntelService` se carga **una vez** y queda en memoria (singleton). Si regeneras Parquet, reinicia el proceso Python que lo esté usando.

Si quieres cambiar la carpeta de Parquet, usa:
- `IP_INTEL_DATA_DIR=/ruta/a/ip_intel`

## 5) Verlo reflejado en el Dashboard (Next.js)
El frontend consume JSONs bajo `docs/samples/`.
Para generar datos “live” (y que incluya `ip_intel` cuando esté disponible), arranca el simulador:

- `python src/ingestion/stream_simulator.py`

Luego levanta el frontend:

- `cd frontend`
- `npm install`
- `npm run dev`

Abre `http://localhost:3000`.
