# Drivers Arquitectónicos

Los drivers arquitectónicos representan los requisitos funcionales, atributos de calidad y restricciones que tienen una influencia significativa en la arquitectura de la Plataforma Integral Multivendedor para la Gestión Comercial y Operativa de un Mercado de Abastos.

| ID | Driver arquitectónico | Origen | ¿Por qué influye en la arquitectura? |
|---|---|---|---|
| DA01 | El sistema debe soportar múltiples clientes, comerciantes y repartidores realizando operaciones simultáneamente. | AC01, AC07 | Requiere una arquitectura capaz de manejar concurrencia, múltiples solicitudes y procesamiento simultáneo sin afectar significativamente el rendimiento. |
| DA02 | El sistema debe mantener la consistencia del inventario durante operaciones concurrentes. | RF12, RF14, RF15, AC08 | Influye en el diseño de transacciones, reservas de stock y mecanismos que eviten ventas superiores al inventario disponible. |
| DA03 | El sistema debe impedir que dos clientes reserven simultáneamente al mismo repartidor. | RF38, RF39, AC07 | Requiere mecanismos de bloqueo o control de concurrencia para la asignación de repartidores. |
| DA04 | La plataforma debe proteger información personal, credenciales y documentos sensibles. | AC04, AC12 | Influye en la autenticación, autorización, cifrado, gestión de permisos y protección de archivos. |
| DA05 | El sistema debe permitir incorporar nuevos comerciantes, puestos, productos y repartidores sin modificar completamente la solución. | AC02 | Favorece una arquitectura modular con componentes desacoplados y responsabilidades bien definidas. |
| DA06 | La comunicación entre frontend y backend debe realizarse mediante una API REST. | RC06 | Determina el mecanismo principal de comunicación entre la capa de presentación y la capa de lógica de negocio. |
| DA07 | La solución debe utilizar PostgreSQL como tecnología principal de persistencia. | RC07, RC08 | Determina la estrategia de almacenamiento de información estructurada y las relaciones entre usuarios, productos, pedidos, inventario y repartidores. |
| DA08 | La plataforma debe permitir pedidos con productos provenientes de diferentes puestos. | RF20, RF21, RF26, RF29 | Requiere modelar un pedido principal y mantener agrupados los productos correspondientes a cada puesto comercial. |
| DA09 | El sistema debe integrar la selección y reserva temporal de repartidores dentro del flujo de compra. | RF35, RF37, RF38, RF39, RF40 | Obliga a integrar los módulos de pedidos, repartidores, disponibilidad y estados de solicitud. |
| DA10 | La primera versión utilizará pagos mediante códigos QR de Yape o Plin. | RC13, RF44, RF45 | Influye en el flujo de pago, ya que el sistema debe registrar y validar el pago sin utilizar una pasarela bancaria automatizada. |
| DA11 | Un pedido no debe continuar al proceso de compra si el pago no ha sido validado. | RF46, AC08 | Requiere reglas de negocio que controlen estrictamente las transiciones de estado del pedido. |
| DA12 | La plataforma debe mantener trazabilidad de operaciones críticas. | RF53, AC06 | Requiere mecanismos de auditoría, registro de eventos y almacenamiento de información relacionada con cambios importantes. |
| DA13 | Los fallos de servicios secundarios no deben impedir las operaciones principales del sistema. | AC03, AC11 | Requiere mecanismos de aislamiento de fallos y desacoplamiento de servicios secundarios, como notificaciones o inteligencia artificial, para evitar que sus errores afecten los procesos críticos de compra y entrega. |
| DA14 | La arquitectura debe facilitar cambios, correcciones y evolución de los módulos sin afectar innecesariamente otras funcionalidades. | AC05, RC12 | Requiere separar responsabilidades, reducir el acoplamiento entre módulos y establecer dependencias internas que protejan las reglas del negocio frente a cambios tecnológicos. |
| DA15 | La solución debe ser accesible desde computadoras y dispositivos móviles mediante navegador. | AC09, AC10, RC01 | Influye en el diseño de la capa de presentación y justifica el uso de una aplicación web responsive/PWA. |
| DA16 | La arquitectura debe organizarse en tres capas. | RC11 | Determina la separación general entre presentación, lógica de negocio y persistencia. |


## Drivers prioritarios

