# Actores del Sistema

## 1. Descripción general

La Plataforma Integral Multivendedor para la Gestión Comercial y Operativa de un Mercado de Abastos permitirá la interacción de diferentes actores, cada uno con responsabilidades y permisos específicos.

Los actores identificados corresponden a los usuarios que participan en los procesos comerciales, administrativos y operativos del mercado.

## 2. Actores principales

| Actor | Descripción | Responsabilidades principales |
|---|---|---|
| Cliente | Usuario que adquiere productos de diferentes puestos comerciales mediante el marketplace. | Consultar productos, gestionar el carrito, generar pedidos, realizar los pagos de cada puesto mediante QR y retirar sus pedidos en los puestos correspondientes. |
| Comerciante | Responsable de uno o más puestos comerciales del mercado. | Administrar tiendas, productos, precios, promociones, inventarios y códigos QR de cobro; validar los pagos recibidos, preparar los pedidos de sus puestos, registrar su entrega al cliente y consultar operaciones de sus puestos. |
| Trabajador de puesto | Usuario autorizado por el comerciante para realizar actividades operativas según los permisos asignados. | Consultar productos, apoyar en la gestión de inventario y atender operaciones autorizadas del puesto, como la validación de pagos, la preparación de pedidos y su entrega al cliente. |
| Administrador | Responsable de gestionar y supervisar el funcionamiento general de la plataforma. | Administrar usuarios, comerciantes, puestos, incidencias, configuraciones, auditoría y reportes. |

## 3. Sistemas y servicios externos

Los sistemas externos representan servicios o medios que participan en el funcionamiento de la plataforma sin formar parte directamente de su lógica de negocio.

| Sistema o servicio | Descripción | Tipo de interacción |
|---|---|---|
| Yape | Medio de pago utilizado por los clientes para transferir dinero al comerciante de cada puesto mediante código QR. | Pago externo realizado por el cliente. |
| Plin | Medio de pago utilizado por los clientes para transferir dinero al comerciante de cada puesto mediante código QR. | Pago externo realizado por el cliente. |
| Supabase Storage / Cloudflare R2 | Alternativas tecnológicas para almacenar imágenes, códigos QR de cobro y evidencias digitales. | Servicio externo de almacenamiento mediante API. |

### Consideraciones sobre los pagos

En la primera versión del sistema, Yape y Plin no funcionarán como pasarelas de pago integradas mediante API.

El cliente realizará el pago de los productos de cada puesto utilizando la aplicación correspondiente y el código QR configurado por el comerciante de ese puesto.

Posteriormente, el comerciante o el trabajador de puesto autorizado verificará el dinero recibido y registrará la validación del pago dentro de la plataforma.

Los productos de un puesto únicamente podrán pasar a preparación cuando el pago correspondiente a ese puesto haya sido validado.

## 4. Relaciones entre actores

El proceso principal del marketplace contempla las siguientes interacciones:

1. El cliente consulta productos de diferentes puestos y genera un pedido.
2. El sistema agrupa el pedido por puesto y presenta el importe y el código QR de cada puesto.
3. El cliente realiza el pago de cada puesto mediante Yape o Plin.
4. El comerciante o el trabajador autorizado verifica y valida el pago recibido.
5. El comerciante o el trabajador autorizado prepara los productos de su puesto y los marca como listos para retiro.
6. El cliente retira los productos en cada puesto.
7. El comerciante o el trabajador autorizado registra la entrega de los productos al cliente.
8. El administrador supervisa las operaciones y gestiona las incidencias.

La plataforma no incluye servicio de reparto a domicilio.

## 5. Control de acceso

Cada actor deberá acceder únicamente a las funcionalidades y a la información permitidas por su rol.

La plataforma utilizará mecanismos de autenticación y autorización para proteger los datos y las operaciones de los diferentes usuarios.

Los comerciantes y trabajadores de puesto no podrán gestionar información de otros puestos sin autorización.

Solo el comerciante del puesto, o el trabajador de puesto con permiso asignado, podrá validar los pagos y registrar la preparación y la entrega de los productos correspondientes a ese puesto.
