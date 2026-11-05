# Principios de Diseño (SOLID)

## Objetivo

Documentar cómo se aplican los principios SOLID en el backend de la Plataforma Integral Multivendedor para la Gestión Comercial y Operativa de un Mercado de Abastos, organizado con Clean Architecture, para que cada módulo se programe de forma uniforme y las reglas de negocio no dependan de la tecnología.

## Contexto

- **Estilo:** monolito modular (NestJS + TypeScript).
- **Enfoque interno:** Clean Architecture (dominio, aplicación, adaptadores de entrada, infraestructura).
- **Módulo de referencia:** Pagos, porque integra la verificación del Webhook de Mercado Pago, la consulta a la pasarela, la idempotencia, el control de estados, la auditoría y los eventos hacia Pedidos y Notificaciones ([diseño interno de módulos](diseño-interno-de-modulos.md)).

## SOLID en el módulo Pagos

| Principio | Dónde se aplica (anillo) | Cómo se cumple en la plataforma | Archivos |
|---|---|---|---|
| **S** · Responsabilidad única | Todos los anillos | Cada clase tiene una sola tarea: `MercadoPagoWebhookController` recibe la notificación y verifica su firma, `ProcesarNotificacionPagoUseCase` coordina el procesamiento, la entidad `Pago` controla sus estados, `MercadoPagoCheckoutAdapter` se comunica con la pasarela y el repositorio guarda en PostgreSQL | `mercado-pago-webhook.controller.ts`, `procesar-notificacion-pago.use-case.ts`, `pago.entity.ts`, `mercado-pago-checkout.adapter.ts`, `postgres-pago.repository.ts` |
| **O** · Abierto/cerrado | Infraestructura | Para cambiar la modalidad de cobro (Checkout único, Split por puesto o simulador local) se agrega un adaptador que implementa `PasarelaPagoPort` y se selecciona en `pagos.module.ts`; los casos de uso `IniciarPago` y `ProcesarNotificacionPago` y la entidad `Pago` no se modifican | `pasarela-pago.port.ts`, `mercado-pago-checkout.adapter.ts`, `mercado-pago-split.adapter.ts`, `pasarela-pago-local.adapter.ts` |
| **L** · Sustitución de Liskov | Infraestructura | `PostgresPagoRepository` y `PagoRepositoryEnMemoria` respetan el mismo contrato (`guardarSiEstado` devuelve `false` si el estado cambió); el caso de uso funciona igual con cualquiera | `postgres-pago.repository.ts`, `pago.repository.en-memoria.ts` |
| **I** · Segregación de interfaces | Aplicación (puertos) | Cada puerto tiene solo lo que Pagos necesita: `PasarelaPagoPort` solo crea cobros, consulta pagos y reembolsa; `VerificadorFirmaWebhookPort` solo verifica firmas; `NotificacionPagoRepository` solo registra notificaciones; `OutboxPort` solo registra eventos; `AuditoriaPort` solo registra operaciones | `pasarela-pago.port.ts`, `verificador-firma-webhook.port.ts`, `notificacion-pago.repository.ts`, `outbox.port.ts`, `auditoria.port.ts` |
| **D** · Inversión de dependencias | Aplicación | `ProcesarNotificacionPagoUseCase` recibe interfaces por el constructor y no conoce PostgreSQL, Supabase, Mercado Pago ni NestJS; las implementaciones se conectan en `pagos.module.ts` | `procesar-notificacion-pago.use-case.ts`, `pagos.module.ts` |

## Qué pasaría sin SOLID en la plataforma

| Situación real | Sin SOLID | Con SOLID |
|---|---|---|
| Se cambia Supabase Storage por Cloudflare R2 | Hay que modificar todos los casos de uso que suben imágenes | Solo se reemplaza el adaptador de almacenamiento |
| Se pasa del cobro único (Checkout) a la división por puesto (Split) | Se reescribe la lógica de cobro y de procesamiento de notificaciones | Se agrega `MercadoPagoSplitAdapter` y se cambia `PASARELA_PAGO_MODO`; las reglas del `Pago` y los casos de uso se mantienen |
| Se quiere probar el procesamiento de notificaciones de pago | Se necesita PostgreSQL y una conexión real con Mercado Pago | Se prueba con `PasarelaPagoLocalAdapter` y repositorios en memoria |
| Cambia el mecanismo de firma de los Webhooks de Mercado Pago | Hay que buscar la verificación en controladores y servicios | Solo cambia la implementación de `VerificadorFirmaWebhookPort`; `MercadoPagoWebhookController` y `ProcesarNotificacionPagoUseCase` se mantienen |
| Falla el envío de notificaciones | El error interrumpe el procesamiento del pago | El evento `PagoAprobado` queda registrado en el Outbox y Notificaciones lo procesa por su cuenta; el pago queda aprobado (DA11) |

## Relación con Clean Architecture y los patrones

| Principio | Lo cumple en el proyecto |
|---|---|
| Responsabilidad única | La separación en anillos de Clean Architecture dentro de cada módulo |
| Abierto/cerrado y Liskov | Los patrones Adapter y Strategy de la pasarela de pago (`PasarelaPagoPort`), el adaptador de almacenamiento de archivos y los repositorios intercambiables |
| Segregación de interfaces | Los puertos del anillo de aplicación (`PagoRepository`, `PasarelaPagoPort`, `VerificadorFirmaWebhookPort`, `NotificacionPagoRepository`, `OutboxPort`, `AuditoriaPort`) |
| Inversión de dependencias | La inyección de dependencias de NestJS y la regla de dependencias de [ADR-002](../../01-analisis-de-sistema/decisiones/ADR-002-clean-architecture.md) |
