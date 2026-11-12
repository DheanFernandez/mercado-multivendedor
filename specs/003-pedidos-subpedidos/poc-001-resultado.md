# POC-001 — Resultado: unidad de trabajo sobre PostgreSQL real

**Veredicto: APROBADA** (2026-11-06). V1–V8 pasan en 3 ejecuciones completas consecutivas. Solo se ejecutó POC-001; T001–T029 no se iniciaron.

## Entorno

Node 24.19.0 · Prisma / `@prisma/client` 7.10.1 · `@prisma/adapter-pg` 7.10.1 · `pg` 8.23.1 · PostgreSQL 17.11 en el contenedor aislado `mercado-test-db` (`127.0.0.1:55433`, base `mercado_test`). La guarda `exigirBaseAislada` rechaza cualquier otra base.

## Archivos (todos nuevos; no se modificó ningún archivo existente)

| Archivo | Papel |
|---|---|
| `backend/src/shared/infrastructure/prisma/contexto-transaccional.ts` | `AsyncLocalStorage` (solo `run`), almacén por unidad con bandera de vigencia, `ContextoFueraDeVigenciaError` |
| `backend/src/shared/infrastructure/prisma/unidad-de-trabajo.ts` | `UnidadDeTrabajoPrisma`: `db`, `atomico()`, `unidadDeTrabajo()` (prototipo aislado sobre un `PrismaClient`) |
| `backend/src/shared/infrastructure/prisma/errores-transitorios.ts` + `.spec.ts` | clasificación de errores reintentables (22 pruebas unitarias) |
| `backend/test/poc-unidad-de-trabajo.db-spec.ts` | 33 pruebas V1–V8 contra PostgreSQL real |

No se tocaron `PrismaService`, los repositorios de Inventario, Carrito o Catálogo, el esquema, las migraciones ni las dependencias.

## Implementación técnica

- **Contexto**: `ejecutarEnContexto(tx, trabajo)` llama a `AsyncLocalStorage.run({ id, tx, vigente: true }, …)` **dentro** de la callback de `$transaction` y pone `vigente = false` en un `finally`. `transaccionVigente()` devuelve `tx`, devuelve `undefined` si no hay unidad y **lanza** si la hubo y ya terminó (fail-fast: nunca usa el pool por error).
- **`db`**: la transacción vigente o el cliente base. **`atomico()`**: se une a la vigente; fuera de una unidad abre su transacción con el reintento actual (5 intentos, `10 ms × n`, relanza el error original). **`unidadDeTrabajo()`**: se une si ya hay una; si no, `$transaction` + contexto y reintento de la unidad **completa** (máx. 5 intentos en total) solo ante errores transitorios; agotados, `ErrorServicioNoDisponible`.
- **Clasificación**: transitorio = SQLSTATE `40P01`/`40001` o Prisma `P2034` (buscados en `code`, `meta`, `cause` y, como último recurso, el mensaje); nunca lo son los errores de dominio ni `23xxx`.
- **Clean Architecture**: los tres archivos viven en `shared/infrastructure`; solo importan el cliente generado de Prisma, `node:async_hooks` y `shared/domain/errors`. `npm run arquitectura`: 110 módulos, 0 violaciones.

## Resultados V1–V8 (tres ejecuciones consecutivas)

| Ejecución | Hora | Resultado |
|---|---|---|
| 1 | 16:25:41 | 33 ✓ / 0 ✗ (8,6 s) |
| 2 | 16:25:54 | 33 ✓ / 0 ✗ (6,0 s) |
| 3 | 16:26:06 | 33 ✓ / 0 ✗ (6,0 s) |
| Orden aleatorio (`--sequence.shuffle`, semilla 20261106) | — | 33 ✓ / 0 ✗ |
| Rol **sin** superusuario (`NOSUPERUSER NOBYPASSRLS`, creado y eliminado en el contenedor aislado) | — | 33 ✓ / 0 ✗ |

| Id | Verificado | Pruebas | Evidencia clave |
|---|---|---|---|
| V1 | misma transacción y conexión entre repositorios | 2 | `txid_current()` y `pg_backend_pid()` idénticos en `db`, `atomico()` y consultas; el repositorio C lee lo no confirmado; **otra conexión ve 0 filas antes del COMMIT y 1 después**; las filas llevan el `txid` de la unidad |
| V2 | atomicidad | 6 | error de aplicación, de dominio, `CHECK` en A o B y `UNIQUE` (23505): **0 filas** en ambas tablas; una unidad que falla no afecta a otra que confirma |
| V3 | anidación | 4 | unidad y `atomico()` anidados: mismo `txid`, conexión y contexto; un error interior revierte el exterior; el interior **no reintenta** (1 ejecución interior por intento exterior: 2 y 2) |
| V4 | concurrencia y contexto | 4 | **100 unidades**: 100 `txid` y 100 contextos distintos, cada fila con el `txid` de **su** solicitud; fuera de una unidad no hay contexto (un temporizador previo no hereda); una promesa que sobrevive al commit (o al error) **falla con `ContextoFueraDeVigenciaError` y no escribe** |
| V5 | reintentos | 6 | **interbloqueo real (40P01)**: 3 ejecuciones en total (1 + 2), una sola fila por unidad; siempre transitorio: **exactamente 5 intentos** y `ErrorServicioNoDisponible`; recuperación al 3.er intento sin duplicados; error de dominio y 23505: **1 intento** |
| V6 | pool de 3 | 1 | **30 unidades**: todas terminan; máximo de conexiones observado ≤ 3 (`pg_stat_activity`); 0 «idle in transaction»; 0 conexiones tras `$disconnect()` |
| V7 | compatibilidad de `atomico()` | 6 | mismo número de ejecuciones y mismo error original que una copia del comportamiento vigente (transitorio, no transitorio, dominio); transacción propia; 20 llamadas concurrentes |
| V8 | contexto asíncrono | 4 | consulta perezosa de Prisma creada antes y esperada después, 10 operaciones paralelas, microtareas, `nextTick`, `setImmediate`, temporizadores, `Promise.race`, generador asíncrono y emisor síncrono: **mismo contexto** |

