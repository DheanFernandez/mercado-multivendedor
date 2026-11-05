# Drivers Arquitectónicos

Los drivers arquitectónicos representan los requisitos funcionales, atributos de calidad y restricciones que tienen una influencia significativa en la arquitectura de la Plataforma Integral Multivendedor para la Gestión Comercial y Operativa de un Mercado de Abastos.

| ID | Driver arquitectónico | Origen | ¿Por qué influye en la arquitectura? |
|---|---|---|---|
| DA01 | El sistema debe soportar múltiples clientes, comerciantes y trabajadores de puesto realizando operaciones simultáneamente. | AC01, AC07 | Requiere una arquitectura capaz de manejar concurrencia, múltiples solicitudes y procesamiento simultáneo sin afectar significativamente el rendimiento. |
| DA02 | El sistema debe mantener la consistencia del inventario durante operaciones concurrentes. | RF12, RF14, RF15, AC08 | Influye en el diseño de transacciones, reservas de stock y mecanismos que eviten ventas superiores al inventario disponible. |
| DA03 | La plataforma debe proteger información personal, credenciales y documentos sensibles. | AC04, AC12 | Influye en la autenticación, autorización, cifrado, gestión de permisos y protección de archivos. |
| DA04 | El sistema debe permitir incorporar nuevos comerciantes, puestos y productos sin modificar completamente la solución. | AC02 | Favorece una arquitectura modular con componentes desacoplados y responsabilidades bien definidas. |
| DA05 | La comunicación entre frontend y backend debe realizarse mediante una API REST. | RC06 | Determina el mecanismo principal de comunicación entre la aplicación Web/PWA y la API del monolito. |
| DA06 | La solución debe utilizar PostgreSQL como tecnología principal de persistencia. | RC07, RC08 | Determina la estrategia de almacenamiento de información estructurada y las relaciones entre usuarios, puestos, productos, pedidos, pagos e inventario. |
| DA07 | La plataforma debe permitir pedidos con productos provenientes de diferentes puestos. | RF20, RF21, RF26, RF29 | Requiere modelar un pedido principal y mantener agrupados los productos correspondientes a cada puesto comercial. |
| DA08 | Pago único por pedido con confirmación automática mediante pasarela de pago. | RC13, RC14, RF32, RF33, RF34 | Influye en el flujo de pago, ya que el sistema debe integrarse con Mercado Pago (Sandbox) para cobrar el pedido en un único pago, recibir la confirmación automática mediante Webhooks y asociar el cobro a la cuenta vinculada de cada comerciante. |
| DA09 | Los productos de un puesto no deben pasar a preparación si el pago correspondiente no ha sido aprobado por la pasarela. | RF35, AC08 | Requiere reglas de negocio que controlen estrictamente las transiciones de estado del pedido y de cada una de sus agrupaciones por puesto. |
| DA10 | La plataforma debe mantener trazabilidad de operaciones críticas. | RF42, AC06 | Requiere mecanismos de auditoría, registro de eventos y almacenamiento de información relacionada con cambios importantes. |
| DA11 | Los fallos de servicios secundarios no deben impedir las operaciones principales del sistema. | AC03, AC11, RC14 | Requiere mecanismos de aislamiento de fallos y desacoplamiento de servicios secundarios, como las notificaciones, para evitar que sus errores afecten los procesos críticos de compra, pago y preparación de pedidos. Además, Mercado Pago constituye una dependencia externa crítica: su indisponibilidad o el retraso en la recepción de Webhooks no debe dejar pedidos ni reservas de inventario en estados inconsistentes. |
| DA12 | La arquitectura debe facilitar cambios, correcciones y evolución de los módulos sin afectar innecesariamente otras funcionalidades. | AC05, RC12 | Requiere separar responsabilidades, reducir el acoplamiento entre módulos y establecer dependencias internas que protejan las reglas del negocio frente a cambios tecnológicos. |
| DA13 | La solución debe ser accesible desde computadoras y dispositivos móviles mediante navegador. | AC09, AC10, RC01 | Influye en el diseño de la aplicación Web/PWA y justifica el uso de una aplicación web responsive/PWA. |
| DA14 | La solución debe desarrollarse y desplegarse como una sola unidad por un equipo reducido, manteniendo consistencia transaccional entre módulos. | RC11, RC12, AC08 | Determina que la lógica de negocio se organice como una única aplicación desplegable, con módulos internos que compartan transacciones sobre la misma base de datos. |


## Drivers prioritarios

