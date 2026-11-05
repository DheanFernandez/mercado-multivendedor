
# ADR-005: Pago Único por Pedido Mediante Mercado Pago

## 1. Información de la decisión

| Campo | Descripción |
|---|---|
| ID | ADR-005 |
| Título | Pago único por pedido mediante Mercado Pago |
| Estado | Propuesta |
| Reemplaza a | [ADR-004](ADR-004-pagos-qr.md) |
| Fecha | 04/11/2026 |
| Proyecto | Plataforma Integral Multivendedor para la Gestión Comercial y Operativa de un Mercado de Abastos |
| Driver principal | DA08 - Pago único por pedido con confirmación automática mediante pasarela de pago |
| Drivers relacionados | DA03, DA07, DA09, DA10, DA11 |
| Requisitos relacionados | RF32, RF33, RF34, RF35, RF47 en adelante |
| Restricciones relacionadas | RC13, RC14, RC17 |
| Atributos de calidad | AC09 - Usabilidad, AC04 - Seguridad, AC08 - Integridad de la información, AC03 - Disponibilidad, AC11 - Recuperabilidad |

## 2. Contexto

La plataforma permite que un cliente arme un único pedido con productos provenientes de diferentes puestos comerciales. Cada puesto prepara sus productos y el cliente los retira en el puesto correspondiente, sin servicio de delivery.

La decisión anterior ([ADR-004](ADR-004-pagos-qr.md)) establecía que el cliente pagara a cada puesto por separado mediante códigos QR de Yape o Plin y que el comerciante validara manualmente el dinero recibido.

Durante el análisis de usabilidad se observó que este flujo resulta poco práctico para el cliente:

- El cliente debe realizar tantos pagos como puestos incluya su pedido, cambiando repetidamente entre la plataforma y la aplicación de pago.
- La confirmación depende de que cada comerciante revise su aplicación y registre la validación, lo que genera demoras e incertidumbre sobre el estado del pedido.
- El riesgo de errores aumenta con el número de puestos: montos incorrectos, pagos al destinatario equivocado o validaciones indebidas.

Por ello, se requiere un flujo en el que el cliente pague una sola vez por todo su pedido y la plataforma reciba la confirmación del pago de forma automática.

## 3. Problema arquitectónico

¿Cómo permitir que el cliente pague en una única transacción un pedido que incluye productos de varios puestos comerciales, obteniendo una confirmación automática y confiable del pago, manteniendo el control de estados por puesto y la trazabilidad de la operación?

## 4. Alternativas evaluadas

| Alternativa | Ventajas | Limitaciones | Resultado |
|---|---|---|---|
| Pago manual mediante QR de Yape o Plin por puesto (ADR-004) | No requiere integración con una pasarela; cada comerciante recibe directamente su dinero. | Un pago por puesto, validación humana, demoras y riesgo de errores. Afecta la usabilidad del proceso de compra. | Descartada |
| Checkout de Mercado Pago con pago único por pedido | El cliente paga una sola vez; la pasarela confirma el pago automáticamente mediante notificaciones; dispone de entorno Sandbox para pruebas. | Introduce una dependencia externa crítica y requiere integrar, asegurar y probar la API y las notificaciones. | **Seleccionada** |
| Mercado Pago con división de pagos (Split / marketplace) | Permite que el importe de cada puesto se acredite directamente en la cuenta vinculada de su comerciante. | Mayor complejidad de configuración y de conciliación; depende de las condiciones del proveedor para pagos multivendedor. | Respaldo |
| Cobro centralizado en una cuenta del mercado con liquidación posterior | Integración más simple: un solo receptor del pago. | El mercado debe recaudar y luego liquidar a cada comerciante, proceso operativo y contable fuera del alcance inicial. | Respaldo |

## 5. Decisión arquitectónica

Se propone integrar **Mercado Pago Checkout** para que el cliente realice un **pago único por pedido**.

### 5.1. Importe del pedido

El importe a cobrar será la **suma de los subtotales** de todas las agrupaciones por puesto incluidas en el pedido.

El sistema conservará el subtotal de cada puesto al momento de generar el cobro, de modo que el pago único pueda distribuirse y conciliarse por puesto.

### 5.2. Flujo general de pago

1. El cliente confirma el pedido y el sistema registra el pedido agrupado por puesto, junto con las reservas de inventario ([ADR-003](ADR-003-control-concurrencia.md)).
2. El sistema calcula el total como la suma de los subtotales por puesto.
3. El módulo Pagos solicita a Mercado Pago la creación de una preferencia de pago con el total, una referencia externa al pedido y su tiempo de expiración.
4. El cliente es redirigido al Checkout de Mercado Pago y realiza el pago.
5. Mercado Pago notifica el resultado a la plataforma mediante un Webhook.
6. El sistema verifica la autenticidad de la notificación y consulta a la API de Mercado Pago el estado real del pago.
7. Si el pago está aprobado, el pedido y cada una de sus agrupaciones por puesto pasan a estado de pago aprobado y quedan habilitados para su preparación.
8. Si el pago es rechazado, cancelado o expira, las agrupaciones no pasan a preparación y las reservas de inventario se liberan según [ADR-003](ADR-003-control-concurrencia.md).

