# Flujo de trabajo Git — Modelo Feature Branch

Para mantener la estabilidad del proyecto, seguiremos el modelo Feature Branch. La rama `main` es sagrada y solo contiene código que funciona.

## 1. Reglas de Oro (Si el tiempo lo permite)

- NUNCA hagas un commit directamente en `main`.
- NUNCA hagas un merge por tu cuenta sin que otro ingeniero revise el código.
- Mantén tus commits pequeños y con mensajes descriptivos.

## 2. Nomenclatura de Ramas

Cada ingeniero trabajará en una rama basada en su Paquete de Trabajo (WP):

- `feature/data-ingestion` (Ingeniero 1)
- `feature/ai-agents` (Ingeniero 2)
- `feature/rag-memory` (Ingeniero 3)
- `feature/dashboard-ui` (Ingeniero 4)

## 3. El Proceso de Desarrollo (Paso a paso)

### Paso 1: Actualizar tu entorno local

Antes de empezar a trabajar, asegúrate de tener lo último de la rama principal:

```bash
git checkout main
git pull origin main
```

### Paso 2: Crear tu rama de trabajo

```bash
git checkout -b feature/nombre-de-tu-tarea
```

### Paso 3: Guardar cambios

```bash
git add .
git commit -m "feat: descripción clara del cambio"
git push origin feature/nombre-de-tu-tarea
```

### Paso 4: El Merge (Pull Request)

- Ve a GitHub y abre un Pull Request (PR) de tu rama hacia `main`.
- Etiqueta a otro compañero para que revise el código.
- Una vez aprobado, se hace el merge.

## 4. "Cheat Sheet" de Comandos Útiles (Debian/Linux)

| Acción | Comando |
|---|---|
| Ver estado | `git status` |
| Ver historial | `git log --oneline --graph --all` |
| Deshacer cambios locales | `git checkout -- <archivo>` |
| Borrar rama local | `git branch -d nombre-rama` |
| Sincronizar ramas | `git fetch --all --prune` |

---

> Nota: Si tienes problemas de autenticación al hacer push (por ejemplo: "Invalid username or token"), usa una de las siguientes opciones:

- `gh auth login` para autenticar con GitHub CLI (recomendado).
- Configurar SSH y usar la URL `git@github.com:...`.
- Crear un Personal Access Token (PAT) y usarlo con el helper de credenciales.
