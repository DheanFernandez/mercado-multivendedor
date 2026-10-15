
# ADR-004: Gestión de Pagos Mediante Códigos QR

## 1. Información de la decisión

| Campo | Descripción |
|---|---|
| ID | ADR-004 |
| Título | Gestión de pagos mediante códigos QR de Yape o Plin |
| Estado | Propuesta |
| Fecha | 08/10/2026 |
| Proyecto | Plataforma Integral Multivendedor para la Gestión Comercial y Operativa de un Mercado de Abastos |
| Driver principal | DA08 - Pagos mediante Yape o Plin |
| Drivers relacionados | DA03, DA07, DA09, DA10 |
| Requisitos relacionados | RF32, RF33, RF34, RF35 |
| Restricciones relacionadas | RC13, RC14, RC17 |
| Atributos de calidad | AC04 - Seguridad, AC08 - Integridad de la información, AC12 - Privacidad |

## 2. Contexto

La plataforma permitirá que los clientes realicen pedidos con productos provenientes de diferentes puestos comerciales.

Cada pedido mantendrá agrupados los productos correspondientes a cada puesto, y cada comerciante será responsable de preparar los productos de su puesto para que el cliente los retire en él. La plataforma no incluye servicio de delivery.

El importe de cada agrupación estará compuesto por el costo estimado de los productos del puesto correspondiente.

En la primera versión, el pago se realizará directamente del cliente al comerciante de cada puesto mediante Yape o Plin.

La plataforma no utilizará una pasarela bancaria integrada ni ejecutará transferencias de dinero mediante API.

Por tanto, será necesario organizar un procedimiento de validación que permita registrar el pago recibido por cada puesto y controlar la continuidad del pedido.

## 3. Problema arquitectónico

¿Cómo integrar los pagos realizados mediante aplicaciones externas de Yape o Plin dentro del proceso de compra multivendedor, garantizando el control de estados y la trazabilidad sin utilizar una pasarela bancaria automatizada?

## 4. Alternativas evaluadas

| Alternativa | Ventajas | Limitaciones |
|---|---|---|
| Pasarela de pago integrada mediante API | Permite automatizar la confirmación de pagos cuando el proveedor ofrece mecanismos adecuados. | Requiere integración bancaria, costos y condiciones adicionales fuera del alcance inicial. |
| Transferencias externas sin registro en la plataforma | Implementación sencilla. | No proporciona trazabilidad ni permite controlar correctamente el proceso del pedido. |
| Cobro centralizado mediante un QR de la administración del mercado | El cliente realiza un único pago por pedido. | Requiere que el mercado recaude y posteriormente liquide los importes a cada comerciante, proceso no contemplado en el alcance. |
| Pago externo mediante QR de cada puesto con validación del comerciante | Se adapta al modelo multivendedor, en el que cada comerciante vende y prepara sus propios productos, y permite registrar el estado del pago sin integración bancaria. | El cliente debe realizar un pago por cada puesto y la confirmación depende de la verificación humana, sin constituir una validación bancaria automática. |

## 5. Decisión arquitectónica

Se propone utilizar pagos externos mediante códigos QR de Yape o Plin, asociados a cada puesto comercial incluido en el pedido.

La plataforma mostrará, para cada puesto, el importe correspondiente y el código QR configurado por su comerciante.

El cliente realizará el pago de cada puesto desde la aplicación externa.

Posteriormente, el comerciante o el trabajador de puesto autorizado verificará que el dinero haya sido recibido correctamente y registrará la validación dentro de la plataforma.

El sistema no considerará validado un pago únicamente porque el cliente haya indicado que realizó la transferencia o haya adjuntado una captura.

La confirmación registrada en el puesto permitirá que los productos de ese puesto pasen a preparación.

## 6. Flujo general de pago

