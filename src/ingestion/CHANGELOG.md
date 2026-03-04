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