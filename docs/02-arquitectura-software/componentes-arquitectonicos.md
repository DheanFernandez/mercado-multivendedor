# Componentes Arquitectónicos

Este documento identifica los componentes que forman la Plataforma Integral Multivendedor para la Gestión Comercial y Operativa de un Mercado de Abastos, su responsabilidad y los requisitos que atienden.

La organización responde al estilo arquitectónico de [monolito modular](../01-analisis-de-sistema/decisiones/ADR-001-monolito-modular.md) y a la [organización interna de los módulos mediante Clean Architecture](enfoque-arquitectonico.md).

## 1. Componentes por contenedor

| Contenedor | Componente | Tecnología | Responsabilidad |
|---|---|---|---|
| Aplicación Web/PWA | Aplicación Web/PWA | Next.js + TypeScript | Interfaces del marketplace, carrito, resumen del pago único y redirección al Checkout de Mercado Pago, panel del comerciante, del trabajador de puesto y del administrador. |
| API del monolito | API REST | NestJS + TypeScript | Punto de entrada HTTP: autenticación, validación de solicitudes, recepción del Webhook de Mercado Pago y delegación a los módulos. |
| API del monolito | Módulos de negocio | NestJS + TypeScript | Reglas de negocio organizadas en módulos independientes (ver sección 2). |
| Base de datos | Base de datos | PostgreSQL (Supabase) | Información estructurada: usuarios, puestos, cuentas de Mercado Pago vinculadas, productos, inventario, pedidos, pagos, notificaciones de pago y auditoría. |
| Almacenamiento de archivos | Almacenamiento de archivos | Supabase Storage (alternativa: Cloudflare R2) | Imágenes de productos y tiendas, y documentos de la plataforma. |

## 2. Módulos de negocio

| Módulo | Responsabilidad | Requisitos funcionales |
|---|---|---|
| **Autenticación y usuarios** | Registro, inicio de sesión, perfiles, roles y permisos. | RF01–RF05 |
| **Comerciantes y puestos** | Comerciantes, puestos comerciales, tiendas virtuales y vinculación de la cuenta de Mercado Pago de cada comerciante. | RF06–RF08, RF52 |
| **Productos y categorías** | Registro, actualización, precios, presentaciones, imágenes y clasificación de productos. | RF09–RF11 |
| **Inventario** | Stock físico, reservado y disponible; movimientos de inventario y reservas. | RF12–RF15, RF25 |
| **Marketplace y catálogo** | Catálogo general, búsqueda, filtros y detalle de productos. | RF16–RF19 |
| **Carrito multivendedor** | Carrito con productos de varios puestos, subtotales por puesto y total general. | RF20–RF24 |
| **Pedidos** | Pedido principal agrupado por puesto, estados, preparación, retiro en el puesto y variaciones de peso o precio. | RF26–RF31, RF36–RF39 |
| **Pagos** | Pago único por pedido mediante Mercado Pago Checkout, recepción y verificación del Webhook, procesamiento idempotente de notificaciones, conciliación periódica, reembolsos, registro de comisiones y vencimiento del pago ligado a la reserva. Integra la pasarela mediante `PasarelaPagoPort` y `MercadoPagoAdapter`. | RF32–RF35, RF47–RF51, RF53–RF55 |
| **Incidencias** | Cancelaciones, devoluciones, reclamos e incidencias; las devoluciones de dinero se ejecutan mediante el módulo Pagos. | RF40 |
| **Notificaciones** | Avisos a los usuarios sobre cambios de estado del pedido. | RF41 |
| **Auditoría** | Registro de operaciones críticas y trazabilidad. | RF42 |
| **Reportes** | Indicadores, estadísticas, paneles, consultas de operaciones por puesto y resultados de la conciliación de pagos. | RF43, RF44, RF46 |
| **Configuración operativa** *(transversal)* | Reglas operativas como tiempos de reserva y tolerancias de peso o precio. Es consultada por Pedidos e Inventario. | RF45 |

> RF45 se atiende en un módulo propio, **Configuración operativa**, incluido en la lista de [ADR-001](../01-analisis-de-sistema/decisiones/ADR-001-monolito-modular.md).

### Priorización de módulos para el primer incremento funcional

La priorización se propone considerando el flujo principal de compra
multivendedor, las dependencias entre módulos y los riesgos asociados
a inventario, pedidos y pagos.