1. El cliente selecciona los productos del marketplace.
2. El sistema calcula el importe estimado por puesto y el total general.
3. El cliente confirma el pedido y el sistema registra el pedido agrupado por puesto, junto con las reservas de inventario.
4. El sistema presenta, para cada puesto, el importe a pagar y el código QR configurado por el comerciante.
5. El cliente realiza el pago de cada puesto mediante Yape o Plin.
6. La parte del pedido correspondiente a cada puesto permanece en estado de espera de validación de pago.
7. El comerciante o el trabajador autorizado comprueba la recepción del dinero mediante su aplicación de pago.
8. El comerciante o el trabajador autorizado registra la confirmación del pago dentro de la plataforma.
9. El sistema verifica que la transición de estado sea válida.
10. La parte del pedido pasa al estado de pago validado y queda habilitada para su preparación y posterior retiro por el cliente en el puesto.

Si el pago de un puesto no puede verificarse, los productos de ese puesto no deberán continuar automáticamente hacia la preparación.

## 7. Estados del pago

Se propone utilizar los siguientes estados lógicos para el pago de cada puesto:

| Estado | Descripción |
|---|---|
| PENDIENTE | La parte del pedido todavía no tiene una confirmación de pago registrada. |
| ESPERANDO_VALIDACION | El cliente indicó que realizó el pago, pero el comerciante aún no lo ha confirmado. |
| VALIDADO | El comerciante o el trabajador autorizado registró la verificación del dinero recibido. |
| OBSERVADO | El comerciante o el trabajador autorizado identificó una discrepancia que requiere revisión. |
| CANCELADO | El proceso de pago quedó sin efecto como consecuencia de la cancelación correspondiente. |

Estos estados representan el registro operativo interno de la plataforma y no estados bancarios proporcionados mediante API.

El estado del pago de cada puesto deberá coordinarse con el estado general del pedido.

## 8. Reglas de negocio

### RN01. Usuario autorizado del puesto

Solo el comerciante responsable del puesto, o un trabajador de puesto con el permiso correspondiente, podrá registrar la validación del pago de ese puesto.

### RN02. Monto esperado

El sistema deberá conservar el importe esperado de cada puesto al momento de solicitar el pago.

### RN03. Verificación del dinero recibido

El comerciante o el trabajador autorizado deberá comprobar la recepción del dinero mediante el medio de pago correspondiente antes de confirmar la validación.

### RN04. Continuidad del pedido

Los productos de un puesto no podrán avanzar al estado de preparación mientras el pago correspondiente a ese puesto no figure como validado.

### RN05. Prevención de duplicaciones

El sistema deberá impedir que una solicitud repetida genere múltiples confirmaciones incompatibles sobre el mismo pago.

### RN06. Trazabilidad

Cada validación deberá registrar el pedido, el puesto, el usuario responsable, fecha, hora, monto declarado y resultado de la operación.

### RN07. Cancelaciones y devoluciones

La cancelación posterior a un pago validado no deberá eliminar el registro histórico del pago.

El sistema deberá permitir registrar la gestión de devolución correspondiente, cuando proceda, sin asumir que realiza automáticamente una transferencia bancaria.

### RN08. Variaciones de precio o peso

Si durante la preparación se identifican variaciones de precio o peso, el sistema deberá aplicar las tolerancias configuradas y el procedimiento de ajuste y aceptación definido para el pedido.

Cualquier diferencia monetaria deberá registrarse y resolverse antes del cierre correspondiente.

## 9. Organización mediante Clean Architecture

### 9.1. Dominio

Contendrá las reglas de negocio relacionadas con:

- Pago.
- Monto esperado.
- Estado del pago.
- Validación autorizada.
- Transiciones permitidas.
- Registro de ajustes o discrepancias.

### 9.2. Aplicación

Contendrá casos de uso como:

- ObtenerDatosPago.
- RegistrarAvisoPago.
- ValidarPago.
- ObservarPago.
- ConsultarEstadoPago.
- RegistrarDevolucion.

Los casos de uso coordinarán las reglas del dominio y utilizarán interfaces para acceder a los datos.

### 9.3. Presentación

Comprenderá:

- Pantalla que muestra el código QR de cada puesto.
- Información del importe esperado por puesto.
- Interfaz de aviso de pago del cliente.
- Panel de validación de pagos del comerciante y del trabajador autorizado.
- Consulta del estado del pago.

La API REST permitirá registrar las operaciones correspondientes.

### 9.4. Infraestructura

Implementará los repositorios necesarios para almacenar pagos, estados, validaciones y registros de auditoría.