La redirección de retorno del Checkout al cliente solo se utilizará para informar el resultado en pantalla; el estado del pago se determinará únicamente a partir del Webhook verificado y de la consulta a la API.

### 5.3. Webhook verificado

La plataforma expondrá un endpoint dedicado para recibir las notificaciones de Mercado Pago. Su procesamiento deberá:

1. Validar la firma de la notificación antes de procesarla.
2. Consultar el pago en la API de Mercado Pago a partir del identificador recibido, sin confiar en el contenido de la notificación como fuente del estado.
3. Comprobar que el monto y la referencia externa coincidan con el pedido registrado.
4. Procesar la notificación de forma idempotente, ignorando notificaciones duplicadas o que no cambien el estado.
5. Responder rápidamente a la pasarela y registrar cada notificación recibida para auditoría.

### 5.4. Estados del pago

| Estado | Descripción |
|---|---|
| PENDIENTE | El cobro fue generado y el cliente aún no completa el pago. |
| EN_PROCESO | Mercado Pago informó que el pago se encuentra en revisión. |
| APROBADO | Mercado Pago confirmó el pago y la plataforma verificó la notificación. |
| RECHAZADO | Mercado Pago rechazó el pago. |
| EXPIRADO | El tiempo de pago terminó sin una aprobación. |
| CANCELADO | El cobro quedó sin efecto por la cancelación del pedido. |
| REEMBOLSADO | El importe fue devuelto total o parcialmente al cliente. |

Los productos de un puesto solo podrán pasar a preparación cuando el pago del pedido figure como APROBADO por la pasarela.

### 5.5. Arquitectura hexagonal en el módulo Pagos

La integración se organizará mediante puertos y adaptadores dentro del módulo Pagos, en coherencia con [ADR-002](ADR-002-clean-architecture.md):

- **Dominio:** entidad Pago, montos por puesto, estados y transiciones permitidas.
- **Aplicación:** casos de uso como IniciarPago, ProcesarNotificacionPago, ConsultarEstadoPago, ExpirarPago y RegistrarReembolso, junto con el puerto `PasarelaPagoPort`.
- **Adaptador de salida:** `MercadoPagoAdapter`, que implementa `PasarelaPagoPort` utilizando la API de Mercado Pago.
- **Adaptador de entrada:** controlador REST del Webhook, encargado de verificar la firma y delegar en el caso de uso correspondiente.

Ningún otro módulo dependerá directamente del SDK o de la API de Mercado Pago. Esto permitirá sustituir el proveedor, o pasar a una alternativa de respaldo, sin modificar las reglas de negocio de pedidos e inventario.

### 5.6. Cuentas de los comerciantes y comisión

Cada comerciante deberá vincular su cuenta de Mercado Pago a la plataforma antes de que sus productos puedan incluirse en un cobro.

La comisión de la pasarela será asumida por el comerciante, conforme a RC14. El sistema registrará la comisión informada por la pasarela para cada operación.

## 6. Entorno Sandbox

La primera versión se desarrollará y validará en el **entorno Sandbox de Mercado Pago**:

- Se utilizarán credenciales de prueba, separadas de cualquier credencial productiva.
- Se emplearán usuarios de prueba para el comprador y para los comerciantes.
- Se usarán tarjetas de prueba para simular pagos aprobados, rechazados y pendientes.
- Las credenciales y la URL del Webhook se configurarán mediante variables de entorno, nunca en el código fuente.

El paso a un entorno productivo requerirá una decisión posterior.

## 7. Seguridad

1. **Firma de los Webhooks:** cada notificación deberá validarse mediante la firma enviada por Mercado Pago y la clave secreta configurada en la plataforma; las notificaciones con firma inválida o antigua se rechazarán.
2. **Consulta de confirmación:** el estado del pago se obtendrá siempre desde la API de Mercado Pago y no desde los datos de la notificación ni de la redirección del cliente.
3. **Cifrado de tokens:** los tokens de acceso obtenidos al vincular la cuenta de cada comerciante se almacenarán cifrados en la base de datos y solo se descifrarán en el adaptador de la pasarela.
4. **Gestión de secretos:** las credenciales de la plataforma y la clave del Webhook se mantendrán en variables de entorno o en un gestor de secretos.
5. **Mínima exposición:** la plataforma no almacenará datos de tarjetas; estos serán gestionados exclusivamente por Mercado Pago.
6. **Autorización:** solo el comerciante titular podrá vincular o desvincular la cuenta de Mercado Pago de sus puestos.
7. **Auditoría:** se registrarán las notificaciones recibidas, las consultas realizadas y los cambios de estado del pago.

