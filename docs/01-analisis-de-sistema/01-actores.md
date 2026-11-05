# Actores del Sistema

## 1. Descripción general

La Plataforma Integral Multivendedor para la Gestión Comercial y Operativa de un Mercado de Abastos permitirá la interacción de diferentes actores, cada uno con responsabilidades y permisos específicos.

Los actores identificados corresponden a los usuarios que participan en los procesos comerciales, administrativos y operativos del mercado.

## 2. Actores principales

| Actor | Descripción | Responsabilidades principales |
|---|---|---|
| Cliente | Usuario que adquiere productos de diferentes puestos comerciales mediante el marketplace. | Consultar productos, gestionar el carrito, generar pedidos, realizar un pago único por pedido mediante Mercado Pago y retirar sus pedidos en los puestos correspondientes. |
| Comerciante | Responsable de uno o más puestos comerciales del mercado. | Administrar tiendas, productos, precios e inventarios; vincular su cuenta de Mercado Pago; preparar los pedidos de sus puestos con pago aprobado, registrar su entrega al cliente, solicitar reembolsos y consultar las operaciones, cobros y comisiones de sus puestos. |
| Trabajador de puesto | Usuario autorizado por el comerciante para realizar actividades operativas según los permisos asignados. | Consultar productos, apoyar en la gestión de inventario y atender las operaciones autorizadas del puesto, limitadas a la preparación de pedidos y su entrega al cliente. No tiene permiso para validar pagos. |
| Administrador | Responsable de gestionar y supervisar el funcionamiento general de la plataforma. | Administrar usuarios, comerciantes, puestos, configuraciones, auditoría y reportes; gestionar la conciliación de pagos con Mercado Pago y las incidencias. |

## 3. Sistemas y servicios externos

Los sistemas externos representan servicios o medios que participan en el funcionamiento de la plataforma sin formar parte directamente de su lógica de negocio.

| Sistema o servicio | Descripción | Tipo de interacción |
|---|---|---|
| Mercado Pago | Pasarela de pago utilizada para cobrar al cliente el pedido completo en una única transacción, notificar el resultado del pago y ejecutar reembolsos. En la primera versión se utiliza el entorno Sandbox. | Integración mediante API (Checkout, consulta de pagos y reembolsos) y recepción de notificaciones mediante Webhooks. |
| Supabase Storage / Cloudflare R2 | Alternativas tecnológicas para almacenar imágenes de productos y documentos de la plataforma. | Servicio externo de almacenamiento mediante API. |

### Consideraciones sobre los pagos

En la primera versión del sistema, el cliente realizará un pago único por todo su pedido mediante Mercado Pago Checkout, cuyo importe corresponde a la suma de los subtotales de cada puesto incluido.

La confirmación del pago será recibida automáticamente por la plataforma mediante un Webhook verificado y una consulta a la API de Mercado Pago. Ningún usuario de la plataforma valida pagos de forma manual.

Cada comerciante deberá vincular su cuenta de Mercado Pago a la plataforma y asumirá la comisión de la pasarela correspondiente a sus ventas.

Los productos de un puesto únicamente podrán pasar a preparación cuando el pago del pedido haya sido aprobado por la pasarela.

## 4. Relaciones entre actores

El proceso principal del marketplace contempla las siguientes interacciones:

1. El cliente consulta productos de diferentes puestos y genera un pedido.
2. El sistema agrupa el pedido por puesto, reserva el inventario y calcula el total como la suma de los subtotales por puesto.
3. El cliente realiza el pago único del pedido mediante Mercado Pago Checkout.
4. Mercado Pago notifica el resultado del pago y la plataforma lo verifica automáticamente.
5. El comerciante o el trabajador autorizado prepara los productos de su puesto con pago aprobado y los marca como listos para retiro.
6. El cliente retira los productos en cada puesto.
7. El comerciante o el trabajador autorizado registra la entrega de los productos al cliente.
8. El comerciante solicita los reembolsos que correspondan y la plataforma los ejecuta mediante la API de Mercado Pago.
9. El administrador supervisa las operaciones, gestiona la conciliación de pagos y las incidencias.

La plataforma no incluye servicio de reparto a domicilio.

## 5. Control de acceso

Cada actor deberá acceder únicamente a las funcionalidades y a la información permitidas por su rol.

La plataforma utilizará mecanismos de autenticación y autorización para proteger los datos y las operaciones de los diferentes usuarios.

Los comerciantes y trabajadores de puesto no podrán gestionar información de otros puestos sin autorización.

Solo el comerciante del puesto, o el trabajador de puesto con permiso asignado, podrá registrar la preparación y la entrega de los productos correspondientes a ese puesto.

Solo el comerciante titular podrá vincular o desvincular la cuenta de Mercado Pago de sus puestos y solicitar reembolsos.
