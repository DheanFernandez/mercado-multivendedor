
# ADR-004: Gestión de Pagos Mediante Códigos QR

## 1. Información de la decisión

| Campo | Descripción |
|---|---|
| ID | ADR-004 |
| Título | Gestión de pagos mediante códigos QR de Yape o Plin |
| Estado | Propuesta |
| Fecha | 08/10/2026 |
| Proyecto | Plataforma Integral Multivendedor para la Gestión Comercial y Operativa de un Mercado de Abastos |
| Driver principal | DA10 - Pagos mediante Yape o Plin |
| Drivers relacionados | DA04, DA09, DA11, DA12 |
| Requisitos relacionados | RF44, RF45, RF46 |
| Restricciones relacionadas | RC13, RC14 |
| Atributos de calidad | AC04 - Seguridad, AC08 - Integridad de la información, AC12 - Privacidad |

## 2. Contexto

La plataforma permitirá que los clientes realicen pedidos con productos provenientes de diferentes puestos comerciales.

Para atender estos pedidos, el cliente seleccionará un repartidor verificado y disponible, quien será responsable de realizar las compras en los puestos correspondientes y entregar los productos.

El importe del pedido estará compuesto por el costo estimado de los productos y el costo del servicio de reparto.

En la primera versión, el pago se realizará directamente del cliente al repartidor mediante Yape o Plin.

La plataforma no utilizará una pasarela bancaria integrada ni ejecutará transferencias de dinero mediante API.

Por tanto, será necesario organizar un procedimiento de validación que permita registrar el pago recibido y controlar la continuidad del pedido.

## 3. Problema arquitectónico

¿Cómo integrar los pagos realizados mediante aplicaciones externas de Yape o Plin dentro del proceso de compra, garantizando el control de estados y la trazabilidad sin utilizar una pasarela bancaria automatizada?

## 4. Alternativas evaluadas

| Alternativa | Ventajas | Limitaciones |
|---|---|---|
| Pasarela de pago integrada mediante API | Permite automatizar la confirmación de pagos cuando el proveedor ofrece mecanismos adecuados. | Requiere integración bancaria, costos y condiciones adicionales fuera del alcance inicial. |
| Transferencias externas sin registro en la plataforma | Implementación sencilla. | No proporciona trazabilidad ni permite controlar correctamente el proceso del pedido. |
| Pago externo mediante QR con validación del repartidor | Se adapta al modelo operativo propuesto y permite registrar el estado del pago sin integración bancaria. | La confirmación depende de la verificación humana y no constituye una validación bancaria automática. |

## 5. Decisión arquitectónica

Se propone utilizar pagos externos mediante códigos QR de Yape o Plin, asociados al repartidor seleccionado.

La plataforma mostrará el código QR correspondiente al medio de pago configurado por el repartidor.

El cliente realizará el pago desde la aplicación externa.

Posteriormente, el repartidor verificará que el dinero haya sido recibido correctamente en su cuenta y registrará la validación dentro de la plataforma.

El sistema no considerará validado un pago únicamente porque el cliente haya indicado que realizó la transferencia o haya adjuntado una captura.

La confirmación registrada por el repartidor permitirá que el pedido continúe hacia el proceso de compra.

## 6. Flujo general de pago

1. El cliente selecciona los productos del marketplace.
2. El sistema calcula el importe estimado por puesto y el total general.
3. El cliente selecciona un repartidor disponible.
4. El sistema registra la reserva temporal del repartidor.
5. El repartidor acepta la solicitud.
6. El sistema presenta el importe a pagar y el código QR del repartidor.
7. El cliente realiza el pago mediante Yape o Plin.
8. El pedido permanece en estado de espera de validación de pago.
9. El repartidor comprueba la recepción del dinero mediante su aplicación de pago.
10. El repartidor registra la confirmación del pago dentro de la plataforma.
11. El sistema verifica que la transición de estado sea válida.
12. El pedido pasa al estado de pago validado y queda habilitado para el proceso de compra.

Si el pago no puede verificarse, el pedido no deberá continuar automáticamente hacia la compra.

## 7. Estados del pago

Se propone utilizar los siguientes estados lógicos:

| Estado | Descripción |
|---|---|
| PENDIENTE | El pedido todavía no tiene una confirmación de pago registrada. |
| ESPERANDO_VALIDACION | El cliente indicó que realizó el pago, pero el repartidor aún no lo ha confirmado. |
| VALIDADO | El repartidor registró la verificación del dinero recibido. |
| OBSERVADO | El repartidor identificó una discrepancia que requiere revisión. |
| CANCELADO | El proceso de pago quedó sin efecto como consecuencia de la cancelación correspondiente. |

Estos estados representan el registro operativo interno de la plataforma y no estados bancarios proporcionados mediante API.

El estado del pago deberá coordinarse con el estado general del pedido.

## 8. Reglas de negocio

### RN01. Repartidor autorizado

