# Evidencia · pruebas de base de datos del módulo Inventario (2026-11-23)

**Resultado: 7 archivos, 73 / 73 pruebas correctas** (`npm run test:db`, código de salida 0).

| Campo | Valor |
|---|---|
| Fecha | 2026-11-23 |
| Commit base | `917a521` (`main`, PR #13) con la rama `docs/sdd-001-inventario`; el código de `backend/` y las migraciones no se modificaron (solo se añadieron `specs/001-inventario/plan.md`, `tasks.md` y esta evidencia, sin confirmar) |
| Entorno | Windows 11, Node.js 24.13.1, npm 11.8.0, Vitest 4.1.12, Prisma 7.10.1, PostgreSQL 17 (`postgres:17-alpine`) |
| Base | Contenedor local `mercado-test-db` (proyecto Docker `mercado-test`), solo `127.0.0.1:55433/mercado_test`, creado para esta ejecución (no existía); migraciones aplicadas con `migrate deploy` (4) |
| Comando | `npm run test:db` en `backend/` (guarda `base-aislada.mjs`: rechaza cualquier base que no sea la local de pruebas) |

## Archivos

- `test-db.txt`: salida completa de `npm run test:db` (levanta el contenedor, migra y ejecuta). Vitest con reporte por defecto.
- `test-db-detalle.txt`: segunda ejecución con `--reporter=verbose` sobre el mismo contenedor (misma configuración `vitest.config.db.ts` y mismas variables que fija el ejecutor), para listar cada prueba. También 7 archivos, **73 / 73**.

| Archivo de prueba | Pruebas correctas (ejecución detallada) |
|---|---|
| `inventario.db-spec.ts` | 25 |
| `inventario-invariantes.db-spec.ts` | 3 (semillas 20261105, 7 y 99991) |
| `eq03-concurrencia.db-spec.ts` | 5 |
| `modelo-restricciones.db-spec.ts` | 13 |
| `productos-persistencia.db-spec.ts` | 15 |
| `carrito.db-spec.ts` | 8 |
| `h0-persistencia.db-spec.ts` | 4 |

## EQ-03: repetición parcial de la medición del 05/11

`eq03-concurrencia.db-spec.ts` se ejecutó dentro de esta corrida y es la **repetición de la parte Vitest** de la medición del 2026-11-05 (`docs/05-implementacion/evidencias/EQ-03/2026-11-05/`):

| Prueba | Resultado (2026-11-23) |
|---|---|
| Serie 1: stock físico 1; N = 2, 5 y 20; 100 iteraciones por N | Correcta en las tres: exactamente 1 éxito y N−1 faltas de stock controladas por iteración |
| Serie 2: stock 10, 200 clientes simultáneos, 100 iteraciones | Correcta: exactamente 10 reservas aceptadas y 190 faltas controladas |
| SQL final `count(*) … stock_reservado > stock_fisico` | La prueba lo comprueba en su caso final (correcto). Consulta directa tras la corrida: **0** |

**No repetido:** la medición con k6 (200 VUs, 1 min, arnés `servidor-eq03.ts`). Por tanto esta evidencia **no sustituye** la medición del 05/11; la repite solo en su parte Vitest. Limitaciones del 05/11 vigentes: se mide `ReservarInventario`, no «confirmar pedido» (pendiente de Pedidos); PostgreSQL desechable de Docker en lugar de Testcontainers; una sola máquina, no extrapolable.

## Limitaciones

- Una sola ejecución completa más su repetición detallada, en una máquina; no se midió estabilidad entre ejecuciones.
- Los archivos de carrito, productos, modelo y H0 se ejecutaron porque forman parte de `test:db`; solo los tres de inventario respaldan la spec 001.
- La salida contiene los avisos habituales de Prisma (actualización disponible); no son fallos.
