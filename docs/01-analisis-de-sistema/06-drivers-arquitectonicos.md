# Drivers Arquitectónicos

Los drivers arquitectónicos representan los requisitos funcionales, atributos de calidad y restricciones que tienen una influencia significativa en la arquitectura de la Plataforma Integral Multivendedor para la Gestión Comercial y Operativa de un Mercado de Abastos.

| ID | Driver arquitectónico | Origen | ¿Por qué influye en la arquitectura? |
|---|---|---|---|
| DA01 | El sistema debe soportar múltiples clientes, comerciantes y trabajadores de puesto realizando operaciones simultáneamente. | AC01, AC07 | Requiere una arquitectura capaz de manejar concurrencia, múltiples solicitudes y procesamiento simultáneo sin afectar significativamente el rendimiento. |
| DA02 | El sistema debe mantener la consistencia del inventario durante operaciones concurrentes. | RF12, RF14, RF15, AC08 | Influye en el diseño de transacciones, reservas de stock y mecanismos que eviten ventas superiores al inventario disponible. |
| DA03 | La plataforma debe proteger información personal, credenciales y documentos sensibles. | AC04, AC12 | Influye en la autenticación, autorización, cifrado, gestión de permisos y protección de archivos. |
| DA04 | El sistema debe permitir incorporar nuevos comerciantes, puestos y productos sin modificar completamente la solución. | AC02 | Favorece una arquitectura modular con componentes desacoplados y responsabilidades bien definidas. |
| DA05 | La comunicación entre frontend y backend debe realizarse mediante una API REST. | RC06 | Determina el mecanismo principal de comunicación entre la capa de presentación y la capa de lógica de negocio. |
| DA06 | La solución debe utilizar PostgreSQL como tecnología principal de persistencia. | RC07, RC08 | Determina la estrategia de almacenamiento de información estructurada y las relaciones entre usuarios, puestos, productos, pedidos, pagos e inventario. |
| DA07 | La plataforma debe permitir pedidos con productos provenientes de diferentes puestos. | RF20, RF21, RF26, RF29 | Requiere modelar un pedido principal y mantener agrupados los productos correspondientes a cada puesto comercial. |
| DA08 | La primera versión utilizará pagos mediante códigos QR de Yape o Plin realizados a cada puesto. | RC13, RF32, RF33, RF34 | Influye en el flujo de pago, ya que el sistema debe registrar y validar el pago de cada puesto sin utilizar una pasarela bancaria automatizada. |
| DA09 | Los productos de un puesto no deben pasar a preparación si el pago correspondiente no ha sido validado. | RF35, AC08 | Requiere reglas de negocio que controlen estrictamente las transiciones de estado del pedido y de cada una de sus agrupaciones por puesto. |
| DA10 | La plataforma debe mantener trazabilidad de operaciones críticas. | RF42, AC06 | Requiere mecanismos de auditoría, registro de eventos y almacenamiento de información relacionada con cambios importantes. |
| DA11 | Los fallos de servicios secundarios no deben impedir las operaciones principales del sistema. | AC03, AC11 | Requiere mecanismos de aislamiento de fallos y desacoplamiento de servicios secundarios, como las notificaciones, para evitar que sus errores afecten los procesos críticos de compra, pago y preparación de pedidos. |
| DA12 | La arquitectura debe facilitar cambios, correcciones y evolución de los módulos sin afectar innecesariamente otras funcionalidades. | AC05, RC12 | Requiere separar responsabilidades, reducir el acoplamiento entre módulos y establecer dependencias internas que protejan las reglas del negocio frente a cambios tecnológicos. |
| DA13 | La solución debe ser accesible desde computadoras y dispositivos móviles mediante navegador. | AC09, AC10, RC01 | Influye en el diseño de la capa de presentación y justifica el uso de una aplicación web responsive/PWA. |
| DA14 | La arquitectura debe organizarse en tres capas. | RC11 | Determina la separación general entre presentación, lógica de negocio y persistencia. |


## Drivers prioritarios

