# Principios de Diseño (SOLID)

## Objetivo

Documentar cómo se aplican los principios SOLID en el backend de la Plataforma Integral Multivendedor para la Gestión Comercial y Operativa de un Mercado de Abastos, organizado con Clean Architecture, para que cada módulo se programe de forma uniforme y las reglas de negocio no dependan de la tecnología.

## Contexto

- **Estilo:** monolito modular (NestJS + TypeScript).
- **Enfoque interno:** Clean Architecture (dominio, aplicación, presentación, infraestructura).
- **Módulo de referencia:** Pagos, porque integra autorización por puesto, control de estados, auditoría y eventos hacia Pedidos y Notificaciones ([diseño interno de módulos](diseño-interno-de-modulos.md)).

## SOLID en el módulo Pagos

| Principio | Dónde se aplica (capa) | Cómo se cumple en la plataforma | Archivos |
|---|---|---|---|
| **S** · Responsabilidad única | Todas las capas | Cada clase tiene una sola tarea: el controlador recibe la petición HTTP, el caso de uso coordina la validación, la entidad `Pago` controla sus estados y el repositorio guarda en PostgreSQL | `pagos.controller.ts`, `validar-pago.use-case.ts`, `pago.entity.ts`, `postgres-pago.repository.ts` |
| **O** · Abierto/cerrado | Infraestructura | Para pasar de Supabase Storage a Cloudflare R2 se crea un nuevo adaptador; los casos de uso que guardan el QR de cobro no se modifican | `supabase-storage.adapter.ts`, `r2-storage.adapter.ts` |
| **L** · Sustitución de Liskov | Infraestructura | `PostgresPagoRepository` y `PagoRepositoryEnMemoria` respetan el mismo contrato (`guardarSiEstado` devuelve `false` si el estado cambió); el caso de uso funciona igual con cualquiera | `postgres-pago.repository.ts`, `pago.repository.en-memoria.ts` |
| **I** · Segregación de interfaces | Aplicación (puertos) | Cada puerto tiene solo lo que Pagos necesita: `PermisosPuestoPort` solo verifica permisos, `AuditoriaPort` solo registra, `EventosPort` solo publica | `permisos-puesto.port.ts`, `auditoria.port.ts`, `eventos.port.ts` |
| **D** · Inversión de dependencias | Aplicación | `ValidarPagoUseCase` recibe interfaces por el constructor y no conoce PostgreSQL, Supabase ni NestJS; las implementaciones se conectan en `pagos.module.ts` | `validar-pago.use-case.ts`, `pagos.module.ts` |

## Qué pasaría sin SOLID en la plataforma

| Situación real | Sin SOLID | Con SOLID |
|---|---|---|
| Se cambia Supabase Storage por Cloudflare R2 | Hay que modificar todos los casos de uso que suben imágenes o códigos QR | Solo se reemplaza el adaptador de almacenamiento |
| En una versión futura se integra una pasarela de pago | Se reescribe la lógica de validación de pagos | Se agrega un adaptador y un caso de uso; las reglas del `Pago` se mantienen |
| Se quiere probar la validación de pagos | Se necesita PostgreSQL y usuarios reales en Supabase | Se prueba con implementaciones en memoria |
| Cambian los permisos del trabajador de puesto | Hay que buscar la regla en controladores y servicios | Solo cambia la implementación de `PermisosPuestoPort` en el módulo Comerciantes y puestos |
| Falla el envío de notificaciones | El error interrumpe la validación del pago | Notificaciones escucha el evento por su cuenta; el pago queda validado (DA11) |

## Relación con Clean Architecture y los patrones

| Principio | Lo cumple en el proyecto |
|---|---|
| Responsabilidad única | La separación en capas de Clean Architecture |
| Abierto/cerrado y Liskov | El patrón Adapter (almacenamiento de archivos) y los repositorios intercambiables |
| Segregación de interfaces | Los puertos de la capa de aplicación (`PagoRepository`, `PermisosPuestoPort`, `AuditoriaPort`, `EventosPort`) |
| Inversión de dependencias | La inyección de dependencias de NestJS y la regla de dependencias de [ADR-002](../../01-analisis-de-sistema/decisiones/ADR-002-clean-architecture.md) |