Controles transversales (tras **cada** prueba y al final): **0 transacciones abiertas, 0 bloqueos consultivos retenidos** por la POC; tras desconectar, **0 conexiones**; las tablas `poc_uow_a` y `poc_uow_b` se eliminan (`DROP TABLE IF EXISTS` solo sobre ellas) y no queda ningún rol ni objeto de la POC.

### Sensibilidad de las pruebas (mutaciones deliberadas, sobre copia temporal; originales restaurados y comprobados)

| Defecto introducido | Pruebas que fallan | Verificaciones |
|---|---|---|
| `db` devuelve siempre el cliente base | 26 | V1–V8 |
| el contexto no se invalida al terminar | 2 | V4 |
| se reintenta todo error | 5 | V3, V4, V5, V8 |
| `atomico()` no se une a la unidad | 21 | V1–V8 |
| la unidad anidada abre otra transacción | 2 | V3 |
| máximo de 6 intentos en lugar de 5 | 2 | V5, V7 |

## Hallazgos técnicos

1. **Forma real del interbloqueo** con Prisma 7.10.1 + `adapter-pg`: `PrismaClientKnownRequestError` con códigos `P2010`, **`40P01`** y `TransactionWriteConflict`. El clasificador lo reconoce. Los errores de integridad llegan como `P2010` + `23505`/`23514`/`23502` y **no** se clasifican como transitorios.
2. **Riesgo M6 confirmado**: `SELECT pg_advisory_xact_lock(…)` con `$queryRaw` **falla** (Prisma no deserializa el tipo `void`); con **`$executeRaw` funciona**. La tarea T012 debe usar `$executeRaw`.
3. `adapter-pg` implementa `startTransaction` con `pool.connect()` + `BEGIN` y ata el `PgTransaction` a esa conexión hasta el commit/rollback (código instalado, `dist/index.js`): una unidad retiene **una** conexión; V6 lo confirma empíricamente.
4. `ErrorServicioNoDisponible` al agotar intentos no conserva la causa original: conviene adjuntarla en T001 para diagnóstico.

## Limitaciones y riesgos que la POC no elimina

- **Cumplimiento por convención (R9)**: el fail-fast cubre usar `db` **después** de terminar la unidad, pero un repositorio que use directamente el cliente base **dentro** de una unidad abriría otra conexión sin que nada lo detecte. Debe cubrirse en T001–T005 (regla de uso de `db`/`atomico()`, pruebas con los repositorios reales y revisión).
- La POC prueba el **mecanismo** con repositorios de prueba; no prueba todavía los repositorios reales de Inventario, Carrito ni Catálogo (T002–T005) ni la carga de EQ-03.
- Se verificó con las versiones instaladas (Prisma 7.10.1, `adapter-pg` 7.10.1, Node 24.19.0). Un cambio de versión podría alterar la forma de los errores; el clasificador mira varios campos y el mensaje, y las pruebas lo detectarían.
- La prueba de interbloqueo depende de `deadlock_timeout` (1 s por defecto; ≈ 1 s por caso).
- No se probaron aislamiento `SERIALIZABLE`, transacciones largas ni el agotamiento de `timeout`/`maxWait` (no se reintentan por diseño).
- La documentación oficial en línea no describe explícitamente cómo la callback de `$transaction` ata las consultas a una conexión; se verificó con el código instalado y de forma empírica. El cambio a `AsyncContextFrame` por defecto en Node 24 solo figura en una fuente secundaria; el comportamiento observado es el esperado.

## Documentación consultada

- Código instalado: `@prisma/adapter-pg` 7.10.1 (`startTransaction`).
- [Node.js v24 · Async context (`AsyncLocalStorage`)](https://nodejs.org/download/release/v24.0.0/docs/api/async_context.html): `run()` preferido sobre `enterWith()`; propagación por cadenas de promesas.
- [iThome: Node.js 24 e `AsyncContextFrame`](https://www.ithome.com.tw/news/168896) (fuente secundaria).
- [Prisma: adaptadores y controladores](https://www.mintlify.com/prisma/prisma/adapters/overview) y [Database drivers](https://www.prisma.io/docs/orm/core-concepts/supported-databases/database-drivers).

## Siguiente paso

Revisión de este resultado. **No** se ha iniciado T001: requiere autorización explícita.