Para la primera versión del sistema se consideran especialmente relevantes los siguientes drivers:

1. **DA02 - Consistencia del inventario**
2. **DA03 - Seguridad de la información**
3. **DA12 - Mantenibilidad y evolución modular**
4. **DA04 - Escalabilidad y modularidad**
5. **DA07 - Pedidos multivendedor**
6. **DA08 - Pago único por pedido mediante pasarela de pago**
7. **DA09 - Control de estados del pedido**
8. **DA10 - Auditoría y trazabilidad**

Estos drivers influyen directamente en la separación de módulos, la gestión de persistencia, el control de concurrencia, la seguridad, la organización de los procesos de negocio y la comunicación entre la aplicación Web/PWA y la API del monolito.

El driver DA12 es fundamental para seleccionar Clean Architecture como enfoque arquitectónico, mientras que DA02 requiere mecanismos específicos para garantizar consistencia durante las operaciones concurrentes.


## Trazabilidad entre drivers y decisiones arquitectónicas

La siguiente matriz permite identificar cómo las decisiones arquitectónicas propuestas responden a los drivers definidos durante el análisis del sistema.

Los documentos ADR registran las decisiones de mayor impacto, mientras que los documentos de estilo y enfoque arquitectónico describen la organización global e interna de la solución.

| Driver | Decisión o documento relacionado | Respuesta arquitectónica |
|---|---|---|
| DA01 | ADR-003 | Transacciones y control de operaciones concurrentes. |
| DA02 | ADR-003 | Reservas de inventario mediante operaciones atómicas en PostgreSQL. |
| DA03 | ADR-002, ADR-005 | Separación de responsabilidades, protección de credenciales de Mercado Pago de cada comerciante y verificación de la autenticidad de los Webhooks. Requiere profundizar la estrategia general de seguridad. |
| DA04 | ADR-001, ADR-002 | Monolito modular y separación de responsabilidades internas. |
| DA05 | C4 Nivel 2, ADR-002 | Comunicación mediante API REST y controladores como adaptadores de entrada. |
| DA06 | C4 Nivel 2, ADR-003 | PostgreSQL como tecnología de persistencia y coordinación transaccional. |
| DA07 | ADR-003, ADR-005, C4 Nivel 2 | Coordinación del pedido principal, productos por puesto, reservas de inventario y pago único del pedido mediante Mercado Pago. |
| DA08 | ADR-005 | Pago único mediante Mercado Pago Checkout (Sandbox) y confirmación automática mediante Webhooks. |
| DA09 | ADR-005, ADR-003 | Aprobación del pago por la pasarela y control de transiciones de estado del pedido. |
| DA10 | ADR-005 | Registro de las notificaciones de pago recibidas desde Mercado Pago y de los cambios de estado asociados. Requiere ampliar la estrategia transversal de auditoría. |
| DA11 | ADR-002 | Desacoplamiento mediante interfaces. Requiere mecanismos adicionales de aislamiento de fallos. |
| DA12 | ADR-001, ADR-002 | Organización modular y aplicación de Clean Architecture. |
| DA13 | C4 Nivel 2 | Aplicación Web/PWA responsive mediante Next.js y TypeScript. |
| DA14 | ADR-001, arquitectura-inicial | Backend monolítico modular desplegado como una única aplicación con transacciones compartidas entre módulos. |

## Aspectos arquitectónicos pendientes de profundización

La matriz identifica tres drivers que requieren decisiones técnicas adicionales:

### DA03 - Seguridad de la información

Se deberá definir una estrategia de seguridad que contemple autenticación, autorización por roles, protección de documentos sensibles y control de acceso a la información de cada puesto comercial.

### DA10 - Auditoría y trazabilidad

Se deberá establecer qué operaciones críticas serán auditadas, qué información se registrará y qué roles estarán autorizados para consultar los registros.

### DA11 - Aislamiento de fallos

Se deberán definir mecanismos de aislamiento para evitar que los errores de servicios secundarios, como las notificaciones, interrumpan las operaciones críticas de compra, pago y preparación de pedidos.

Asimismo, se deberá definir el tratamiento de Mercado Pago como dependencia externa crítica: manejo de su indisponibilidad, recepción idempotente de Webhooks, reintentos ante notificaciones duplicadas o tardías y conciliación del estado del pago con la pasarela, liberando las reservas de inventario cuando el pago no sea aprobado.

Estos aspectos se desarrollarán mediante decisiones arquitectónicas complementarias, manteniendo la coherencia con el monolito modular y Clean Architecture seleccionados.