Los códigos QR de cobro y las evidencias digitales, cuando corresponda, podrán almacenarse en el servicio de almacenamiento seleccionado.

No se implementará un adaptador de pasarela bancaria en la primera versión.

## 10. Seguridad y auditoría

Se aplicarán las siguientes medidas:

1. Verificar la identidad y autorización del comerciante o trabajador que confirma el pago.
2. Comprobar que el usuario pertenezca al puesto al que corresponde el pago.
3. Validar las transiciones de estado en el backend.
4. Mantener registros de auditoría de las confirmaciones.
5. Evitar exponer información de pago innecesaria.
6. Proteger los documentos y evidencias almacenadas.
7. Controlar solicitudes duplicadas mediante identificadores de operación o mecanismos equivalentes.
8. Registrar los errores e incidencias relacionados con pagos.

La plataforma no deberá presentar una confirmación manual como si fuera una verificación automática del proveedor bancario.

## 11. Relación con los drivers arquitectónicos

| Driver | Respuesta arquitectónica |
|---|---|
| DA03 - Seguridad | Autorización de operaciones y protección de información relacionada con pagos. |
| DA07 - Pedidos multivendedor | El pago se presenta, registra y valida por cada puesto incluido en el pedido. |
| DA08 - Pagos mediante QR | Se adopta un flujo de pago externo sin pasarela bancaria integrada. |
| DA09 - Control de estados | Los productos de un puesto solo pasan a preparación cuando la validación se registra correctamente. |
| DA10 - Auditoría | Las operaciones críticas de pago mantienen registros de trazabilidad. |

## 12. Consecuencias

### Consecuencias positivas

- Se adapta al modelo operativo del marketplace multivendedor.
- Evita integrar una pasarela bancaria durante la primera versión.
- Permite utilizar medios de pago conocidos por los usuarios.
- Cada comerciante recibe directamente el importe de sus ventas.
- Mantiene registros de los pagos declarados y validados.
- Permite controlar el avance de los pedidos.

### Consecuencias negativas

- La validación depende de una acción humana.
- El cliente debe realizar un pago independiente por cada puesto incluido en el pedido.
- Pueden producirse demoras durante la confirmación.
- Existe riesgo de errores o confirmaciones indebidas por parte del comerciante o del trabajador autorizado.
- No existe conciliación bancaria automatizada.
- Las discrepancias deberán resolverse mediante procedimientos operativos.

## 13. Medidas para reducir riesgos

1. Mostrar claramente el importe y el destinatario del pago de cada puesto.
2. Informar al cliente que debe verificar los datos antes de transferir.
3. Mantener los productos del puesto en espera hasta registrar la validación.
4. Registrar quién confirmó el pago y cuándo lo hizo.
5. Incorporar mecanismos de reporte de incidencias.
6. Evitar confirmaciones duplicadas.
7. Mantener trazabilidad de cancelaciones, ajustes y devoluciones.
8. Definir procedimientos para pagos no identificados o montos incorrectos.

## 14. Pruebas propuestas

Se realizarán pruebas para verificar:

1. Visualización del QR de cada puesto incluido en el pedido.
2. Registro de aviso de pago del cliente.
3. Validación realizada por el comerciante o el trabajador autorizado del puesto.
4. Rechazo de validaciones de usuarios que no pertenecen al puesto.
5. Bloqueo de la preparación cuando el pago no está validado.
6. Prevención de validaciones duplicadas.
7. Registro de discrepancias de monto.
8. Cancelación de pedidos con pagos validados.
9. Conservación de registros de auditoría.
10. Tratamiento de variaciones de precio o peso.

## 15. Resultado esperado

El sistema gestionará el registro y la validación operativa de pagos realizados a cada puesto mediante QR de Yape o Plin.

Las reglas de negocio impedirán preparar los productos de un puesto mientras su pago no haya sido validado por el comerciante o el trabajador autorizado de ese puesto.

La plataforma conservará trazabilidad de las operaciones sin realizar procesamiento bancario automático.

## 16. Relación con otras decisiones

- ADR-001: Adopción de un monolito modular.
- ADR-002: Aplicación de Clean Architecture.
- ADR-003: Control de concurrencia en inventario.
