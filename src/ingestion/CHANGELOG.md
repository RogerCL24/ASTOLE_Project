# 📓 Record - ASTOLE - Ingestion

## [2026-03-04] - Hito: Primer flujo de datos real
**Responsable:** Ingeniero 1 (Roger)

### Logros:
- Configuración exitosa del entorno en Debian/WSL2.
- Mapeo de columnas del dataset **NF-UNSW-NB15-v3**.
- Creación de `first_alert_generator.py`: Script capaz de filtrar ataques y exportar a JSON según el contrato.
- Generación de la primera alerta real (`sample_alert.json`) basada en un ataque de tipo **Fuzzers**.

### Descubrimientos técnicos:
- El dataset V3 tiene invertidas las etiquetas: `Label` es el binario (0/1) y `Attack` es la categoría (Benign, Exploits, etc.).
- Se requiere el uso de `pathlib` para evitar errores de ruta entre sistemas operativos.

### Siguientes pasos:
- Desarrollar la lógica de ventanas temporales de 60 segundos.

---

## [2026-03-08] - Hito: Finalización del Milestone 1 e Infraestructura de Colaboración
**Responsable:** Ingeniero 1 (Roger)

### Logros:
- **Generación de Mocks**: Creación de `mock_stream_generator.py` para producir 15 alertas variadas para el desarrollo del Dashboard.
- **Sincronización de Contratos**: Actualización de `CONTRACT.md` para reflejar con exactitud la estructura de los datos extraídos del dataset V3.
- **Soporte Forense**: Generación de `raw_sample_53_cols.csv` para que el Ingeniero 3 pueda configurar ChromaDB con el esquema completo.
- **Reorganización del Repositorio**: Implementación de una estructura de carpetas profesional (`/specs`, `/samples`, `/logs`) para escalar la documentación.
- **Gestión de Proyecto**: Configuración de Linear con hitos y tareas para los tres ingenieros restantes.

### Descubrimientos técnicos:
- Se identificó la necesidad de separar las especificaciones técnicas de los datos de ejemplo para mantener el orden en el equipo.
- Se definió el flujo asíncrono como la mejor opción para la comunicación entre el Ingeniero 1 y el Ingeniero 3.

### Siguientes pasos:
- Iniciar Milestone 2: Algoritmo de agrupación por ventanas temporales de 60 segundos.

---

## [2026-03-12] - Hito: Motor de Simulación y Estabilidad (Milestone 2)
**Responsable:** Ingeniero 1 (Roger)

### Logros:
- **Agrupación Temporal**: Implementada la lógica de ventanas de 60 segundos basada en `FLOW_START_MILLISECONDS`.
- **Integración RAG**: Conexión asíncrona validada con el módulo del Ingeniero 3 (ChromaDB en Docker).
- **Estabilidad de Hardware**: Parche de compatibilidad `device='cpu'` aplicado al `MemoryManager` para permitir ejecución en GPUs de arquitectura antigua.
- **Cierre Seguro**: Implementado `_window_queue.join()` para evitar desbordamientos de memoria y cierres inesperados (Core Dumped).

### Descubrimientos técnicos:
- El procesamiento masivo de ventanas en CPU requiere una gestión de hilos que espere a que la cola se vacíe antes de finalizar el proceso principal.

---
## [2026-03-19] - Cierre Milestone 3: Validación y Contratos
**Responsable:** Ingeniero 1 (Roger)

### Logros:
- **Validación de Contrato**: Se ha corregido el generador de alertas para incluir `technical_details`, alineando el output con el estándar `sample_alert.json`.
- **Métricas Finales**: Procesadas 100 ventanas con una tasa de compresión del 99.82% y latencia media de 2.31ms.
- **Test de Cobertura**: Verificado el funcionamiento del trigger para las 9 categorías de ataque.

### Notas de Integración:
- El sistema está listo para ser consumido por el Dashboard (Ing 4). 
- Se ha detectado un posible cuello de botella en la sobrescritura del JSON de alertas; se discutirá con Ing 2 (IA) a su vuelta de vacaciones.