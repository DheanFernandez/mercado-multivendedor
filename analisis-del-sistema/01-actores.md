# Actores del Sistema

## 1. Descripción general

La Plataforma Integral Multivendedor para la Gestión Comercial y Operativa de un Mercado de Abastos permitirá la interacción de diferentes actores, cada uno con responsabilidades y permisos específicos.

Los actores identificados corresponden a los usuarios que participan en los procesos comerciales, administrativos y operativos del mercado.

## 2. Actores principales

| Actor | Descripción | Responsabilidades principales |
|---|---|---|
| Cliente | Usuario que adquiere productos de diferentes puestos comerciales mediante el marketplace. | Consultar productos, gestionar el carrito, generar pedidos, seleccionar repartidores, realizar pagos mediante QR y recibir pedidos. |
| Comerciante | Responsable de uno o más puestos comerciales del mercado. | Administrar tiendas, productos, precios, promociones, inventarios y consultar operaciones de sus puestos. |
| Trabajador de puesto | Usuario autorizado por el comerciante para realizar actividades operativas según los permisos asignados. | Consultar productos, apoyar en la gestión de inventario y atender operaciones autorizadas del puesto. |
| Repartidor | Usuario verificado y habilitado que realiza las compras y entregas solicitadas por los clientes. | Gestionar disponibilidad, aceptar solicitudes, validar pagos recibidos, comprar productos, consolidar pedidos y realizar entregas. |
| Administrador | Responsable de gestionar y supervisar el funcionamiento general de la plataforma. | Administrar usuarios, comerciantes, puestos, repartidores, incidencias, configuraciones, auditoría y reportes. |

## 3. Sistemas y servicios externos

Los sistemas externos representan servicios o medios que participan en el funcionamiento de la plataforma sin formar parte directamente de su lógica de negocio.

| Sistema o servicio | Descripción | Tipo de interacción |
|---|---|---|
| Yape | Medio de pago utilizado por los clientes para transferir dinero al repartidor mediante código QR. | Pago externo realizado por el cliente. |
| Plin | Medio de pago utilizado por los clientes para transferir dinero al repartidor mediante código QR. | Pago externo realizado por el cliente. |
| Supabase Storage / Cloudflare R2 | Alternativas tecnológicas para almacenar imágenes, documentos de verificación y evidencias digitales. | Servicio externo de almacenamiento mediante API. |

### Consideraciones sobre los pagos

En la primera versión del sistema, Yape y Plin no funcionarán como pasarelas de pago integradas mediante API.

El cliente realizará el pago utilizando la aplicación correspondiente y el código QR proporcionado por el repartidor.

Posteriormente, el repartidor verificará el dinero recibido y registrará la validación del pago dentro de la plataforma.

El pedido únicamente podrá continuar hacia el proceso de compra cuando el pago haya sido validado.

## 4. Relaciones entre actores

El proceso principal del marketplace contempla las siguientes interacciones:

1. El cliente consulta productos de diferentes puestos y genera un pedido.
2. El cliente selecciona un repartidor disponible.
3. El repartidor acepta la solicitud.
4. El cliente realiza el pago mediante Yape o Plin.
5. El repartidor verifica y valida el pago recibido.
6. El repartidor compra los productos en los puestos correspondientes.
7. Los comerciantes o trabajadores autorizados atienden las compras.
8. El repartidor consolida los productos y realiza la entrega.
9. El cliente recibe el pedido y proporciona el PIN de confirmación.
10. El administrador supervisa las operaciones y gestiona las incidencias.

## 5. Control de acceso

Cada actor deberá acceder únicamente a las funcionalidades y a la información permitidas por su rol.

La plataforma utilizará mecanismos de autenticación y autorización para proteger los datos y las operaciones de los diferentes usuarios.

Los comerciantes y trabajadores de puesto no podrán gestionar información de otros puestos sin autorización.

Los repartidores solamente podrán aceptar pedidos cuando se encuentren verificados, habilitados y disponibles.