Para la primera versión del sistema se consideran especialmente relevantes los siguientes drivers:

1. **DA02 - Consistencia del inventario**
2. **DA03 - Seguridad de la información**
3. **DA12 - Mantenibilidad y evolución modular**
4. **DA04 - Escalabilidad y modularidad**
5. **DA07 - Pedidos multivendedor**
6. **DA08 - Flujo de pagos mediante Yape o Plin**
7. **DA09 - Control de estados del pedido**
8. **DA10 - Auditoría y trazabilidad**

Estos drivers influyen directamente en la separación de módulos, la gestión de persistencia, el control de concurrencia, la seguridad, la organización de los procesos de negocio y la comunicación entre las diferentes capas del sistema.

El driver DA12 es fundamental para seleccionar Clean Architecture como enfoque arquitectónico, mientras que DA02 requiere mecanismos específicos para garantizar consistencia durante las operaciones concurrentes.


## Trazabilidad entre drivers y decisiones arquitectónicas

La siguiente matriz permite identificar cómo las decisiones arquitectónicas propuestas responden a los drivers definidos durante el análisis del sistema.

Los documentos ADR registran las decisiones de mayor impacto, mientras que los documentos de estilo y enfoque arquitectónico describen la organización global e interna de la solución.

| Driver | Decisión o documento relacionado | Respuesta arquitectónica |
|---|---|---|
| DA01 | ADR-003 | Transacciones y control de operaciones concurrentes. |
| DA02 | ADR-003 | Reservas de inventario mediante operaciones atómicas en PostgreSQL. |
| DA03 | ADR-002, ADR-004 | Separación de responsabilidades y validación autorizada de pagos. Requiere profundizar la estrategia general de seguridad. |
| DA04 | ADR-001, ADR-002 | Monolito modular y separación de responsabilidades internas. |
| DA05 | Estilo arquitectónico, ADR-002 | Comunicación mediante API REST y controladores como adaptadores de entrada. |
| DA06 | Estilo arquitectónico, ADR-003 | PostgreSQL como tecnología de persistencia y coordinación transaccional. |
| DA07 | ADR-003, ADR-004, estilo arquitectónico | Coordinación del pedido principal, productos por puesto, reservas de inventario y pagos por puesto. |
| DA08 | ADR-004 | Pago externo mediante Yape o Plin y validación operativa del comerciante de cada puesto. |
| DA09 | ADR-004, ADR-003 | Validación del pago y control de transiciones de estado del pedido. |
| DA10 | ADR-004 | Registro de validaciones de pago. Requiere ampliar la estrategia transversal de auditoría. |
| DA11 | ADR-002 | Desacoplamiento mediante interfaces. Requiere mecanismos adicionales de aislamiento de fallos. |
| DA12 | ADR-001, ADR-002 | Organización modular y aplicación de Clean Architecture. |
| DA13 | Estilo arquitectónico | Aplicación Web/PWA responsive mediante Next.js y TypeScript. |
| DA14 | Estilo arquitectónico, ADR-001 | Arquitectura cliente-servidor de tres capas y backend monolítico modular. |

## Aspectos arquitectónicos pendientes de profundización

La matriz identifica tres drivers que requieren decisiones técnicas adicionales:

### DA03 - Seguridad de la información

Se deberá definir una estrategia de seguridad que contemple autenticación, autorización por roles, protección de documentos sensibles y control de acceso a la información de cada puesto comercial.

### DA10 - Auditoría y trazabilidad

Se deberá establecer qué operaciones críticas serán auditadas, qué información se registrará y qué roles estarán autorizados para consultar los registros.

### DA11 - Aislamiento de fallos

Se deberán definir mecanismos de aislamiento para evitar que los errores de servicios secundarios, como las notificaciones, interrumpan las operaciones críticas de compra, pago y preparación de pedidos.

Estos aspectos se desarrollarán mediante decisiones arquitectónicas complementarias, manteniendo la coherencia con el monolito modular y Clean Architecture seleccionados.
