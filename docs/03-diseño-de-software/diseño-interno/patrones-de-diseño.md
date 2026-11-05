# Patrones de Diseño

## Objetivo

Documentar los patrones de diseño previstos para el backend de la Plataforma Integral Multivendedor para la Gestión Comercial y Operativa de un Mercado de Abastos, indicando dónde se usan, qué problema resuelven y con qué tecnología se implementan, para que el equipo programe de forma uniforme.

## Contexto

- **Estilo:** monolito modular (NestJS + TypeScript).
- **Enfoque interno:** Clean Architecture dentro de cada módulo.
- **Pasarela de pago:** Mercado Pago en entorno Sandbox ([ADR-005](../../01-analisis-de-sistema/decisiones/ADR-005-pago-unico-mercado-pago.md)).
- **Persistencia:** PostgreSQL mediante Supabase; archivos en Supabase Storage (alternativa: Cloudflare R2).
- **Base:** [diagrama de componentes (C4 nivel 3)](../../04-modelo-c4/Nivel3-Diagrama-de-Componentes.md).

## Patrones aplicados

| Patrón | Dónde se usa | Problema que resuelve | Se implementa con | Archivos en el código |
|---|---|---|---|---|
| Repository | Todos los módulos → PostgreSQL | El negocio no debe conocer SQL ni el cliente de Supabase | PostgreSQL (cliente `pg`, Supabase o un ORM) | `pago.repository.ts`, `postgres-pago.repository.ts` |
| Adapter | Comerciantes y puestos → almacenamiento de archivos | Supabase Storage y Cloudflare R2 tienen API distintas (RC09) | SDK de Supabase Storage / API compatible con S3 de R2 | `almacenamiento-archivos.port.ts`, `supabase-storage.adapter.ts`, `r2-storage.adapter.ts` |
| Adapter | Pagos → pasarela de pago | Los casos de uso no deben conocer el SDK ni la API de Mercado Pago; el contrato `PasarelaPagoPort` se traduce a las llamadas del proveedor | SDK / API REST de Mercado Pago | `pasarela-pago.port.ts`, `mercado-pago-checkout.adapter.ts`, `mercado-pago-split.adapter.ts`, `pasarela-pago-local.adapter.ts` |
| Adapter | Pagos → módulo Auditoría | Pagos no debe depender de las clases internas de otro módulo | API pública (`index.ts`) de cada módulo | `auditoria.adapter.ts` |
| Strategy | Pagos → selección de la modalidad de cobro | Cambiar entre cobro único (Checkout), división por puesto (Split) o simulador local sin modificar los casos de uso | Inyección de dependencias de NestJS (`useFactory`) y la variable `PASARELA_PAGO_MODO` | `pagos.module.ts`, `mercado-pago-checkout.adapter.ts`, `mercado-pago-split.adapter.ts`, `pasarela-pago-local.adapter.ts` |
| Unit of Work | Pedidos + Inventario → transacción | Reservar stock y registrar el pedido multivendedor en una sola transacción ([ADR-003](../../01-analisis-de-sistema/decisiones/ADR-003-control-concurrencia.md)) | Transacciones de PostgreSQL | `unidad-de-trabajo.port.ts`, `postgres-unidad-de-trabajo.ts` |
| Outbox | Pagos → creación y confirmación del cobro | La llamada a Mercado Pago y la publicación de `PagoAprobado` no deben ejecutarse dentro de la transacción principal: una caída de la pasarela no debe mantener bloqueos abiertos, y un evento no debe perderse si el proceso falla tras confirmar la transacción (DA11) | Tabla `outbox` en PostgreSQL y un procesador asíncrono que despacha los eventos pendientes | `outbox.port.ts`, `postgres-outbox.ts`, `despachador-outbox.ts` |
| Observer (eventos de dominio) | Pagos → Pedidos y Notificaciones | Avisar que un pago fue aprobado por la pasarela sin acoplar los módulos y sin que una falla de notificaciones afecte el pago (DA11) | `@nestjs/event-emitter`, alimentado por el despachador del Outbox | `pago-aprobado.listener.ts` |
| Facade | API pública de cada módulo | Otros módulos usan un único punto de entrada y no las clases internas | `index.ts` + `exports` del módulo NestJS | `pagos/index.ts`, `inventario/index.ts` |
| Dependency Injection | Raíz de composición de cada módulo | Conectar los puertos con sus implementaciones sin `new` dentro de los casos de uso | Contenedor de NestJS (`providers`) | `pagos.module.ts`, `pedidos.module.ts` |

## Cómo funciona cada patrón

| Patrón | En pocas palabras |
|---|---|
| Repository | El caso de uso dice `guardarSiEstado(pago, PENDIENTE)`; el repositorio escribe el `UPDATE ... WHERE estado = ...`. |
| Adapter (almacenamiento) | El sistema dice `subirArchivo(imagen)`; el adaptador lo traduce a la llamada de Supabase Storage o de Cloudflare R2. |
| Adapter (pasarela) | El caso de uso dice `pasarela.consultarPago(id)`; `MercadoPagoCheckoutAdapter` llama a la API de Mercado Pago y devuelve un `ResultadoPasarela` del dominio. |
| Strategy | `pagos.module.ts` lee `PASARELA_PAGO_MODO` y entrega a los casos de uso el adaptador `checkout`, `split` o `local`; todos cumplen `PasarelaPagoPort`. |
| Outbox | **Creación del cobro:** la transacción de `CrearPedido` confirma el pedido, las reservas y el pago PENDIENTE; después, fuera de ella, `IniciarPago` solicita el cobro a Mercado Pago. **Confirmación del cobro:** `ProcesarNotificacionPago` guarda el nuevo estado y el evento `PagoAprobado` en la tabla `outbox` en la misma transacción; un despachador asíncrono lo publica después. |
| Unit of Work | Abre la transacción, ejecuta la reserva de stock y el registro del pedido, y confirma todo o revierte todo. |
| Observer | El despachador del Outbox publica `PagoAprobado`; Pedidos habilita la preparación y Notificaciones avisa al cliente, cada uno por su cuenta. |
| Facade | Pedidos llama a `inventario.reservar(...)` sin conocer cómo está organizado el módulo Inventario por dentro. |
| Dependency Injection | `pagos.module.ts` decide que `PAGO_REPOSITORY` es `PostgresPagoRepository`; en las pruebas se usa una versión en memoria. |

## Beneficio

- Cambiar Supabase Storage por Cloudflare R2 solo afecta al adaptador de almacenamiento.
- Cambiar la modalidad de cobro (Checkout, Split o simulador local), o de proveedor de pagos, solo requiere otro adaptador de `PasarelaPagoPort` en el módulo Pagos.
- Una caída de Mercado Pago no deja transacciones abiertas ni bloqueos sobre el inventario.
- Un error en Notificaciones no revierte una aprobación de pago ya registrada, y ningún evento confirmado se pierde.
- Los casos de uso se prueban sin base de datos real.

## Patrones previstos para siguientes iteraciones

| Patrón | Dónde se aplicaría | Cuándo |
|---|---|---|
| State | Estados del pedido por puesto (espera de pago → preparación → listo para retiro → entregado) | Si las transiciones de estado crecen y se vuelven difíciles de mantener en la entidad |
| Strategy | Tolerancias de peso o precio (RF45) | Si el administrador necesita varias reglas de tolerancia configurables |
