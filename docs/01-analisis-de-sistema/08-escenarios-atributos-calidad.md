# Escenarios de Atributos de Calidad

Los escenarios describen, de forma verificable, cómo debe responder la Plataforma Integral Multivendedor para la Gestión Comercial y Operativa de un Mercado de Abastos ante situaciones concretas relacionadas con sus atributos de calidad prioritarios.

Las medidas se basan en los [criterios de evaluación](04-atributos-de-calidad.md#criterios-de-evaluación-de-los-atributos-prioritarios) definidos en el análisis. Los valores cuantitativos son objetivos propuestos y deberán validarse mediante pruebas durante la implementación.

## EQ-01. Seguridad: Webhook de pago falsificado o no autorizado

| Elemento | Descripción |
|---|---|
| **Atributo de calidad** | AC04 - Seguridad, AC08 - Integridad de la información |
| **Fuente** | Atacante externo o cliente malintencionado |
| **Estímulo** | Envía al endpoint del Webhook una notificación de pago aprobado con firma ausente, inválida, expirada o con un identificador de pago que no corresponde al pedido. |
| **Condición** | La plataforma funciona normalmente, el pedido tiene un pago PENDIENTE y la integración opera en el entorno Sandbox de Mercado Pago. |
| **Respuesta esperada** | El backend rechaza la notificación antes de procesarla, no modifica el estado del pago ni del pedido, no habilita la preparación y registra el intento. Una notificación con firma válida solo cambia el estado si la consulta a la API de Mercado Pago confirma el pago y su monto coincide con el pedido. |
| **Medida** | Rechazar el 100 % de las notificaciones falsificadas o no autorizadas incluidas en las pruebas definidas, con 0 pedidos habilitados para preparación sin un pago aprobado por la pasarela. |
| **Verificación** | Enviar notificaciones manipuladas (sin firma, firma alterada, marca de tiempo antigua, monto o referencia distintos) y comprobar el estado del pago, del pedido y del registro de auditoría. |
| **Herramientas de medición** | **Vitest + Supertest** para enviar notificaciones manipuladas al endpoint del Webhook y verificar la respuesta y que el estado del pago no cambie. **MSW/nock** para simular la respuesta de la API de Mercado Pago. **Simulador de notificaciones de Mercado Pago (Sandbox)** para validar la firma real. **OWASP ZAP** como complemento para vulnerabilidades generales de la API. |
| **Drivers relacionados** | DA03, DA08, DA09 · [ADR-005](decisiones/ADR-005-pago-unico-mercado-pago.md) |
| **Estado** | Pendiente de implementar la verificación de firma del Webhook. |

## EQ-02. Integridad de la información: pedido multivendedor

| Elemento | Descripción |
|---|---|
| **Atributo de calidad** | AC08 - Integridad de la información |
| **Fuente** | Cliente |
| **Estímulo** | Confirma un pedido con productos de varios puestos y una de las reservas de inventario falla. |
| **Condición** | La operación se ejecuta dentro de una transacción de PostgreSQL. |
| **Respuesta esperada** | El sistema revierte todas las reservas y no registra un pedido parcial; informa al cliente qué producto no está disponible. |
| **Medida** | En las pruebas definidas, ninguna operación fallida deja reservas, pedidos o agrupaciones por puesto inconsistentes. |
| **Verificación** | Forzar fallos durante la creación del pedido y revisar el estado del inventario y de los pedidos. |
| **Herramientas de medición** | **Vitest + Testcontainers** (PostgreSQL desechable) para forzar el fallo de una reserva dentro de la transacción. **Consultas SQL** de verificación para comparar el número de pedidos y reservas antes y después del fallo. |
| **Drivers relacionados** | DA02, DA07 · [ADR-003](decisiones/ADR-003-control-concurrencia.md) |
| **Estado** | Pendiente de definir el modelo de datos definitivo. |

## EQ-03. Concurrencia: reserva simultánea del mismo stock

| Elemento | Descripción |
|---|---|
| **Atributo de calidad** | AC07 - Concurrencia |
| **Fuente** | Dos o más clientes |
| **Estímulo** | Confirman al mismo tiempo pedidos que solicitan el último stock disponible de un producto del mismo puesto. |
| **Condición** | El stock disponible solo alcanza para uno de los pedidos. |
| **Respuesta esperada** | Solo una reserva se confirma; las demás reciben una respuesta controlada indicando falta de stock. |
| **Medida** | Dos clientes no confirman reservas incompatibles sobre el mismo stock en el 100 % de las pruebas concurrentes ejecutadas. |
| **Verificación** | Ejecutar solicitudes simultáneas sobre el mismo producto y comprobar que el stock reservado nunca supera el stock físico. |
| **Herramientas de medición** | **Vitest** con solicitudes simultáneas (`Promise.all`) contra PostgreSQL en **Testcontainers**, seguido de una consulta SQL que compruebe que el stock reservado no supera el stock físico. **k6** para repetir la prueba con mayor volumen de solicitudes. |
| **Drivers relacionados** | DA01, DA02 · [ADR-003](decisiones/ADR-003-control-concurrencia.md) |
| **Estado** | Pendiente de implementar las pruebas concurrentes. |

## EQ-04. Rendimiento: consulta del catálogo

| Elemento | Descripción |
|---|---|
| **Atributo de calidad** | AC01 - Rendimiento |
| **Fuente** | Cliente |
| **Estímulo** | Busca, filtra o consulta el detalle de productos de diferentes puestos. |
| **Condición** | La plataforma funciona normalmente con datos representativos de comerciantes, puestos y productos. |
| **Respuesta esperada** | El sistema muestra los resultados sin errores inesperados. |
| **Medida** | **Propuesta por validar:** con 100 usuarios concurrentes, al menos el 95 % de las consultas del catálogo responde en menos de 2 segundos. |
| **Verificación** | Ejecutar pruebas de carga y registrar tiempos de respuesta, errores y usuarios simultáneos. |
| **Herramientas de medición** | **k6** con 100 usuarios virtuales y umbrales (`p(95)<2000` en tiempo de respuesta y tasa de errores) que indican automáticamente si se cumple la medida. **Lighthouse** como complemento para el tiempo de carga de la interfaz web. |
| **Drivers relacionados** | DA01 |
| **Estado** | Pendiente de definir el entorno de prueba. |

## EQ-05. Escalabilidad: incorporación de nuevos comerciantes y puestos

| Elemento | Descripción |
|---|---|
| **Atributo de calidad** | AC02 - Escalabilidad |
| **Fuente** | Administrador |
| **Estímulo** | Registra nuevos comerciantes, puestos y productos en la plataforma. |
| **Condición** | El sistema ya opera con otros comerciantes y puestos activos. |
| **Respuesta esperada** | Los nuevos puestos quedan operativos sin modificar la estructura de los módulos existentes. |
| **Medida** | La incorporación se realiza solo mediante registro de datos, sin cambios en el código de los módulos. |
| **Verificación** | Registrar nuevos puestos en un entorno de prueba y comprobar el flujo completo de compra. |
| **Herramientas de medición** | **Script de seed (Drizzle + Faker)** para registrar nuevos comerciantes, puestos y productos. **Playwright** para recorrer el flujo completo de compra en un puesto nuevo. **`git diff --stat`** para evidenciar que no se modificó código. |
| **Drivers relacionados** | DA04 · [ADR-001](decisiones/ADR-001-monolito-modular.md) |
| **Estado** | Pendiente de confirmar la cantidad esperada de comerciantes y puestos. |

## EQ-06. Disponibilidad: fallo de un servicio secundario

| Elemento | Descripción |
|---|---|
| **Atributo de calidad** | AC03 - Disponibilidad, AC11 - Recuperabilidad |
| **Fuente** | Falla interna |
| **Estímulo** | El servicio de notificaciones o el almacenamiento de archivos no responde durante el horario de operación del mercado. |
| **Condición** | Los clientes están realizando pedidos y pagos mediante Mercado Pago, y los comerciantes están preparando pedidos con pago aprobado. |
| **Respuesta esperada** | Las operaciones de compra, recepción de la confirmación de pago y preparación continúan; el error se registra y no se pierden operaciones confirmadas. |
| **Medida** | Ninguna operación confirmada se pierde en las pruebas de fallo definidas. La meta numérica de disponibilidad está por definir. |
| **Verificación** | Simular la caída del servicio secundario y revisar los registros de errores y el estado de los pedidos. |
| **Herramientas de medición** | **Toxiproxy** (o **MSW/nock**) para simular la caída o lentitud del servicio de notificaciones o del almacenamiento. **Pino + Sentry** para comprobar que el error queda registrado. **UptimeRobot** para medir el porcentaje de disponibilidad cuando se defina la meta. |
| **Drivers relacionados** | DA11 |
| **Estado** | Pendiente de definir los mecanismos de aislamiento de fallos (ver DA11 en [drivers](06-drivers-arquitectonicos.md)). |

## EQ-07. Mantenibilidad: intercambio del adaptador de pago (Split o cobro centralizado)

| Elemento | Descripción |
|---|---|
| **Atributo de calidad** | AC05 - Mantenibilidad |
| **Fuente** | Equipo de desarrollo |
| **Estímulo** | Se reemplaza el adaptador de pago vigente por una de las alternativas de respaldo de ADR-005: división de pagos (Split) entre las cuentas de los comerciantes o cobro centralizado con liquidación posterior. |
| **Condición** | El módulo Pagos expone el puerto `PasarelaPagoPort` y ambos adaptadores implementan el mismo contrato; los módulos cuentan con pruebas. |
| **Respuesta esperada** | El cambio se limita a la implementación del adaptador y a la composición de dependencias del módulo Pagos, sin modificar el dominio ni los casos de uso de Pagos, Pedidos e Inventario. |
| **Medida** | 0 archivos modificados fuera de la infraestructura y la configuración del módulo Pagos; la misma suite de pruebas de contrato se aprueba con ambos adaptadores, y las pruebas de regresión acordadas se aprueban. |
| **Verificación** | Sustituir el adaptador en un entorno de prueba, ejecutar la suite de contrato contra ambas implementaciones, revisar los cambios de código e inspeccionar los `import` entre módulos. |
| **Herramientas de medición** | **Vitest** con una suite de pruebas de contrato parametrizada para `PasarelaPagoPort` ejecutada contra ambos adaptadores, usando **MSW/nock** para simular Mercado Pago. **dependency-cruiser** con reglas que prohíben importar el SDK de Mercado Pago fuera del adaptador. **`git diff --stat`** para evidenciar los archivos modificados. Todo ejecutado en **GitHub Actions** en cada pull request. |
| **Drivers relacionados** | DA11, DA12 · [ADR-002](decisiones/ADR-002-clean-architecture.md), [ADR-005](decisiones/ADR-005-pago-unico-mercado-pago.md) |
| **Estado** | Pendiente de definir el contrato de `PasarelaPagoPort` y la suite de pruebas de contrato. |

## EQ-08. Disponibilidad: Webhook duplicado o caída de la pasarela

| Elemento | Descripción |
|---|---|
| **Atributo de calidad** | AC03 - Disponibilidad, AC06 - Observabilidad, AC08 - Integridad de la información |
| **Fuente** | Mercado Pago (servicio externo) |
| **Estímulo** | Mercado Pago envía varias veces la misma notificación de pago aprobado, o deja de responder y no entrega la notificación de un pago ya aprobado. |
| **Condición** | Existen pedidos con pagos pendientes y reservas de inventario vigentes durante el horario de operación del mercado. |
| **Respuesta esperada** | Las notificaciones duplicadas se registran y se ignoran sin generar cambios de estado adicionales. Ante la caída de la pasarela, el catálogo, el carrito y la preparación de pedidos ya aprobados siguen operativos, y la conciliación periódica actualiza los pagos pendientes al restablecerse el servicio, liberando las reservas de los pagos no aprobados. |
| **Medida** | 0 pagos procesados más de una vez y 0 pedidos con estado de pago indefinido en las pruebas definidas; los pagos sin notificación se concilian en un máximo de 15 minutos desde el restablecimiento del servicio. |
| **Verificación** | Reenviar la misma notificación varias veces y simular la indisponibilidad de Mercado Pago durante el pago; revisar el estado de pagos, pedidos, reservas y registros de notificaciones. |
| **Herramientas de medición** | **Vitest + Supertest** para reenviar notificaciones duplicadas y comprobar un único cambio de estado. **Toxiproxy** (o **MSW/nock**) para simular la caída o lentitud de la API de Mercado Pago. **Consultas SQL** para verificar pagos, reservas y registros de notificaciones. **Pino + Sentry** para comprobar que los errores quedan registrados. |
| **Drivers relacionados** | DA08, DA10, DA11 · [ADR-003](decisiones/ADR-003-control-concurrencia.md), [ADR-005](decisiones/ADR-005-pago-unico-mercado-pago.md) |
| **Estado** | Pendiente de implementar la idempotencia del Webhook y la conciliación periódica. |

## Resumen de escenarios

| Código | Atributo de calidad | Qué se busca comprobar |
|---|---|---|
| EQ-01 | Seguridad | Que un Webhook falsificado o no autorizado no modifique el estado de un pago. |
| EQ-02 | Integridad de la información | Que un pedido multivendedor se registre completo o no se registre. |
| EQ-03 | Concurrencia | Que no se reserve más stock del disponible. |
| EQ-04 | Rendimiento | Que el catálogo responda dentro del tiempo establecido. |
| EQ-05 | Escalabilidad | Que se incorporen puestos sin cambiar los módulos. |
| EQ-06 | Disponibilidad | Que un fallo secundario no detenga las operaciones principales. |
| EQ-07 | Mantenibilidad | Que el adaptador de pago se intercambie sin modificar otros módulos. |
| EQ-08 | Disponibilidad | Que los Webhooks duplicados o la caída de la pasarela no dejen pagos ni pedidos inconsistentes. |

## Resumen de medición

Las medidas son objetivos propuestos; ninguna ha sido ejecutada ni medida todavía.

| Código | Métrica | Método de comprobación | Herramientas | Estado |
|---|---|---|---|---|
| EQ-01 | 100 % de Webhooks falsificados rechazados y 0 pedidos habilitados sin pago aprobado | Envío de notificaciones manipuladas al Webhook | Vitest, Supertest, MSW/nock, Sandbox de Mercado Pago, OWASP ZAP | Pendiente |
| EQ-02 | 0 pedidos, reservas o agrupaciones inconsistentes tras un fallo | Fallos forzados y revisión de inventario y pedidos | Vitest, Testcontainers, SQL | Pendiente |
| EQ-03 | 0 reservas incompatibles en pruebas concurrentes | Solicitudes simultáneas sobre el mismo producto | Vitest, Testcontainers, k6 | Pendiente |
| EQ-04 | 95 % de consultas en menos de 2 s con 100 usuarios (propuesta por validar) | Pruebas de carga | k6, Lighthouse | Pendiente |
| EQ-05 | Alta de puestos solo con registro de datos, sin cambios de código | Alta en entorno de prueba y flujo de compra | Drizzle + Faker, Playwright, `git diff` | Pendiente |
| EQ-06 | 0 operaciones confirmadas perdidas (meta de disponibilidad por definir) | Simulación de caída de un servicio secundario | Toxiproxy o MSW, Pino, Sentry, UptimeRobot | Pendiente |
| EQ-07 | 0 archivos modificados fuera del módulo Pagos y suite de contrato aprobada con ambos adaptadores | Sustitución del adaptador y pruebas de contrato | Vitest, MSW/nock, dependency-cruiser, `git diff`, GitHub Actions | Pendiente |
| EQ-08 | 0 pagos duplicados, 0 pedidos con pago indefinido y conciliación en máximo 15 min | Reenvío de notificaciones y simulación de caída de la pasarela | Vitest, Supertest, Toxiproxy o MSW, SQL, Pino, Sentry | Pendiente |
