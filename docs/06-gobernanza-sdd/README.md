# Gobernanza SDD (Spec-Driven Development)

Documentos para que los dos integrantes revisen y aprueben la gobernanza del proyecto **antes** de iniciar nuevas funcionalidades. Constitución vigente: [`.specify/memory/constitution.md`](../../.specify/memory/constitution.md) v1.1.1 (borrador hasta la ratificación).

> **Estado general: PROPUESTO. Ninguna decisión DEC-01 a DEC-12 está aprobada.** Ningún documento de esta carpeta modifica `docs/01` a `docs/05`, el código, el esquema Prisma ni los datos de Supabase.

## Documentos

| # | Documento | Contenido | Estado |
|---|---|---|---|
| 01 | [Revisión de consistencia](01-revision-de-consistencia.md) | Matriz de contradicciones C-01 a C-23, pagos, límites entre módulos, orden de especificaciones | Análisis |
| 02 | [Registro de decisiones](02-registro-de-decisiones.md) | DEC-01 a DEC-12 con opciones, recomendación, impacto y estado | `PENDIENTE` |
| — | [Borrador de ADR-006](borradores/ADR-006-modelo-de-pagos-y-distribucion.md) | Pago único + distribución contable simulada (cuatro conceptos separados) | **Borrador, no aceptado** |
| 03 | [Contratos públicos entre módulos](03-contratos-publicos-entre-modulos.md) | `auth`, `users`, `merchants`, `products`, `catalog` | Propuesta (DEC-03) |
| 04 | [Workflow SDD de ocho etapas](04-workflow-sdd-ocho-etapas.md) y [`workflows/mercado-sdd.yml`](workflows/mercado-sdd.yml) | Flujo propio, separado del de Spec Kit; cargado con `info`, **no ejecutado** | Propuesta (DEC-08) |
| 05 | [Matriz de regularización](05-matriz-de-regularizacion.md) | R1, R2, R3: evidencia, criterios, huecos y artefactos que faltan | Propuesta |

## Separación de estados

### Aprobadas (vigentes por declaración del equipo)

No son decisiones DEC. Son las decisiones de arquitectura que el equipo declaró y que la constitución recoge; **formalmente** los ADR siguen en estado «Propuesta» hasta resolver DEC-04.

1. Monolito modular con NestJS (ADR-001).
2. Clean Architecture dentro de cada módulo (ADR-002).
3. Frontend con Next.js, React y TypeScript.
4. Persistencia con Prisma y PostgreSQL en Supabase.
5. Autenticación con Supabase Auth y roles almacenados en PostgreSQL.
6. Pago único por pedido con Mercado Pago Sandbox (ADR-005, solo el pago único; ver DEC-01 para la distribución).
7. Inventario con transacciones y reservas atómicas (ADR-003).
8. Seguridad (secretos fuera de Git, autorización en backend, aislamiento entre comerciantes), calidad (pruebas unitarias, HTTP, integración y compilación) y trazabilidad (HU, RF, ADR y criterios de aceptación).
9. Flujo obligatorio de ocho etapas (el archivo que lo automatiza es una propuesta: DEC-08).

### Propuestas

DEC-01 a DEC-12 · borrador de ADR-006 · contratos públicos · workflow `mercado-sdd.yml` · matriz de regularización · especificaciones R1, R2 y R3 por redactar.

### Cuestiones bloqueantes

| Bloqueo | Qué impide | Se desbloquea con |
|---|---|---|
| Modelo de distribución del pago único y vinculación de cuentas | Especificar `payments` (más allá de la aclaración); RF52, HU11, HU27 | DEC-01, DEC-02 y ADR-006 aceptado |
| Base de datos desechable para pruebas | Pruebas de concurrencia de Inventario (ADR-003, EQ-03) | DEC-07 fase 2 |
| Modelo de permisos y trabajadores de puesto | Pedidos: preparación y entrega por trabajador (RF36, RF39) | DEC-09 |
| Prioridad de Auditoría | Inventario, Pedidos y Pagos la usan (C4 nivel 3) | DEC-05 |
| Aprobación de los contratos públicos | Tareas de deuda de R1, R2 y R3 (importaciones internas y lectura de tablas ajenas) | DEC-03 |
| Credencial `SUPABASE_SERVICE_ROLE_KEY` ausente | Verificación real de Storage (`npm run storage:verificar`) y de las invitaciones | Acción manual, no es una decisión de gobernanza |

## Qué falta para empezar a desarrollar

1. Que ambos integrantes revisen y marquen el estado de DEC-01 a DEC-12 en el [registro](02-registro-de-decisiones.md).
2. Aceptar o ajustar el ADR-006 y registrar la enmienda en la constitución (principio VI).
3. Ratificar la constitución (DEC-12).
4. Ejecutar el flujo con R1, R2 y R3, y luego con los módulos pendientes en el orden de la revisión.