## 8. Relación con los drivers arquitectónicos

| Driver | Respuesta arquitectónica |
|---|---|
| DA03 - Seguridad | Verificación de firmas de Webhooks, cifrado de tokens de comerciantes y gestión de secretos. |
| DA07 - Pedidos multivendedor | El pago único se calcula como la suma de subtotales por puesto y se concilia por cada agrupación. |
| DA08 - Pago único por pedido | El cliente paga una sola vez mediante Mercado Pago Checkout y la confirmación se recibe automáticamente. |
| DA09 - Control de estados | Las agrupaciones solo pasan a preparación cuando el pago es aprobado por la pasarela. |
| DA10 - Auditoría | Se registran las notificaciones, consultas y transiciones de estado del pago. |
| DA11 - Aislamiento de fallos | El adaptador aísla la dependencia externa; las notificaciones se procesan de forma idempotente y con conciliación ante retrasos. |

## 9. Consecuencias

### Consecuencias positivas

- El cliente realiza un único pago por pedido, mejorando la usabilidad del proceso de compra.
- La confirmación del pago es automática y no depende de una validación humana.
- Se reducen las demoras y los errores asociados a la validación manual.
- La lógica de la pasarela queda aislada en el módulo Pagos mediante puertos y adaptadores.
- El entorno Sandbox permite probar el flujo completo sin movimientos de dinero real.

### Consecuencias negativas

- Se incorpora una dependencia externa crítica para el proceso de compra.
- Cada comerciante debe disponer de una cuenta de Mercado Pago y vincularla a la plataforma.
- El comerciante asume la comisión de la pasarela.
- Aumenta la complejidad técnica: Webhooks, firmas, idempotencia, conciliación y reembolsos.
- La distribución del pago único entre varios comerciantes depende de las capacidades ofrecidas por el proveedor.

## 10. Riesgos y medidas de mitigación

| Riesgo | Medida de mitigación |
|---|---|
| Indisponibilidad de Mercado Pago | Informar al cliente, mantener el pedido en PENDIENTE hasta la expiración de la reserva y reintentar la creación del cobro de forma controlada. |
| Webhooks perdidos o retrasados | Conciliación periódica consultando a la API el estado de los pagos pendientes. |
| Notificaciones duplicadas | Procesamiento idempotente basado en el identificador del pago y el estado actual. |
| Aprobación posterior a la expiración de la reserva | Tratamiento definido en [ADR-003](ADR-003-control-concurrencia.md): nueva reserva atómica o reembolso al cliente. |
| Notificaciones falsificadas | Validación de firma y consulta del pago a la API antes de cambiar estados. |
| Filtración de tokens de comerciantes | Cifrado en reposo, acceso restringido al adaptador y rotación ante incidentes. |
| Limitaciones del proveedor para distribuir pagos multivendedor | Evaluar las alternativas de respaldo: división de pagos (Split) o cobro centralizado con liquidación posterior. |
| Comerciante sin cuenta vinculada | Impedir la publicación de sus productos en el marketplace hasta completar la vinculación. |

## 11. Pruebas propuestas

1. Pago aprobado de un pedido con productos de varios puestos.
2. Pago rechazado y liberación de reservas.
3. Pago pendiente que expira sin aprobación.
4. Aprobación recibida después de la expiración de la reserva.
5. Recepción de notificaciones duplicadas.
6. Rechazo de notificaciones con firma inválida.
7. Coincidencia entre el monto pagado y la suma de subtotales.
8. Conciliación de pagos cuyo Webhook no fue recibido.
9. Vinculación y desvinculación de la cuenta de un comerciante.
10. Reembolso de un pedido cancelado con pago aprobado.

## 12. Resultado esperado

El cliente pagará su pedido multivendedor en una única transacción mediante Mercado Pago Checkout.

La plataforma recibirá la confirmación del pago de forma automática y verificada, habilitando la preparación en cada puesto solo cuando la pasarela apruebe el pago.

La integración permanecerá aislada en el módulo Pagos, manteniendo trazabilidad y permitiendo cambiar de proveedor o de modalidad de cobro sin afectar las reglas de negocio.

## 13. Relación con otras decisiones

- [ADR-001](ADR-001-monolito-modular.md): Adopción de un monolito modular.
- [ADR-002](ADR-002-clean-architecture.md): Aplicación de Clean Architecture.
- [ADR-003](ADR-003-control-concurrencia.md): Control de concurrencia en inventario.
- [ADR-004](ADR-004-pagos-qr.md): Gestión de pagos mediante códigos QR (reemplazada por esta decisión).