Para la primera versión del sistema se consideran especialmente relevantes los siguientes drivers:

1. **DA02 - Consistencia del inventario**
2. **DA03 - Control concurrente de repartidores**
3. **DA04 - Seguridad de la información**
4. **DA14 - Mantenibilidad y evolución modular**
5. **DA05 - Escalabilidad y modularidad**
6. **DA08 - Pedidos multivendedor**
7. **DA09 - Integración del repartidor en el proceso de compra**
8. **DA10 - Flujo de pagos mediante Yape o Plin**
9. **DA11 - Control de estados del pedido**
10. **DA12 - Auditoría y trazabilidad**

Estos drivers influyen directamente en la separación de módulos, la gestión de persistencia, el control de concurrencia, la seguridad, la organización de los procesos de negocio y la comunicación entre las diferentes capas del sistema.

El driver DA14 es fundamental para seleccionar Clean Architecture como enfoque arquitectónico, mientras que DA02 y DA03 requieren mecanismos específicos para garantizar consistencia durante las operaciones concurrentes.


## Trazabilidad entre drivers y decisiones arquitectónicas

La siguiente matriz permite identificar cómo las decisiones arquitectónicas propuestas responden a los drivers definidos durante el análisis del sistema.

Los documentos ADR registran las decisiones de mayor impacto, mientras que los documentos de estilo y enfoque arquitectónico describen la organización global e interna de la solución.

| Driver | Decisión o documento relacionado | Respuesta arquitectónica |
|---|---|---|
| DA01 | ADR-003 | Transacciones y control de operaciones concurrentes. |
| DA02 | ADR-003 | Reservas de inventario mediante operaciones atómicas en PostgreSQL. |
| DA03 | ADR-003 | Control transaccional de reservas de repartidores. |
| DA04 | ADR-002, ADR-004 | Separación de responsabilidades y validación autorizada de pagos. Requiere profundizar la estrategia general de seguridad. |
| DA05 | ADR-001, ADR-002 | Monolito modular y separación de responsabilidades internas. |
| DA06 | Estilo arquitectónico, ADR-002 | Comunicación mediante API REST y controladores como adaptadores de entrada. |
| DA07 | Estilo arquitectónico, ADR-003 | PostgreSQL como tecnología de persistencia y coordinación transaccional. |
| DA08 | ADR-003, estilo arquitectónico | Coordinación del pedido principal, productos por puesto y reservas de inventario. |
| DA09 | ADR-003, ADR-004 | Reserva de repartidores y participación dentro del flujo de compra y pago. |
| DA10 | ADR-004 | Pago externo mediante Yape o Plin y validación operativa del repartidor. |
| DA11 | ADR-004, ADR-003 | Validación del pago y control de transiciones de estado del pedido. |
| DA12 | ADR-004 | Registro de validaciones de pago. Requiere ampliar la estrategia transversal de auditoría. |
| DA13 | ADR-002 | Desacoplamiento mediante interfaces. Requiere mecanismos adicionales de aislamiento de fallos. |
| DA14 | ADR-001, ADR-002 | Organización modular y aplicación de Clean Architecture. |
| DA15 | Estilo arquitectónico | Aplicación Web/PWA responsive mediante Next.js y TypeScript. |
| DA16 | Estilo arquitectónico, ADR-001 | Arquitectura cliente-servidor de tres capas y backend monolítico modular. |

## Aspectos arquitectónicos pendientes de profundización

La matriz identifica tres drivers que requieren decisiones técnicas adicionales:

### DA04 - Seguridad de la información

Se deberá definir una estrategia de seguridad que contemple autenticación, autorización por roles, protección de documentos sensibles y control de acceso a la información de cada puesto comercial.

### DA12 - Auditoría y trazabilidad

Se deberá establecer qué operaciones críticas serán auditadas, qué información se registrará y qué roles estarán autorizados para consultar los registros.

### DA13 - Aislamiento de fallos

Se deberán definir mecanismos de aislamiento para evitar que los errores de servicios secundarios, como notificaciones e inteligencia artificial, interrumpan las operaciones críticas de compra y entrega.

Estos aspectos se desarrollarán mediante decisiones arquitectónicas complementarias, manteniendo la coherencia con el monolito modular y Clean Architecture seleccionados.
