# Requisitos Funcionales

Los requisitos funcionales describen las funciones principales que debe realizar la Plataforma Integral Multivendedor para la Gestión Comercial y Operativa de un Mercado de Abastos.

## Requisitos funcionales

| ID | Requisito funcional |
|---|---|
| RF01 | El sistema debe permitir registrar usuarios en la plataforma. |
| RF02 | El sistema debe permitir autenticar usuarios mediante credenciales personales. |
| RF03 | El sistema debe identificar el rol del usuario autenticado. |
| RF04 | El sistema debe mostrar únicamente las funcionalidades correspondientes al rol del usuario. |
| RF05 | El sistema debe permitir gestionar roles y permisos. |
| RF06 | El sistema debe permitir registrar y administrar comerciantes. |
| RF07 | El sistema debe permitir registrar y administrar puestos comerciales. |
| RF08 | El sistema debe permitir crear y gestionar tiendas virtuales asociadas a puestos comerciales. |
| RF09 | El sistema debe permitir registrar, actualizar y desactivar productos. |
| RF10 | El sistema debe permitir asociar productos a categorías y puestos comerciales. |
| RF11 | El sistema debe permitir gestionar precios, presentaciones e imágenes de productos. |
| RF12 | El sistema debe permitir registrar y actualizar el inventario de productos. |
| RF13 | El sistema debe registrar movimientos de inventario por ingresos, ventas, devoluciones y ajustes. |
| RF14 | El sistema debe diferenciar entre stock físico, reservado y disponible cuando corresponda. |
| RF15 | El sistema debe impedir confirmar cantidades superiores al stock disponible. |
| RF16 | El sistema debe proporcionar un catálogo general con productos de diferentes puestos. |
| RF17 | El sistema debe permitir buscar productos mediante texto. |
| RF18 | El sistema debe permitir filtrar productos por categoría, precio o puesto. |
| RF19 | El sistema debe permitir consultar el detalle y disponibilidad de un producto. |
| RF20 | El sistema debe permitir agregar al mismo carrito productos pertenecientes a diferentes puestos. |
| RF21 | El sistema debe identificar automáticamente a qué puesto pertenece cada producto del carrito. |
| RF22 | El sistema debe calcular el subtotal correspondiente a cada puesto. |
| RF23 | El sistema debe calcular el total general del carrito. |
| RF24 | El sistema debe permitir modificar o eliminar productos del carrito antes de confirmar el pedido. |
| RF25 | El sistema debe verificar nuevamente la disponibilidad del stock antes de confirmar un pedido. |
| RF26 | El sistema debe permitir registrar un pedido con productos pertenecientes a uno o varios puestos. |
| RF27 | El sistema debe generar un código único para cada pedido. |
| RF28 | El sistema debe asociar cada pedido con el cliente que lo realizó. |
| RF29 | El sistema debe mantener agrupados los productos correspondientes a cada puesto dentro del pedido. |
| RF30 | El sistema debe permitir consultar el estado general de un pedido. |
| RF31 | El sistema debe mantener un historial de cambios de estado del pedido. |
| RF32 | El sistema debe mostrar al cliente, por cada puesto incluido en el pedido, el importe correspondiente y el código QR de Yape o Plin configurado por el comerciante, para que realice el pago desde la aplicación externa correspondiente, sin procesamiento bancario automático por parte de la plataforma. |
| RF33 | El sistema debe permitir al comerciante registrar y actualizar los códigos QR de Yape o Plin de sus puestos. |
| RF34 | El sistema debe permitir al comerciante o al trabajador de puesto autorizado validar el pago recibido correspondiente a su puesto. |
| RF35 | El sistema debe impedir que los productos de un puesto pasen a preparación si el pago correspondiente a ese puesto no ha sido validado. |
| RF36 | El sistema debe permitir al comerciante o al trabajador de puesto autorizado registrar la preparación de los productos de su puesto incluidos en el pedido. |
| RF37 | El sistema debe permitir registrar variaciones de peso o precio cuando corresponda. |
| RF38 | El sistema debe permitir actualizar el estado del pedido durante el proceso de pago, preparación y retiro. |
| RF39 | El sistema debe permitir al comerciante o al trabajador de puesto autorizado marcar los productos de su puesto como listos para retiro y registrar su entrega al cliente en el puesto. |
| RF40 | El sistema debe permitir gestionar cancelaciones, devoluciones e incidencias. |
| RF41 | El sistema debe enviar notificaciones relacionadas con los principales cambios de estado del pedido. |
| RF42 | El sistema debe registrar operaciones críticas para fines de auditoría. |
| RF43 | El sistema debe permitir al administrador consultar pedidos activos, pagos registrados e incidencias. |
| RF44 | El sistema debe proporcionar reportes, indicadores y paneles de control. |
| RF45 | El sistema debe permitir configurar reglas operativas como tiempos de reserva y tolerancias de peso o precio. |
| RF46 | El sistema debe permitir al comerciante consultar los pedidos, ventas y operaciones correspondientes únicamente a los puestos comerciales que tiene asignados. |


## Relación entre historias de usuario y requisitos funcionales

| Historia de usuario | Requisitos relacionados |
|---|---|
| HU01 Consultar productos | RF16, RF19 |
| HU02 Buscar y filtrar productos | RF17, RF18 |
| HU03 Consultar detalle de producto | RF19 |
| HU04 Gestionar carrito multivendedor | RF20, RF21 |
| HU05 Modificar carrito | RF24 |
| HU06 Consultar subtotales y total | RF22, RF23 |
| HU07 Generar pedido | RF25, RF26, RF27, RF28, RF29 |
| HU08 Realizar pago por puesto | RF32, RF34, RF35 |
| HU09 Consultar estado del pedido | RF30, RF31, RF38 |
| HU10 Retirar pedido en el puesto | RF39 |
| HU11 Gestionar tienda | RF08, RF33 |
| HU12 Gestionar productos | RF09, RF10 |
| HU13 Gestionar precios y presentaciones | RF11 |
| HU14 Gestionar inventario | RF12, RF14, RF15 |
| HU15 Consultar movimientos de inventario | RF13 |
| HU16 Consultar operaciones del puesto | RF46, RF44 |
| HU17 Validar pago | RF34, RF35 |
| HU18 Registrar variaciones de peso o precio | RF37 |
| HU19 Preparar y entregar pedido en el puesto | RF36, RF38, RF39 |
| HU20 Acceder según permisos | RF03, RF04, RF05 |
| HU21 Gestionar usuarios | RF01, RF02, RF03, RF04, RF05 |
| HU22 Gestionar comerciantes y puestos | RF06, RF07 |
| HU23 Supervisar pedidos e incidencias | RF40, RF43 |
| HU24 Configurar reglas operativas | RF45 |
| HU25 Consultar reportes | RF44 |
| HU26 Consultar auditoría | RF42 |
