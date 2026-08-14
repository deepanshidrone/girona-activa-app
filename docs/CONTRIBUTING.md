# Flujo de trabajo — Girona Activa App

## Ramas

| Rama | Propósito | Deploy automático |
|---|---|---|
| `main` | Producción estable | Vercel prod |
| `dev` | Desarrollo activo | Vercel preview |
| `feature/nombre` | Nueva funcionalidad | No |
| `fix/nombre` | Bug fix puntual | No |

## Desarrollo del día a día

Los cambios pequeños y fixes van directamente a `dev`:

```bash
git add <archivos>
git commit -m "feat/fix/docs: descripción breve"
git push origin dev
```

Para funcionalidades grandes, crear una rama:

```bash
git checkout -b feature/vista-cliente
# ... trabajo ...
git push origin feature/vista-cliente
# merge a dev cuando esté lista
```

## Convención de commits

```
feat:  nueva funcionalidad
fix:   corrección de bug
docs:  documentación
refactor: refactorización sin cambio de comportamiento
perf:  mejora de rendimiento
```

## Lanzar una versión a producción (cuando llegue el momento)

1. Asegurarse de que `dev` está estable y testeado
2. Configurar DNS (`app.gironaactiva.com` → Vercel)
3. Mergear `dev` → `main`
4. Crear tag de versión:

```bash
git checkout main
git merge dev
git tag v1.0.0
git push origin main --tags
```

## Actualizar el FRD

Cada vez que se implemente una funcionalidad nueva, actualizar `docs/FRD.md`:
- Mover de ⏳ Pendiente a ✅ Implementado
- Añadir nuevas funcionalidades identificadas al roadmap
