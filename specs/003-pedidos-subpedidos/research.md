# Investigación (Fase 0): decisiones técnicas de Pedidos y subpedidos

Todas las preguntas de la especificación están cerradas; este documento justifica **cómo** se implementan las decisiones aprobadas (revisión 2, 2026-11-06). **Ninguna afirmación sobre el comportamiento interno de Prisma o de `AsyncLocalStorage` se ha verificado todavía en este repositorio**: se declara como hipótesis razonada y la tarea POC-001 la comprueba con PostgreSQL real antes de construir sobre ella.

## Hechos verificados en el código actual

| Hecho | Dónde | Consecuencia |
|---|---|---|
| Cada escritura de Inventario es `conReintento(() => prisma.$transaction(…))` (4 métodos, 5 intentos, espera `10 ms × n`); `reservar` ordena los productos y es idempotente por `claveOperacion` | `inventory/infrastructure/prisma-inventario.repository.ts` | No puede unirse a una transacción externa; su reintento interno no es válido dentro de una ajena |
| Carrito: `agregar` usa el mismo patrón; `fijarCantidad`, `quitar` y `vaciar` son sentencias sueltas; el carrito es único por usuario | `cart/infrastructure/prisma-carrito.repository.ts` | Hace falta lectura con bloqueo y vaciado dentro de la unidad |
| Catálogo: `detalle(id)` consulta de a un producto con `this.prisma` | `catalog/infrastructure/prisma-catalogo.repository.ts` | Una lectura por línea abriría otra conexión dentro de la transacción: hace falta lote por la conexión activa |
| `PrismaService` extiende `PrismaClient` (un único pool, `DATABASE_POOL_MAX` por defecto 10) | `shared/infrastructure/prisma/prisma.service.ts` | Punto natural para centralizar la transacción activa |
| No hay unidad de trabajo, programador de tareas ni `event-emitter` | `package.json` | La expiración (S-08) necesitará una dependencia nueva |
| Inventario valida `expiraEn` futuro; la clave de reserva admite `A-Za-z0-9:_.-` (≤ 100) | `inventario.use-cases.ts` | `pedido:<uuid>` es válida |
| `ErrorServicioNoDisponible` (503) y `DomainErrorFilter` existen | `shared/domain/errors.ts`, `shared/http/domain-error.filter.ts` | Se reutilizan |

## D1 · Propagación de la transacción: `AsyncLocalStorage` con Prisma 7 y `adapter-pg`

**Decisión**: `contexto-transaccional.ts` mantiene un `AsyncLocalStorage` con el almacén `{ tx, vigente }`. `PrismaService` expone `db`, `atomico(trabajo, opciones?)` y `unidadDeTrabajo(trabajo)`. `PostgresUnidadDeTrabajo` (infraestructura de Pedidos) implementa el puerto `UnidadDeTrabajo.ejecutar(trabajo)` delegando en `unidadDeTrabajo`.

**Cómo funciona (hipótesis a verificar en POC-001)**

1. `prisma.$transaction(async (tx) => …)` con un adaptador de controlador reserva **una conexión del pool** para toda la callback; las sentencias hechas con `tx` viajan por esa conexión hasta el `COMMIT`/`ROLLBACK`.
2. Dentro de la callback se invoca `almacen.run({ tx, vigente: true }, trabajo)`. Toda continuación de `await` dentro de `trabajo` conserva ese almacén (en Node 24 el contexto asíncrono viaja con las promesas), así que el código de los repositorios lo lee **en su propia cadena asíncrona**; no depende de que el pool de `pg` ni Prisma preserven el contexto por dentro.
3. `db` devuelve `tx` si hay almacén vigente y el servicio en caso contrario. `atomico` y `unidadDeTrabajo` **se unen** si ya hay una transacción vigente.

**Aislamiento entre solicitudes**: cada invocación de `unidadDeTrabajo` crea su propio almacén con `run`, de modo que dos solicitudes concurrentes jamás comparten `tx`, aunque compartan el pool (la POC lo comprueba con `txid_current()` por solicitud y con esperas entrelazadas).

**Fail-fast fuera de vigencia**: al terminar la callback (commit, rollback o error) se pone `vigente = false`. Un acceso posterior a `db` desde una promesa que siguió viva (p. ej. una tarea no esperada que heredó el contexto) **lanza un error explícito** en lugar de usar el pool silenciosamente; usar el pool rompería la atomicidad y, bajo carga, podría agotarlo (la unidad ya retiene una conexión).

**Límites declarados**

