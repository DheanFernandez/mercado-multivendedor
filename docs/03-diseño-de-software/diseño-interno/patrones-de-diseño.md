# Patrones de Diseño

## Objetivo

Documentar los patrones de diseño previstos para el backend de la Plataforma Integral Multivendedor para la Gestión Comercial y Operativa de un Mercado de Abastos, indicando dónde se usan, qué problema resuelven y con qué tecnología se implementan, para que el equipo programe de forma uniforme.

## Contexto

- **Estilo:** arquitectura cliente-servidor de tres capas con backend en monolito modular (NestJS + TypeScript).
- **Enfoque interno:** Clean Architecture.
- **Persistencia:** PostgreSQL mediante Supabase; archivos en Supabase Storage (alternativa: Cloudflare R2).
- **Base:** [diagrama de componentes (C4 nivel 3)](../../04-modelo-c4/Nivel3-Diagrama-de-Componentes.md).

## Patrones aplicados

| Patrón | Dónde se usa | Problema que resuelve | Se implementa con | Archivos en el código |
|---|---|---|---|---|
| Repository | Todos los módulos → PostgreSQL | El negocio no debe conocer SQL ni el cliente de Supabase | PostgreSQL (cliente `pg`, Supabase o un ORM) | `pago.repository.ts`, `postgres-pago.repository.ts` |
| Adapter | Comerciantes y puestos → almacenamiento de archivos | Supabase Storage y Cloudflare R2 tienen API distintas (RC09) | SDK de Supabase Storage / API compatible con S3 de R2 | `almacenamiento-archivos.port.ts`, `supabase-storage.adapter.ts`, `r2-storage.adapter.ts` |
| Adapter | Pagos → módulos Comerciantes y Auditoría | Pagos no debe depender de las clases internas de otro módulo | API pública (`index.ts`) de cada módulo | `permisos-puesto.adapter.ts`, `auditoria.adapter.ts` |
| Unit of Work | Pedidos + Inventario → transacción | Reservar stock y registrar el pedido multivendedor en una sola transacción ([ADR-003](../../01-analisis-de-sistema/decisiones/ADR-003-control-concurrencia.md)) | Transacciones de PostgreSQL | `unidad-de-trabajo.port.ts`, `postgres-unidad-de-trabajo.ts` |
| Observer (eventos de dominio) | Pagos → Pedidos y Notificaciones | Avisar que un pago se validó sin acoplar los módulos y sin que una falla de notificaciones detenga el pago (DA11) | `@nestjs/event-emitter` (eventos en memoria) | `eventos.port.ts`, `eventos-nest.adapter.ts`, `pago-validado.listener.ts` |
| Facade | API pública de cada módulo | Otros módulos usan un único punto de entrada y no las clases internas | `index.ts` + `exports` del módulo NestJS | `pagos/index.ts`, `inventario/index.ts` |
| Dependency Injection | Raíz de composición de cada módulo | Conectar los puertos con sus implementaciones sin `new` dentro de los casos de uso | Contenedor de NestJS (`providers`) | `pagos.module.ts`, `pedidos.module.ts` |

## Cómo funciona cada patrón

| Patrón | En pocas palabras |
|---|---|
| Repository | El caso de uso dice `guardarSiEstado(pago, ESPERANDO_VALIDACION)`; el repositorio escribe el `UPDATE ... WHERE estado = ...`. |
| Adapter | El sistema dice `subirArchivo(qr)`; el adaptador lo traduce a la llamada de Supabase Storage o de Cloudflare R2. |
| Unit of Work | Abre la transacción, ejecuta la reserva de stock y el registro del pedido, y confirma todo o revierte todo. |
| Observer | Pagos publica `PagoValidado`; Pedidos habilita la preparación y Notificaciones avisa al cliente, cada uno por su cuenta. |
| Facade | Pedidos llama a `inventario.reservar(...)` sin conocer cómo está organizado el módulo Inventario por dentro. |
| Dependency Injection | `pagos.module.ts` decide que `PAGO_REPOSITORY` es `PostgresPagoRepository`; en las pruebas se usa una versión en memoria. |

## Beneficio

- Cambiar Supabase Storage por Cloudflare R2 solo afecta al adaptador de almacenamiento.
- Incorporar en el futuro una pasarela de pago (hoy excluida por RC14) solo requiere un nuevo adaptador en el módulo Pagos.
- Un error en Notificaciones no revierte una validación de pago ya registrada.
- Los casos de uso se prueban sin base de datos real.

## Patrones previstos para siguientes iteraciones

| Patrón | Dónde se aplicaría | Cuándo |
|---|---|---|
| State | Estados del pedido por puesto (espera de pago → preparación → listo para retiro → entregado) | Si las transiciones de estado crecen y se vuelven difíciles de mantener en la entidad |
| Strategy | Cálculo de promociones y descuentos | Al implementar el módulo Promociones |
| Strategy | Tolerancias de peso o precio (RF45) | Si el administrador necesita varias reglas de tolerancia configurables |
| Outbox | Pedidos y Pagos → Notificaciones | Si los eventos en memoria no son suficientes para garantizar el envío de notificaciones (DA11) |