| Prioridad | Módulos | Justificación |
|---|---|---|
| **P0 - Críticos** | Autenticación y usuarios; Comerciantes y puestos; Productos y categorías; Marketplace y catálogo; Inventario; Carrito multivendedor; Pedidos; Pagos | Permiten completar el flujo principal de compra, desde la consulta de productos hasta la aprobación del pago único por la pasarela. |
| **P1 - Soporte importante** | Incidencias; Notificaciones; Auditoría; Configuración operativa | Complementan el control de operaciones, la trazabilidad y las reglas configurables. |
| **P2 - Gestión complementaria** | Reportes | Facilita el análisis y la supervisión de operaciones. |

**Criterio:** P0 corresponde a los módulos fundamentales para
la compra; P1 a capacidades de soporte; y P2 a funciones analíticas. La prioridad se justifica por:

- **Dependencias del flujo de compra:** catálogo, carrito, pedidos y pagos dependen de usuarios, puestos y productos (ver dependencias en el [diagrama de componentes C4 nivel 3](../04-modelo-c4/Nivel3-Diagrama-de-Componentes.md)).
- **Riesgo de inventario:** Inventario y Pedidos concentran la reserva de stock y la consistencia ([ADR-003](../01-analisis-de-sistema/decisiones/ADR-003-control-concurrencia.md), DA02).
- **Seguridad de pagos:** Pagos, la verificación del Webhook (RF48) y la aprobación por la pasarela (RF35) condicionan la preparación del pedido ([ADR-005](../01-analisis-de-sistema/decisiones/ADR-005-pago-unico-mercado-pago.md), DA08, DA09).
- **Trazabilidad:** Auditoría (DA10) y Notificaciones apoyan el flujo principal, pero este puede operar sin ellos en el primer incremento; por eso se proponen como P1. Sus fallos no deben detener la compra (DA11).

**Estado:** Priorización propuesta para validación del equipo.
Esta clasificación no elimina requisitos funcionales.


## 3. Componentes externos

| Componente | Tipo | Relación con la plataforma |
|---|---|---|
| Mercado Pago | Pasarela de pago (entorno Sandbox) | Cobro del pago único del pedido mediante Checkout, consulta de pagos y reembolsos por API, y notificación del resultado mediante Webhooks. Cada comerciante vincula su cuenta. |
| Supabase | Proveedor de base de datos y almacenamiento | Aloja PostgreSQL y Supabase Storage. |

## 4. Diagrama de componentes

Para evitar duplicación, el diagrama de componentes del contenedor API del monolito se mantiene únicamente en [Nivel 3 · Diagrama de componentes](../04-modelo-c4/Nivel3-Diagrama-de-Componentes.md), donde se detallan responsabilidades y relaciones entre módulos.

Contexto adicional:

- [Nivel 2 · Diagrama de contenedores](../04-modelo-c4/Nivel2-DiagramadeContenedores.md)
- [Nivel 3 · Diagrama de componentes](../04-modelo-c4/Nivel3-Diagrama-de-Componentes.md)

## 5. Verificación de coherencia documental

Revisión documental de la coherencia entre artefactos. No constituye una evaluación formal (ATAM) ni incluye pruebas ejecutadas.

| Aspecto revisado | Evidencia | Resultado de la revisión | Pendiente |
|---|---|---|---|
| HU frente a RF | [Requisitos funcionales](../01-analisis-de-sistema/03-requisitos-funcionales.md#relación-entre-historias-de-usuario-y-requisitos-funcionales) | HU01–HU29 tienen RF asociados. | RF41 (notificaciones) no figura en ninguna HU; el equipo debe decidir su vínculo. |
| RF frente a módulos | Tabla de la sección 2 | RF01–RF55 están asignados a algún módulo de negocio. | — |
| Atributos frente a escenarios | [Escenarios de calidad](../01-analisis-de-sistema/08-escenarios-atributos-calidad.md) | EQ-01 a EQ-08 definen medida y verificación. | Todos los escenarios siguen sin pruebas ejecutadas; no hay resultados medidos. |
| Drivers frente a ADR | [Trazabilidad](../01-analisis-de-sistema/06-drivers-arquitectonicos.md#trazabilidad-entre-drivers-y-decisiones-arquitectónicas) | DA01–DA14 tienen decisión o documento asociado. | DA03, DA10 y DA11 requieren decisiones complementarias. |
| Diagramas C1–C4 frente al diseño | [Modelo C4](../04-modelo-c4/Nivel3-Diagrama-de-Componentes.md) | Los 13 módulos del diagrama C3 coinciden con la sección 2. | Revisar C1, C2 y C4 si cambian módulos o restricciones. |
| Priorización de módulos | Sección 2 de este documento | Los 13 módulos figuran una sola vez en P0, P1 o P2. | Validación del equipo. |