- Solo `run`; **nunca `enterWith`** (fugaría el contexto al resto de la cadena).
- Solo dentro de un proceso; no cruza hilos ni procesos (válido en un monolito de un proceso).
- Los manejadores de eventos emitidos **dentro** de la unidad heredarían el contexto; regla: los eventos y el Outbox se despachan **después del commit** y fuera de la unidad.
- Nivel de aislamiento por defecto de PostgreSQL (READ COMMITTED); la corrección descansa en bloqueos explícitos (D4), no en aislamiento serializable. Se mantienen `maxWait` 20 s y `timeout` 15 s de los repositorios actuales; un tiempo agotado no se reintenta.
- Una unidad retiene **una sola conexión**: todo acceso a base de datos de la unidad pasa por `db`/`atomico`.

**Anidación**: una unidad o un `atomico` dentro de una unidad vigente se une a la misma transacción (sin puntos de guardado). Una excepción del interior revierte **todo**; las excepciones de base de datos no se capturan dentro de la unidad (PostgreSQL deja la transacción abortada, `25P02`). Las colisiones esperadas se resuelven con `ON CONFLICT … DO NOTHING`.

**Alternativas**: (B) contexto explícito en las firmas públicas — cambia contratos implementados y C4; (C) reservar y compensar — contradice ADR-003 §6.2 y la condición de EQ-02; (D) escribir en tablas de Inventario — viola C4 N3 regla 3. **Si POC-001 falla** se detiene la implementación y se vuelve a aprobación (B sería el plan alternativo).

## D2 · Reintentos de la unidad completa

**Política**: hasta **5 intentos en total** (los valores que ya usan Inventario y Carrito), espera `10 ms × n`. El bloque se reconstruye desde cero en cada intento; el `id` del pedido se conserva. Dentro de una unidad vigente, `atomico` **no reintenta**: propaga al límite exterior.

**Clasificación** (módulo `errores-transitorios.ts`, con pruebas):

| Clase | Ejemplos | Tratamiento |
|---|---|---|
| **Transitorio** | SQLSTATE `40P01` (interbloqueo), `40001` (fallo de serialización), Prisma `P2034` | reintentar toda la unidad; agotados los 5 intentos → `ErrorServicioNoDisponible` (503) |
| **Dominio** | `ErrorDeDominio` y subclases (stock insuficiente, carrito vacío, líneas no vigentes) | **no** se reintenta; revierte y responde |
| **Integridad** | `23505` única, `23503` clave foránea, `23514` check | **no** se reintenta (indica un defecto o una carrera no prevista) |
| **Otros** | tiempo agotado (`P2028`), cancelación (`57014`), pérdida de conexión | **no** se reintenta automáticamente: tras una pérdida de conexión el `COMMIT` pudo haberse ejecutado; el reintento seguro lo hace el cliente con la **misma clave** (idempotencia) |

La clasificación inspecciona el código SQLSTATE expuesto por Prisma y el adaptador (`code`, `meta`, `cause`) además del mensaje, como ya hacen los repositorios; la forma exacta con `adapter-pg` se confirma con un interbloqueo real en POC-001.

**Colisiones de código** (D6) son un bucle **interno** del intento, con su propio máximo, y **no** consumen intentos de transacción.

## D3 · Lectura autoritativa del carrito y bloqueo por cliente (RC-1, RC-2)

**Decisión**: dentro de la unidad, en este orden:

1. `SELECT pg_advisory_xact_lock(hashtextextended('pedidos:crear:' || :cliente, 0))`.
2. Comprobación de repetición por `(cliente, clave)`.
3. `SELECT … FROM carritos WHERE usuario_id = :cliente FOR UPDATE` y `SELECT … FROM carrito_items WHERE carrito_id = :id FOR UPDATE ORDER BY producto_id`; lectura de Catálogo en lote por la misma conexión.
4. Dominio, inserciones, vaciado (`DELETE` de ítems ya bloqueados) y, al final, la reserva.

**Por qué el bloqueo consultivo**: `FOR UPDATE` solo bloquea filas existentes. Con carrito inexistente o vacío, dos solicitudes con claves distintas no se serializarían. El bloqueo por cliente es estable en esos casos y es transaccional (se libera solo). La colisión de `hashtextextended` entre dos clientes solo serializa de más.

**Por qué no hay «carrito modificado»**: no existe lectura previa que comparar; la lectura del paso 3 es la verdad y bloquea a `agregar` (toma la fila del carrito) y a `fijarCantidad`/`quitar` (actualizan ítems). El pedido guarda `carrito_id` y `huella_carrito`.

**Huella del carrito**: SHA-256 hexadecimal de las líneas ordenadas por `producto_id`, formato `producto_id:cantidad` unidas con `|`. Se guarda solo para trazabilidad; **no** se usa para comparar reintentos.

## D4 · Idempotencia (DE-5)