Solo un repartidor verificado, habilitado y correctamente asignado al pedido podrá registrar la validación del pago correspondiente.

### RN02. Monto esperado

El sistema deberá conservar el importe esperado del pedido al momento de solicitar el pago.

### RN03. Verificación del dinero recibido

El repartidor deberá comprobar la recepción del dinero mediante el medio de pago correspondiente antes de confirmar la validación.

### RN04. Continuidad del pedido

Un pedido no podrá avanzar al estado de compra en proceso mientras el pago no figure como validado.

### RN05. Prevención de duplicaciones

El sistema deberá impedir que una solicitud repetida genere múltiples confirmaciones incompatibles sobre el mismo pago.

### RN06. Trazabilidad

Cada validación deberá registrar el pedido, repartidor responsable, fecha, hora, monto declarado y resultado de la operación.

### RN07. Cancelaciones y devoluciones

La cancelación posterior a un pago validado no deberá eliminar el registro histórico del pago.

El sistema deberá permitir registrar la gestión de devolución correspondiente, cuando proceda, sin asumir que realiza automáticamente una transferencia bancaria.

### RN08. Variaciones de precio o peso

Si durante la compra se identifican variaciones de precio o peso, el sistema deberá aplicar las tolerancias configuradas y el procedimiento de ajuste y aceptación definido para el pedido.

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

- Pantalla que muestra el código QR.
- Información del importe esperado.
- Interfaz de aviso de pago del cliente.
- Panel de validación del repartidor.
- Consulta del estado del pago.

La API REST permitirá registrar las operaciones correspondientes.

### 9.4. Infraestructura

Implementará los repositorios necesarios para almacenar pagos, estados, validaciones y registros de auditoría.

Los archivos o evidencias digitales, cuando corresponda, podrán almacenarse en el servicio de almacenamiento seleccionado.

No se implementará un adaptador de pasarela bancaria en la primera versión.

## 10. Seguridad y auditoría

Se aplicarán las siguientes medidas:

1. Verificar la identidad y autorización del repartidor que confirma el pago.
2. Comprobar que el repartidor esté asignado al pedido correspondiente.
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
| DA04 - Seguridad | Autorización de operaciones y protección de información relacionada con pagos. |
| DA09 - Integración del repartidor | El repartidor participa en la verificación del dinero y la continuidad del pedido. |
| DA10 - Pagos mediante QR | Se adopta un flujo de pago externo sin pasarela bancaria integrada. |
| DA11 - Control de estados | El pedido solo continúa cuando la validación se registra correctamente. |
| DA12 - Auditoría | Las operaciones críticas de pago mantienen registros de trazabilidad. |

## 12. Consecuencias

### Consecuencias positivas

- Se adapta al modelo operativo del marketplace.
- Evita integrar una pasarela bancaria durante la primera versión.
- Permite utilizar medios de pago conocidos por los usuarios.
- Mantiene registros de los pagos declarados y validados.
- Permite controlar el avance de los pedidos.

### Consecuencias negativas

- La validación depende de una acción humana.
- Pueden producirse demoras durante la confirmación.
- Existe riesgo de errores o confirmaciones indebidas por parte del repartidor.
- No existe conciliación bancaria automatizada.
- Las discrepancias deberán resolverse mediante procedimientos operativos.

## 13. Medidas para reducir riesgos

1. Mostrar claramente el importe y el destinatario del pago.
2. Informar al cliente que debe verificar los datos antes de transferir.
3. Mantener el pedido en espera hasta registrar la validación.
4. Registrar quién confirmó el pago y cuándo lo hizo.
5. Incorporar mecanismos de reporte de incidencias.
6. Evitar confirmaciones duplicadas.
7. Mantener trazabilidad de cancelaciones, ajustes y devoluciones.
8. Definir procedimientos para pagos no identificados o montos incorrectos.

## 14. Pruebas propuestas

Se realizarán pruebas para verificar:

1. Visualización del QR del repartidor seleccionado.
2. Registro de aviso de pago del cliente.
3. Validación realizada por el repartidor asignado.
4. Rechazo de validaciones de repartidores no autorizados.
5. Bloqueo de la compra cuando el pago no está validado.
6. Prevención de validaciones duplicadas.
7. Registro de discrepancias de monto.
8. Cancelación de pedidos con pagos validados.
9. Conservación de registros de auditoría.
10. Tratamiento de variaciones de precio o peso.

## 15. Resultado esperado

El sistema gestionará el registro y la validación operativa de pagos realizados mediante QR de Yape o Plin.

Las reglas de negocio impedirán continuar con la compra mientras el pago no haya sido validado por el repartidor autorizado.

La plataforma conservará trazabilidad de las operaciones sin realizar procesamiento bancario automático.

## 16. Relación con otras decisiones

- ADR-001: Adopción de un monolito modular.
- ADR-002: Aplicación de Clean Architecture.
- ADR-003: Control de concurrencia en inventario y repartidores.
