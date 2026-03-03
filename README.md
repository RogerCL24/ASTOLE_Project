# ASTOLE: Narrative Intelligence for Infrastructure Critical
Proyecto para la asignatura PAE - 2026.

# ASTOLE: Narrative Intelligence for Infrastructure Critical
Proyecto para la asignatura PAE - 2026.

## Equipo
- Ingeniero 1: Data & Ingestion
- Ingeniero 2: AI Core & Agents
- Ingeniero 3: RAG & Memory
- Ingeniero 4: UI & Telemetry

## Estructura (diagrama)

```mermaid
graph TD
    subgraph Repo_Root [ASTOLE Project Structure]
        DIR_DATA[data/] -->|Dataset V3 local| IGNORE((.gitignore))
        DIR_DOCS[docs/] -->|Contratos y Diseño| DOC_JSON[contract.json]
        
        subgraph SRC [src/]
            ING[ingestion/] -->|Ingeniero 1| OUT1[JSON Contract]
            AGE[agents/] -->|Ingeniero 2| OUT2[Narrativa Técnica]
            MEM[memory/] -->|Ingeniero 3| OUT3[Contexto RAG]
            APP[app/] -->|Ingeniero 4| OUT4[Dashboard Streamlit]
        end
    end

    %% Flujo de Trabajo
    ING -->|Inyecta Alerta| AGE
    ING -->|Alimenta Base de Datos| MEM
    MEM <-->|Provee Contexto| AGE
    AGE -->|Envía Informe| APP
    MEM <-->|Hilo de Chat| APP

```

## Áreas y responsabilidades

### Área 1: Ingestión (Ingeniero 1)
- **Input:** Dataset crudo NF-UNSW-NB15-v3 (CSV/Parquet).
- **Proceso:** Filtrado de ataques y agrupación en ventanas de 60 segundos.
- **Output:**
  1. **JSON Alert:** Un paquete con la anomalía detectada para activar al Router.
  2. **Bulk Logs:** Envío masivo de la ventana de 60s para almacenamiento.

### Área 2: Core de IA / Agentes (Ingeniero 2)
- **Input:** JSON Alert (del Ing. 1) + Contexto RAG (del Ing. 3).
- **Proceso:** Clasificación mediante el Router y redacción de la narrativa mediante Skills especializados.
- **Output:** Narrativa Estructurada. Un texto jerárquico (Resumen -> Detalles -> Acción recomendada) listo para el Dashboard.

### Área 3: Memoria y RAG (Ingeniero 3)
- **Input:** Bulk Logs (del Ing. 1) + Consulta semántica (del Ing. 2 o Ing. 4).
- **Proceso:** Indexación en ChromaDB y búsqueda de similitud.
- **Output:**
  1. **Context Snippets:** Fragmentos de logs pasados para enriquecer la alerta.
  2. **Chat Response:** Respuesta del modelo Llama 3 local para la investigación activa.

### Área 4: UI y Telemetría (Ingeniero 4)
- **Input:** Narrativa Estructurada (del Ing. 2) + Respuesta de Chat (del Ing. 3).
- **Proceso:** Visualización en Streamlit y cálculo de consumo de tokens/costes.
- **Output:** Dashboard Operativo. Interfaz final para Jordi con métricas de eficiencia.