- Clave `(cliente_id, clave_idempotencia)` con restricción **única** (red de seguridad).
- Primera ejecución exitosa: se guarda `carrito_id` y `huella_carrito` del carrito realmente procesado.
- Repetición: se devuelve el pedido existente (200) **sin reservar de nuevo**, aunque el carrito esté vacío o distinto. No se compara contenido porque la solicitud solo lleva la clave; una compra nueva exige una clave nueva. Limitación documentada (R7).
- Carrera con la misma clave: el bloqueo por cliente serializa; la segunda ve el pedido en el paso 2 de D3.
- Las ejecuciones fallidas no dejan rastro: reintentar con la misma clave ejecuta de nuevo.
- La reserva usa `pedido:<id>`, derivada del pedido.

## D5 · Código del pedido

`PED-` + 8 caracteres del alfabeto `0123456789ABCDEFGHJKMNPQRSTVWXYZ` (sin `I`, `L`, `O`, `U`) elegidos con `crypto.randomInt` (32⁸ ≈ 1,1 × 10¹²). `UNIQUE (codigo)` y `CHECK` de formato. La colisión se resuelve sin error: `INSERT … ON CONFLICT DO NOTHING RETURNING id`; sin fila (el bloqueo por cliente y el paso 2 descartan la clave) se genera otro código, hasta 5 veces; agotado → error controlado 503 sin reintentar la transacción. El generador es un puerto inyectable para forzar colisiones en pruebas.

## D6 · Configuración de la duración (Q2)

Puerto `ConfiguracionReservaPort.duracionMinutos()`; adaptador temporal lee `PEDIDOS_RESERVA_MINUTOS` con `ConfigService` en cada creación. **Validación**: `^[1-9][0-9]{0,7}$` (entero decimal sin signo, espacios, decimales, notación exponencial ni ceros a la izquierda), es decir de **1 a 99 999 999 minutos**.

| Límite | Justificación |
|---|---|
| mínimo 1 | `expiraEn` debe ser futuro: Inventario rechaza vencimientos ≤ ahora |
| máximo de 8 dígitos | solo evita desbordes de fecha (`Date` admite ≈ 1,4 × 10⁸ minutos desde la época) y errores de digitación; **no es una regla de negocio**: S-04 (Configuración) fijará la política real |

**Sin valor predeterminado**: ausente o inválida → `ConfiguracionReservaNoDisponibleError` (`ErrorServicioNoDisponible`, 503) sin escribir nada y con mensaje genérico. `expiraEn = reloj() + minutos` (puerto de reloj). `.env.example` lleva la variable **comentada y sin valor**.

## D7 · Estado general y máquina de estados (Q3)

`estadoGeneral(estados)` es una función pura del dominio: estado común si todos coinciden, `'MIXTO'` si no (tipo `EstadoPedidoPuesto | 'MIXTO'`; `MIXTO` no se persiste). Transiciones permitidas: C4 N4 §3 (tabla en `data-model.md`); esta fase solo ejecuta la creación.

## D8 · Importes e instantáneas

Dominio en céntimos enteros (como el carrito); persistencia `NUMERIC` con `CHECK (subtotal = precio_unitario × cantidad)`. Instantáneas de puesto y producto en tablas del módulo (Pedidos no lee tablas ajenas). **Sin triggers diferidos de totales** (decisión del equipo): la coherencia `total = Σ subtotales` y `subtotal = Σ líneas` la garantiza el dominio y la verifican consultas SQL de integridad en las pruebas.

## D9 · Errores y recuperación

| Punto de fallo | Resultado |
|---|---|
| Antes de la unidad (validación, repetición rápida, configuración solo si es nueva; DI-2) | 400/200/503; no se escribe nada |
| Dentro de la unidad (stock, carrito vacío o no vigente, código agotado, error técnico) | `ROLLBACK` completo: sin pedido, subpedidos, líneas, historial, reservas, movimientos ni vaciado |
| Interbloqueo o serialización | reintento de toda la unidad (≤ 5); agotado → 503 |
| Caída del proceso en la transacción | PostgreSQL aborta: no queda nada |
| Caída tras el `COMMIT` y antes de responder | el reintento con la misma clave devuelve 200 con el mismo pedido |
| Error técnico no previsto | respuesta controlada sin detalles internos |

Las únicas reservas que permanecen son las de pedidos válidos pendientes de pago; su liberación depende de S-08 (`plan.md`, C1–C4).

## D10 · APIs públicas nuevas

- **Carrito** (`cart/index.ts`): `ObtenerCarritoParaPedido(clienteId)` — **solo dentro de una unidad**: toma los bloqueos y devuelve líneas autoritativas con datos de Catálogo en lote y `carritoId`; falla si no hay unidad vigente. `VaciarCarritoDelPedido(clienteId)` — borra los ítems del carrito ya bloqueado en la misma unidad.
- **Catálogo** (`catalog/index.ts`): `ObtenerDetallesCatalogo(ids[])` en lote (una consulta por la conexión activa). Pedidos **no** depende de Catálogo: lo usa Carrito, que ya depende de él.
- **Inventario**: sin cambios de contrato; se exporta `StockInsuficienteError`.
