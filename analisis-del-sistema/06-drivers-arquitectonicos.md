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
| DA13 | Los fallos de servicios secundarios no deben impedir las operaciones principales del sistema. | AC03 | Favorece el desacoplamiento de servicios como notificaciones o inteligencia artificial respecto al flujo crítico de compra. |
| DA14 | La arquitectura debe facilitar cambios y evolución de módulos independientes. | AC05, RC12 | Requiere separación clara de responsabilidades y una estructura modular. |
| DA15 | La solución debe ser accesible desde computadoras y dispositivos móviles mediante navegador. | AC09, AC10, RC01 | Influye en el diseño de la capa de presentación y justifica el uso de una aplicación web responsive/PWA. |
| DA16 | La arquitectura debe organizarse en tres capas. | RC11 | Determina la separación general entre presentación, lógica de negocio y persistencia. |

## Drivers prioritarios

Para la primera versión del sistema se consideran especialmente relevantes los siguientes drivers:

1. **DA02 - Consistencia del inventario**
2. **DA03 - Control concurrente de repartidores**
3. **DA04 - Seguridad de la información**
4. **DA05 - Escalabilidad y modularidad**
5. **DA08 - Pedidos multivendedor**
6. **DA09 - Integración del repartidor en el proceso de compra**
7. **DA10 - Flujo de pagos mediante Yape o Plin**
8. **DA11 - Control de estados del pedido**
9. **DA12 - Auditoría y trazabilidad**
10. **DA16 - Arquitectura de tres capas**

Estos drivers influyen directamente en la separación de módulos, la gestión de persistencia, el control de concurrencia, la seguridad, la organización de los procesos de negocio y la comunicación entre las diferentes capas del sistema.