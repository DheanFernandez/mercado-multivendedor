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
| RF32 | El sistema debe permitir registrar usuarios con rol de repartidor. |
| RF33 | El sistema debe permitir registrar la información personal, vehículo y medios de pago del repartidor. |
| RF34 | El sistema debe permitir verificar, aprobar, rechazar, suspender o desactivar repartidores. |
| RF35 | El sistema debe mostrar únicamente repartidores verificados, habilitados y disponibles. |
| RF36 | El sistema debe permitir al cliente consultar la información básica del repartidor. |
| RF37 | El sistema debe permitir al cliente seleccionar un repartidor disponible. |
| RF38 | El sistema debe reservar temporalmente al repartidor seleccionado. |
| RF39 | El sistema debe impedir que dos clientes reserven simultáneamente al mismo repartidor. |
| RF40 | El sistema debe permitir al repartidor aceptar o rechazar una solicitud de pedido. |
| RF41 | El sistema debe establecer un tiempo máximo para responder una solicitud de pedido. |
| RF42 | El sistema debe permitir configurar y mostrar el costo del servicio de reparto. |
| RF43 | El sistema debe sumar el costo de reparto al importe estimado de los productos. |
| RF44 | El sistema debe permitir al cliente realizar el pago mediante código QR de Yape o Plin. |
| RF45 | El sistema debe permitir al repartidor validar el pago recibido. |
| RF46 | El sistema debe impedir que un pedido continúe al proceso de compra si el pago no ha sido validado. |
| RF47 | El sistema debe permitir al repartidor registrar la compra realizada en los diferentes puestos. |
| RF48 | El sistema debe permitir registrar variaciones de peso o precio cuando corresponda. |
| RF49 | El sistema debe permitir actualizar el estado del pedido durante el proceso de compra y entrega. |
| RF50 | El sistema debe permitir confirmar la entrega mediante un PIN proporcionado por el cliente. |
| RF51 | El sistema debe permitir gestionar cancelaciones, devoluciones e incidencias. |
| RF52 | El sistema debe enviar notificaciones relacionadas con los principales cambios de estado del pedido. |
| RF53 | El sistema debe registrar operaciones críticas para fines de auditoría. |
| RF54 | El sistema debe permitir al administrador consultar pedidos activos, pagos registrados e incidencias. |
| RF55 | El sistema debe proporcionar reportes, indicadores y paneles de control. |
| RF56 | El sistema debe permitir configurar reglas operativas como tiempos de reserva y tolerancias de peso o precio. |
| RF57 | El sistema debe proporcionar una funcionalidad de inteligencia artificial para apoyar la búsqueda de productos. |

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
| HU08 Consultar repartidores | RF35, RF36 |
| HU09 Seleccionar repartidor | RF37, RF38, RF39 |
| HU10 Consultar costo de reparto | RF42, RF43 |
| HU11 Realizar pago | RF44, RF45, RF46 |
| HU12 Consultar estado del pedido | RF30, RF31, RF49 |
| HU13 Confirmar entrega | RF50 |
| HU14 Gestionar tienda | RF08 |
| HU15 Gestionar productos | RF09, RF10 |
| HU16 Gestionar precios y presentaciones | RF11 |
| HU17 Gestionar inventario | RF12, RF14, RF15 |
| HU18 Consultar movimientos de inventario | RF13 |
| HU19 Consultar operaciones del puesto | RF54, RF55 |
| HU20 Acceder según permisos | RF03, RF04, RF05 |
| HU21 Registrar datos del repartidor | RF32, RF33 |
| HU22 Indicar disponibilidad | RF35 |
| HU23 Aceptar o rechazar pedidos | RF40, RF41 |
| HU24 Validar pago | RF45, RF46 |
| HU25 Registrar compras | RF47, RF49 |
| HU26 Registrar variaciones de peso o precio | RF48 |
| HU27 Marcar pedido en camino | RF49 |
| HU28 Confirmar entrega | RF50 |
| HU29 Gestionar usuarios | RF01, RF02, RF03, RF04, RF05 |
| HU30 Gestionar comerciantes y puestos | RF06, RF07 |
| HU31 Verificar repartidores | RF34 |
| HU32 Suspender repartidores | RF34 |
| HU33 Supervisar pedidos e incidencias | RF51, RF54 |
| HU34 Configurar reglas operativas | RF56 |
| HU35 Consultar reportes | RF55 |
| HU36 Consultar auditoría | RF53 |