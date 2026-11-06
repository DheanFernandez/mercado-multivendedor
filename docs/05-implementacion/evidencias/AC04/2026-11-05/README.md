# AC04 · Matriz de autorización rol × ruta

**Criterio documentado** (`04-atributos-de-calidad.md`): «Los usuarios no deberán acceder a recursos ni ejecutar operaciones fuera de los permisos asignados a sus roles».

**Resultado: 198 de 198 casos conformes** — 33 rutas × 6 identidades (anónimo, cliente, trabajador de puesto, comerciante ajeno, comerciante titular y administrador). Detalle en `matriz-autorizacion.md` y `matriz-autorizacion.json`.

| Elemento | Valor |
|---|---|
| Qué se comprueba | Una operación **permitida** no devuelve 401 ni 403; una **denegada** devuelve 401 (anónimo) o 403 (autenticado). Las escrituras se envían con cuerpos vacíos o idempotentes: se mide la autorización, no el efecto |
| Prueba | `backend/test/matriz-autorizacion.e2e-spec.ts` (aplicación real con repositorios en memoria; no usa Supabase ni la base de datos) |
| Reproducir | `cd backend` → `EVIDENCIA_DIR=<carpeta> npx vitest run --config ./vitest.config.e2e.ts test/matriz-autorizacion.e2e-spec.ts` |

## Defecto encontrado y corregido durante la medición

La primera ejecución dio **194 de 198**: `PATCH /api/v1/productos/:id/estado` validaba la acción **antes** de autorizar, de modo que un usuario sin permiso recibía 400 en lugar de 403 (sin filtrar datos, pero con respuesta incorrecta). Se corrigió en `CambiarEstadoProducto` (autorizar primero, validar después) y se añadió una prueba de regresión.

## Alcance y límites

- Cubre las rutas existentes. Los módulos de inventario, carrito, pedidos y pagos aún no existen; el criterio «Webhook inválido rechazado» (pagos) sigue **pendiente**.
- No incluye un análisis OWASP ZAP (complemento citado en EQ-01).
- Verifica la autorización de cada ruta, no la corrección de las reglas de negocio de cada operación (cubiertas por las pruebas unitarias y HTTP de cada módulo).
