# Decisiones Arquitectónicas

Las decisiones arquitectónicas registran las elecciones de mayor impacto tomadas para responder a los drivers de la Plataforma Integral Multivendedor para la Gestión Comercial y Operativa de un Mercado de Abastos.

Cada decisión se documenta en detalle mediante un ADR (Architecture Decision Record) ubicado en la carpeta [decisiones](decisiones/).

| ID | Decisión arquitectónica | Driver relacionado | Justificación | Resultado |
|---|---|---|---|---|
| [ADR-001](decisiones/ADR-001-monolito-modular.md) | Monolito modular | DA04 – Escalabilidad y modularidad; DA12 – Mantenibilidad; DA14 – Tres capas | Separar responsabilidades por módulos manteniendo un único despliegue y la consistencia transaccional en PostgreSQL. | Backend NestJS con módulos de Usuarios, Comerciantes y puestos, Productos, Inventario, Catálogo, Carrito, Pedidos, Pagos, Promociones, Incidencias, Notificaciones, Auditoría y Reportes. |
| [ADR-002](decisiones/ADR-002-clean-architecture.md) | Clean Architecture | DA12 – Mantenibilidad (principal); DA03, DA04, DA05, DA11 | Proteger las reglas de negocio de inventario, pedidos y pagos frente a NestJS, PostgreSQL y Supabase. | Capas de Dominio, Aplicación, Presentación e Infraestructura dentro de cada módulo. |
| [ADR-003](decisiones/ADR-003-control-concurrencia.md) | Control de concurrencia en inventario | DA02 – Consistencia del inventario (principal); DA01, DA07, DA09 | Evitar que dos clientes reserven simultáneamente el mismo stock. | Transacciones cortas y actualizaciones condicionales en PostgreSQL, con idempotencia en la creación de pedidos. |
| [ADR-004](decisiones/ADR-004-pagos-qr.md) | Pagos mediante códigos QR de Yape o Plin | DA08 – Pagos por QR (principal); DA03, DA07, DA09, DA10 | La primera versión no usa pasarela bancaria; cada puesto cobra directamente al cliente. | Pago por puesto con validación manual del comerciante o trabajador autorizado y estados PENDIENTE, ESPERANDO_VALIDACION, VALIDADO, OBSERVADO y CANCELADO. |

La trazabilidad completa entre drivers y decisiones se encuentra en [Drivers arquitectónicos](06-drivers-arquitectonicos.md#trazabilidad-entre-drivers-y-decisiones-arquitectónicas).
