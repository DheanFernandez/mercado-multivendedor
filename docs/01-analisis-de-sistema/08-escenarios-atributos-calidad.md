# Escenarios de Atributos de Calidad

Los escenarios describen, de forma verificable, cómo debe responder la Plataforma Integral Multivendedor para la Gestión Comercial y Operativa de un Mercado de Abastos ante situaciones concretas relacionadas con sus atributos de calidad prioritarios.

Las medidas se basan en los [criterios de evaluación](04-atributos-de-calidad.md#criterios-de-evaluación-de-los-atributos-prioritarios) definidos en el análisis. Los valores cuantitativos son objetivos propuestos y deberán validarse mediante pruebas durante la implementación.

## EQ-01. Seguridad: validación de pagos por usuarios no autorizados

| Elemento | Descripción |
|---|---|
| **Atributo de calidad** | AC04 - Seguridad, AC12 - Privacidad |
| **Fuente** | Comerciante o trabajador de puesto que no pertenece al puesto, o usuario sin sesión |
| **Estímulo** | Intenta validar el pago, registrar la preparación o consultar las operaciones de un puesto que no tiene asignado. |
| **Condición** | La plataforma funciona normalmente y el usuario intenta la operación mediante la API REST. |
| **Respuesta esperada** | El backend rechaza la operación, no modifica el estado del pago ni del pedido y no expone información del puesto. |
| **Medida** | Rechazar el 100 % de los intentos no autorizados incluidos en las pruebas definidas, sin exposición de datos de otros puestos. |
| **Verificación** | Ejecutar pruebas de autorización por rol y por puesto sobre los endpoints de pagos, pedidos y reportes. |
| **Herramientas de medición** | **Vitest + Supertest** para la matriz de autorización (rol × endpoint × puesto ajeno), que verifica respuestas 401/403/404 y que el estado del pago no cambie. **OWASP ZAP** como complemento para vulnerabilidades generales de la API. |
| **Drivers relacionados** | DA03, DA08 |
| **Estado** | Pendiente de definir la estrategia general de seguridad (ver DA03 en [drivers](06-drivers-arquitectonicos.md)). |

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
| **Condición** | Los clientes y comerciantes están realizando pedidos y validando pagos. |
| **Respuesta esperada** | Las operaciones de compra, validación de pago y preparación continúan; el error se registra y no se pierden operaciones confirmadas. |
| **Medida** | Ninguna operación confirmada se pierde en las pruebas de fallo definidas. La meta numérica de disponibilidad está por definir. |
| **Verificación** | Simular la caída del servicio secundario y revisar los registros de errores y el estado de los pedidos. |
| **Herramientas de medición** | **Toxiproxy** (o **MSW/nock**) para simular la caída o lentitud del servicio de notificaciones o del almacenamiento. **Pino + Sentry** para comprobar que el error queda registrado. **UptimeRobot** para medir el porcentaje de disponibilidad cuando se defina la meta. |
| **Drivers relacionados** | DA11 |
| **Estado** | Pendiente de definir los mecanismos de aislamiento de fallos (ver DA11 en [drivers](06-drivers-arquitectonicos.md)). |

## EQ-07. Mantenibilidad: cambio en una regla de negocio

| Elemento | Descripción |
|---|---|
| **Atributo de calidad** | AC05 - Mantenibilidad |
| **Fuente** | Equipo de desarrollo |
| **Estímulo** | Se modifica una regla del módulo Pagos, por ejemplo, para incorporar una pasarela de pago en una versión futura. |
| **Condición** | Los módulos están organizados con Clean Architecture y cuentan con pruebas. |
| **Respuesta esperada** | El cambio se concentra en el módulo Pagos y en su infraestructura, sin modificar las reglas de negocio de otros módulos. |
| **Medida** | Las pruebas del módulo modificado y las pruebas de regresión acordadas se aprueban; las dependencias respetan la regla de dependencias. |
| **Verificación** | Revisar los cambios de código, ejecutar las pruebas e inspeccionar los `import` entre capas y módulos. |
| **Herramientas de medición** | **dependency-cruiser** con reglas que prohíben importaciones indebidas entre capas y módulos. **Vitest** (con cobertura) para las pruebas del módulo y de regresión. **SonarQube Cloud** como complemento para duplicación y complejidad del código. Todo ejecutado en **GitHub Actions** en cada pull request. |
| **Drivers relacionados** | DA12 · [ADR-002](decisiones/ADR-002-clean-architecture.md) |
| **Estado** | Pendiente de definir las pruebas obligatorias para los cambios. |

## Resumen de escenarios

| Código | Atributo de calidad | Qué se busca comprobar |
|---|---|---|
| EQ-01 | Seguridad | Que solo el comerciante o trabajador autorizado opere sobre su puesto. |
| EQ-02 | Integridad de la información | Que un pedido multivendedor se registre completo o no se registre. |
| EQ-03 | Concurrencia | Que no se reserve más stock del disponible. |
| EQ-04 | Rendimiento | Que el catálogo responda dentro del tiempo establecido. |
| EQ-05 | Escalabilidad | Que se incorporen puestos sin cambiar los módulos. |
| EQ-06 | Disponibilidad | Que un fallo secundario no detenga las operaciones principales. |
| EQ-07 | Mantenibilidad | Que los cambios se mantengan dentro del módulo responsable. |

## Resumen de medición

Las medidas son objetivos propuestos; ninguna ha sido ejecutada ni medida todavía.

| Código | Métrica | Método de comprobación | Herramientas | Estado |
|---|---|---|---|---|
| EQ-01 | 100 % de intentos no autorizados rechazados | Pruebas de autorización por rol y puesto | Vitest, Supertest, OWASP ZAP | Pendiente |
| EQ-02 | 0 pedidos, reservas o agrupaciones inconsistentes tras un fallo | Fallos forzados y revisión de inventario y pedidos | Vitest, Testcontainers, SQL | Pendiente |
| EQ-03 | 0 reservas incompatibles en pruebas concurrentes | Solicitudes simultáneas sobre el mismo producto | Vitest, Testcontainers, k6 | Pendiente |
| EQ-04 | 95 % de consultas en menos de 2 s con 100 usuarios (propuesta por validar) | Pruebas de carga | k6, Lighthouse | Pendiente |
| EQ-05 | Alta de puestos solo con registro de datos, sin cambios de código | Alta en entorno de prueba y flujo de compra | Drizzle + Faker, Playwright, `git diff` | Pendiente |
| EQ-06 | 0 operaciones confirmadas perdidas (meta de disponibilidad por definir) | Simulación de caída de un servicio secundario | Toxiproxy o MSW, Pino, Sentry, UptimeRobot | Pendiente |
| EQ-07 | Pruebas aprobadas y dependencias entre capas respetadas | Revisión de cambios, pruebas e inspección de `import` | dependency-cruiser, Vitest, SonarQube Cloud, GitHub Actions | Pendiente |
