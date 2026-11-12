# Feature Specification: Pedidos y subpedidos (S-07 · crear y consultar el pedido)

**Feature Branch**: `feat/pedidos-backend` (directorio de especificación `003-pedidos-subpedidos`)

**Created**: 2026-11-06

**Status**: Clarificada y cerrada (2026-11-06); resoluciones técnicas del equipo incorporadas en una segunda ronda (DE-5, código, duración, reintentos, triggers, lectura autoritativa del carrito). Sin marcadores abiertos. El enfoque técnico está en `plan.md`

**Input**: User description: "Desarrollar el módulo S-07 Pedidos y Subpedidos: crear un pedido a partir del carrito autenticado, con código único, subpedidos por puesto, importes históricos, reverificación de disponibilidad con las reservas atómicas de Inventario, protección frente a reintentos, consulta del estado y historial de transiciones. Sin Mercado Pago, webhooks ni distribución de dinero."

## Trazabilidad *(obligatoria)*

| Elemento | Referencias |
|---|---|
| Historias de usuario (HU) | HU07 (generar pedido), HU09 (consultar estado, parte RF30 y RF31); apoyo: HU04–HU06 (origen: carrito) |
| Requisitos funcionales (RF) | RF25, RF26, RF27, RF28, RF29, RF30, RF31; RF32 solo en su parte de **presentación** de subtotales por puesto y total antes de pagar; apoyo: RF14, RF15 (Inventario), RF20–RF24 (Carrito); dependencias **no implementadas** en esta fase: RF45 (Configuración operativa) y RF54 (expiración, módulo Pagos) |
| Decisiones (ADR) | ADR-001, ADR-002, ADR-003 (§6.2 proceso de reserva, §6.4, §7 idempotencia, §10 pruebas), ADR-005 (solo el contexto: estados del pago y Webhook quedan **fuera**) |
| Restricciones, atributos y drivers (RC / AC / DA) | RC04, RC05, RC06, RC07, RC11, RC12, RC13 (el pago único queda fuera de esta fase); AC01, AC04, AC07, AC08, AC12; DA02, DA07, DA09, DA14 |
| Decisiones del registro (DEC) que afectan | DEC-01/DEC-02 (Pagos), DEC-05 (Auditoría), DEC-06 (nombre `orders`/`pedidos`), DEC-09 (trabajadores de puesto): todas `PENDIENTE`; esta especificación no las da por resueltas |
| Escenario de calidad | **EQ-02** (integridad del pedido multivendedor), complementa EQ-03 |
| Diagramas aprobados que se respetan | C4 nivel 3 (Pedidos → Carrito, Pedidos → Inventario) y C4 nivel 4 («Crear pedido multivendedor»: entidades `Pedido`, `PedidoPuesto`, `ItemPedido`, enumeración `EstadoPedidoPuesto`) |
| Módulo(s) y estado | `orders`: nuevo (hoy solo existe el módulo vacío `orders.module.ts`). Depende de `cart` e `inventory` (implementados) |
| Roles que intervienen | CLIENTE (crea y consulta sus pedidos). COMERCIANTE, TRABAJADOR_PUESTO y ADMINISTRADOR: sin acceso en esta fase (ver Q10) |

**Criterios de aceptación → prueba**: cada criterio CA-O* de la matriz (§«Matriz RF/HU → criterios») indica su tipo de prueba: unitaria (dominio y casos de uso), HTTP (aplicación completa con repositorios en memoria), persistencia (PostgreSQL local de Docker, incluida concurrencia y fallo forzado) o compilación/lint.

**Aclaraciones y decisiones de especificación** (la documentación no lo dice o lo dice a medias; no se reescribe ningún requisito):

| Id | Qué dice la documentación | Tratamiento en esta especificación |
|---|---|---|
| DE-1 | ADR-003 §6.2 y C4 N4 fijan que la reserva ocurre **al crear el pedido**, no al agregar al carrito (el carrito no reserva: `specs/002-carrito` R8) | Se adopta tal cual (FR-006) |
| DE-2 | C4 N4 incluye `registrarPagoPendiente`/`iniciarCobro` dentro de «Crear pedido», pero el módulo Pagos no existe y DEC-01/DEC-02 bloquean su especificación (constitución VI) | Esta fase **no** registra pago ni cobro. El subpedido nace en `ESPERANDO_PAGO` y la respuesta no incluye datos de Checkout (FR-017) |
| DE-3 | C4 N4 define estados **por subpedido** (`EstadoPedidoPuesto`) y ninguno para el pedido principal | El estado general es solo una representación de consulta derivada; no se añade ningún estado persistido (Q3, FR-016) |
| DE-4 | RF45 (tiempos de reserva configurables) no tiene módulo: Configuración operativa no existe | La duración viene de una configuración externa y reemplazable; no se asume ningún valor de negocio (Q2, FR-028) |
| DE-5 | ADR-003 §7 pide devolver el resultado anterior ante un reintento; la solicitud HTTP de creación solo expresa la clave | **Idempotencia por `(cliente, clave)`**: la primera ejecución exitosa guarda la identidad y la huella del carrito realmente procesado (trazabilidad); repetir la clave devuelve siempre el mismo pedido, sin reservar de nuevo, aunque el carrito esté vacío o distinto. **El sistema no compara el contenido de los reintentos** porque la solicitud no puede expresarlo; una compra nueva exige una clave nueva (decisión del equipo; sustituye la cláusula de «operación diferente» de Q6) |

## Clarifications

### Session 2026-11-06

Respuestas obtenidas con evidencia de la documentación aprobada o por **decisión del equipo comunicada por el responsable del repositorio** (marcadas «equipo»). Ninguna regla de negocio se inventó.

- Q1 · ¿Cuándo se reserva el stock? → A: Al crear el pedido, dentro de la misma operación que lo registra; el carrito no reserva (ADR-003 §6.2; C4 N4 §4 pasos 5–8; RF25).
- Q2 · ¿De dónde sale la duración de la reserva y quién expira? → A (equipo): de una configuración externa y reemplazable por Configuración operativa (S-04), expresada en minutos como **entero positivo con un límite técnico** (solo para evitar desbordes de fecha; no es regla de negocio); sin valor predeterminado ni duración de negocio asumida: si falta o es inválida no se aceptan pedidos (servicio no disponible). La expiración y el estado `EXPIRADO` dependen de Pagos (RF54, ADR-003 §6.5, C4 N3): hasta S-08 las reservas llevan su vencimiento pero nadie las libera.
- Q3 · ¿Qué es el «estado general» del pedido? → A (equipo): se deriva de los subpedidos: el estado común si coinciden y `MIXTO` si difieren; es solo una representación de consulta, no un estado persistido ni parte de `EstadoPedidoPuesto`.
- Q4 · ¿Qué ocurre con el carrito? → A (equipo): se vacía únicamente cuando el pedido y las reservas quedan confirmados en la misma operación atómica; si el carrito cambió desde que se leyó, se revierte toda la operación y no se pierde ninguna línea nueva.
- Q5 · ¿La reserva y el registro son una sola operación atómica? → A: Sí (ADR-003 §6.2; ADR-002; C4 N3 §4–5; EQ-02). Equipo: Carrito, Pedidos e Inventario participan en una única operación atómica; ante errores transitorios (interbloqueo y fallo de serialización) se reintenta la operación completa **hasta cinco intentos en total**; los errores de dominio y los de integridad **no** se reintentan. El mecanismo se justifica en `plan.md` y `research.md`.
- Q6 · ¿Cómo se evita el pedido duplicado? → A: Con una clave aportada por el cliente; repetir una solicitud devuelve el pedido existente (200; una creación nueva responde 201) (ADR-003 §7; C4 N4 §4). Equipo (DE-5): la clave pertenece al cliente, no hay `carritoId` en la solicitud, el reintento devuelve el pedido existente **aunque el carrito esté vacío o distinto**, y el sistema **no compara contenido**: una compra nueva exige una clave nueva.
- Q7 · ¿Hay cancelación? → A: No en esta fase; `CANCELADO` existe pero su origen es Pagos o Incidencias (C4 N4 §3; RF40; C4 N3).
- Q8 · ¿Qué importes se conservan y qué pasa con una línea no comprable? → A: Nombre, unidad, cantidad y precio vigentes al crear (C4 N4 `ItemPedido.precioUnitario`; RF32); si un producto no está disponible o no tiene stock se rechaza el pedido completo informando cuál (C4 N4 §4; EQ-02; RF25).
- Q9 · ¿Cómo es el código? → A (equipo): `PED-` seguido de ocho caracteres legibles obtenidos con aleatoriedad criptográficamente segura; unicidad estricta y reintentos acotados ante colisión, separados de los reintentos de la operación (RF27).
- Q10 · ¿Quién consulta? → A: El cliente dueño (HU09, RF30); el comerciante (RF46) lo asigna C4 N3 a Reportes y el trabajador depende de DEC-09.
- Q4 (precisión de la segunda ronda) · El pedido se construye con el carrito leído **con bloqueo dentro de la operación atómica**, no con una lectura previa; dos solicitudes del mismo cliente se procesan una tras otra, también cuando el carrito no existe o está vacío.
- Q11 · ¿Se registra pago al crear? → A: No: Pagos no existe y DEC-01/DEC-02 lo bloquean (constitución VI); sin auditoría salvo el historial de estados (constitución VIII; DEC-05 pendiente).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Crear un pedido multivendedor desde mi carrito (Priority: P1) 🎯 MVP

Como cliente con un carrito de productos de varios puestos, quiero generar un pedido para iniciar el proceso de compra (HU07). El sistema comprueba de nuevo la disponibilidad, reserva el stock de todo el pedido a la vez, registra el pedido principal con un subpedido por puesto y me devuelve el código del pedido y los importes por puesto y el total.

**Why this priority**: sin pedido no hay pago, preparación ni retiro; es el núcleo de la ruta crítica Inventario → Carrito → **Pedidos** → Pagos.

**Independent Test**: con un carrito de tres puestos y stock suficiente, crear el pedido y comprobar un pedido con 3 subpedidos, el stock reservado por producto y el total igual a la suma de subtotales.

**Acceptance Scenarios**:

1. **Given** un cliente con un carrito vigente de productos de 3 puestos y stock suficiente, **When** crea el pedido, **Then** se registra un pedido con código único y 3 subpedidos (uno por puesto) en estado `ESPERANDO_PAGO`, cada uno con sus líneas, su subtotal y el total general (CA-O1, CA-O2, CA-O3).
2. **Given** el pedido creado, **When** se consulta el stock, **Then** cada producto tiene reservada exactamente la cantidad pedida y el stock físico no cambia (CA-O6).
3. **Given** un carrito con un producto cuya cantidad supera el stock disponible, **When** crea el pedido, **Then** la solicitud se rechaza indicando el producto sin stock, **no** se crea pedido ni subpedido y **no** queda ninguna reserva de los demás productos (CA-O7, EQ-02).
4. **Given** un carrito vacío o con líneas no vigentes (producto ya no disponible o sobre el stock), **When** crea el pedido, **Then** se rechaza sin crear nada (CA-O8).
5. **Given** un fallo inesperado forzado a mitad de la creación, **When** termina la operación, **Then** no quedan pedidos, subpedidos ni reservas parciales y el carrito conserva todas sus líneas (CA-O9, EQ-02).
6. **Given** un pedido creado con éxito, **When** termina la operación, **Then** el carrito del cliente queda vacío y esto ocurrió en la misma operación atómica que el pedido y las reservas (CA-O23).
7. **Given** que el cliente modifica su carrito mientras se crea el pedido, **When** termina la operación, **Then** cada línea queda o bien en el pedido o bien en el carrito, nunca perdida ni duplicada, y el pedido refleja exactamente el contenido bloqueado durante la operación (CA-O23).
8. **Given** que la configuración de duración de reserva no existe o es inválida, **When** crea un pedido nuevo, **Then** se informa «servicio no disponible» y no se crea nada (CA-O24). Si la clave ya corresponde a un pedido confirmado, se devuelve ese pedido sin consultar la configuración (DI-2).
9. **Given** dos solicitudes simultáneas del mismo cliente con claves distintas sobre el mismo carrito, **When** se procesan, **Then** una crea el pedido y la otra, procesada después, recibe «carrito vacío» sin crear ni reservar nada; igual si el cliente no tenía carrito (CA-O28).

---

### User Story 2 - Reintentar la creación sin duplicar el pedido (Priority: P1)

Como cliente cuya conexión falla o que pulsa dos veces, quiero que repetir la misma solicitud no genere un segundo pedido ni una segunda reserva (ADR-003 §7).

**Why this priority**: sin protección, un reintento reserva stock dos veces y crea pedidos duplicados (AC07, AC08).

**Independent Test**: enviar la misma solicitud con la misma clave de operación 20 veces en paralelo y comprobar que existe un único pedido y una única reserva.

**Acceptance Scenarios**:

1. **Given** un pedido ya creado con una clave de operación, **When** el cliente repite la solicitud con la misma clave, **Then** recibe el **mismo** pedido (mismo código e importes) y el stock reservado no cambia (CA-O10).
2. **Given** varias solicitudes simultáneas con la misma clave, **When** se procesan, **Then** exactamente una crea el pedido y las demás devuelven ese mismo pedido (CA-O11).
3. **Given** una clave ya usada para crear un pedido, **When** se repite la solicitud, **Then** recibe el pedido original sin reservar de nuevo, **aunque el carrito esté vacío o tenga otro contenido**; el sistema no compara el contenido del reintento y una compra nueva exige una clave nueva (CA-O12).
4. **Given** que la clave de operación falta o no es válida, **When** se solicita el pedido, **Then** se rechaza por validación (CA-O13).

---

### User Story 3 - Consultar el estado y los importes de mi pedido (Priority: P2)

Como cliente, quiero consultar mi pedido —estado de cada puesto, líneas, subtotal por puesto y total a cobrar— antes de pagar (HU09, RF30; RF32 en su parte de presentación).

**Why this priority**: da visibilidad y es la base del seguimiento posterior; depende de que el pedido exista.

**Independent Test**: crear un pedido y consultarlo por su identificador como su dueño y como otro cliente.

**Acceptance Scenarios**:

1. **Given** un pedido propio, **When** lo consulto, **Then** veo su código, la fecha, el estado de cada subpedido, las líneas con nombre, unidad, cantidad y precio unitario, el subtotal por puesto y el total a cobrar (CA-O14).
2. **Given** que el precio de un producto cambió después de crear el pedido, **When** consulto el pedido, **Then** los importes siguen siendo los del momento de la creación (CA-O4).
3. **Given** el pedido de otro cliente, **When** lo consulto, **Then** recibo «no encontrado» y ningún dato (CA-O15, AC12).
4. **Given** un usuario sin sesión o con rol distinto de cliente, **When** intenta crear o consultar pedidos, **Then** recibo 401 o 403 respectivamente (CA-O16, AC04).
5. **Given** un pedido cuyos subpedidos tienen el mismo estado, **When** lo consulto, **Then** el estado general es ese estado; si difieren, es `MIXTO` (CA-O25).

---

### User Story 4 - Ver el historial de cambios de estado (Priority: P2)

Como cliente, quiero ver el historial de cambios de estado de mi pedido (RF31, HU09) para saber qué ocurrió y cuándo.

**Why this priority**: es parte de HU09 y de la trazabilidad (AC06), pero la utilidad crece cuando existan más transiciones (Pagos y Preparación).

**Independent Test**: crear un pedido y comprobar que su historial contiene el registro inicial con fecha y origen.

**Acceptance Scenarios**:

1. **Given** un pedido recién creado, **When** consulto su historial, **Then** aparece un registro por subpedido con estado inicial `ESPERANDO_PAGO`, fecha y actor u origen del cambio (CA-O17).
2. **Given** un pedido cuyo subpedido cambia de estado mediante una transición permitida, **When** consulto el historial, **Then** cada cambio queda registrado en orden cronológico y no se puede borrar ni editar (CA-O18).
3. **Given** una transición no permitida por el diagrama de estados aprobado, **When** se intenta, **Then** se rechaza y el estado no cambia (CA-O19).

---

### Edge Cases

- Carrito con productos que cambiaron de precio entre la consulta del carrito y la creación del pedido: se usan los precios vigentes **al crear**; los importes que el cliente vio pueden diferir y debe poder verlo (Q8).
- Dos clientes con el último stock de un producto: exactamente uno obtiene el pedido y el otro recibe falta de stock sin reservas colgadas (CA-O20, AC07).
- Producto despublicado, puesto o categoría inactivos entre agregar al carrito y crear el pedido: el pedido se rechaza completo (CA-O8).
- Pedido con el máximo de productos distintos del carrito (50) y con cantidades máximas: se crea o se rechaza completo, nunca parcial.
- Fallo del almacenamiento en medio de la operación (error técnico): respuesta controlada sin detalles internos y sin estado parcial (DA11).
- Reintento después de que el carrito ya se convirtió en pedido: devuelve el pedido original por su clave, no «carrito vacío» (Q4, Q6, DE-5).
- Dos solicitudes con claves distintas sobre el mismo carrito a la vez: se procesan una tras otra; la segunda encuentra el carrito vacío (o inexistente) y se rechaza sin crear nada (CA-O28).
- Reutilizar una clave para una compra nueva: devuelve el pedido original (comportamiento documentado; la clave nueva es responsabilidad del cliente).
- Colisión del código del pedido: se reintenta con otro código un número acotado de veces; si se agotan los intentos, error controlado sin estado parcial (CA-O26).
- Interbloqueo o fallo de serialización durante la creación: se reintenta la operación completa, hasta cinco intentos en total; los errores de dominio no se reintentan; no puede quedar un pedido ni una reserva por duplicado (CA-O27).
- Cliente inactivo o cuenta deshabilitada: se trata como no autenticado por el mecanismo existente.

## Requirements *(mandatory)*

### Functional Requirements

**Creación**

- **FR-001**: El sistema MUST permitir a un cliente autenticado crear un pedido a partir de **su** carrito, con productos de uno o varios puestos (RF26, HU07).
- **FR-002**: El sistema MUST asociar el pedido al cliente que lo crea, tomado de la sesión y nunca del cuerpo de la solicitud (RF28, AC04).
- **FR-003**: El sistema MUST generar un código único por pedido con el formato `PED-` + 8 caracteres legibles obtenidos con aleatoriedad criptográficamente segura (RF27). La unicidad MUST garantizarse de forma estricta y las colisiones MUST resolverse con reintentos acotados, independientes de los reintentos de la operación (Q9).
- **FR-004**: El sistema MUST agrupar las líneas del pedido en un subpedido por puesto, de modo que cada línea pertenezca a exactamente un subpedido, el del puesto de su producto (RF29, DA07).
- **FR-005**: El sistema MUST calcular el subtotal de cada subpedido y el total general con importes exactos en soles (céntimos enteros, sin coma flotante), y el total MUST ser la suma de los subtotales (RF32 en su parte de presentación, constitución IV y VIII).
- **FR-006**: El sistema MUST reverificar la disponibilidad de todos los productos **al crear** el pedido y reservar el stock de todo el pedido mediante las reservas atómicas condicionales de Inventario, de forma todo-o-nada (RF25, RF15, ADR-003 §6.2–6.3, DE-1).
- **FR-007**: Si algún producto no tiene stock suficiente, el sistema MUST rechazar la creación completa con una respuesta controlada que identifique el producto, sin dejar pedido, subpedidos ni reservas parciales (EQ-02, AC08).
- **FR-008**: El sistema MUST rechazar la creación si el carrito está vacío o contiene líneas no vigentes (producto no disponible o cantidad superior al stock), sin crear nada (RF25).
- **FR-009**: El sistema MUST conservar, para cada línea del pedido, el nombre del producto, la unidad de venta, la cantidad y el **precio unitario vigente al momento de crear el pedido**, de modo que cambios posteriores del catálogo no alteren el pedido (importes históricos).
- **FR-010**: El sistema MUST confirmar o revertir **como una sola operación atómica** el pedido, sus subpedidos, sus líneas, el historial inicial, las reservas de inventario y el vaciado del carrito. Ante errores transitorios (interbloqueo, fallo de serialización) MUST reintentar la operación completa hasta cinco intentos en total; los errores de dominio (stock, carrito vacío) y de integridad MUST NOT reintentarse (AC08, EQ-02, Q5).
- **FR-011**: Cada subpedido MUST nacer en el estado `ESPERANDO_PAGO` de la enumeración aprobada `EstadoPedidoPuesto` (C4 N4 §3).

**Idempotencia y concurrencia**

- **FR-012**: La creación MUST exigir una clave de operación aportada por el cliente y MUST ser idempotente por `(cliente, clave)`: una creación nueva responde 201 y repetirla devuelve el mismo pedido (200) sin crear otro ni reservar de nuevo (ADR-003 §7; C4 N4 §4; Q6). La clave de un cliente MUST NOT dar acceso a pedidos de otro y una compra nueva MUST usar una clave nueva.
- **FR-013**: Solicitudes simultáneas con la misma clave MUST producir un único pedido; las demás devuelven ese mismo resultado sin reservar de nuevo.
- **FR-014**: Repetir la clave MUST devolver el pedido existente aunque el carrito esté vacío o distinto, y aunque la configuración de reserva no esté disponible (no se reserva de nuevo; DI-2): el sistema NO compara el contenido de los reintentos (la solicitud solo expresa la clave). Cada pedido MUST conservar la identidad y la huella del carrito realmente procesado en su primera ejecución exitosa, solo para trazabilidad (DE-5). La solicitud MUST NOT incluir `carritoId`.
- **FR-015**: Dos clientes que compiten por el mismo stock MUST obtener resultados consistentes: nunca se reserva más que el disponible (AC07, DA02).

**Consulta e historial**

- **FR-016**: El sistema MUST permitir al cliente consultar el estado de sus pedidos: código, fecha, estado de cada subpedido, líneas, subtotales y total (RF30, HU09). La respuesta MUST incluir el estado general derivado: el estado común de los subpedidos si coinciden y `MIXTO` si difieren; `MIXTO` es solo una representación de consulta y MUST NOT persistirse ni añadirse a los estados de subpedido (Q3).
- **FR-017**: La consulta y la respuesta de creación MUST mostrar el subtotal de cada puesto y el importe total antes del pago (RF32, parte de presentación) y MUST NOT incluir enlace de pago ni datos de Mercado Pago (DE-2).
- **FR-018**: El sistema MUST registrar un historial inmutable de cambios de estado por subpedido: estado anterior (vacío en el inicial), estado nuevo, fecha y actor u origen (RF31, AC06).
- **FR-019**: Los cambios de estado MUST respetar las transiciones permitidas del diagrama aprobado (C4 N4 §3); cualquier otra transición MUST rechazarse (DA09).

**Permisos y errores**

- **FR-020**: Solo el rol CLIENTE MUST poder crear pedidos; cada cliente MUST ver únicamente sus pedidos; un pedido ajeno se trata como inexistente (AC04, AC12).
- **FR-021**: Las rutas MUST ser privadas; sin sesión 401, rol no permitido 403, entrada inválida 400, recurso inexistente o ajeno 404, falta de stock o carrito vacío o con líneas no vigentes 409, configuración de reserva no disponible o reintentos agotados 503 (constitución V).
- **FR-022**: Los errores técnicos MUST traducirse a respuestas controladas sin filtrar detalles internos (DA11, constitución VIII).

**Límites explícitos de esta fase**

- **FR-023**: Esta fase MUST NOT registrar pagos, crear cobros, procesar Webhooks ni calcular o distribuir dinero (constitución VI, DEC-01/DEC-02).
- **FR-024**: Esta fase MUST NOT modificar los requisitos, ADR ni diagramas C4 aprobados ni el comportamiento ya implementado de Catálogo, Productos o Mercado Pago.
- **FR-025**: Esta fase MUST NOT exponer ninguna operación de cancelación del pedido; `CANCELADO` existe en la enumeración pero no es alcanzable (Q7).
- **FR-026**: Esta fase MUST NOT ejecutar la expiración de reservas ni de pedidos sin pago: RF54 la asigna a Pagos (C4 N3). **Dependencia explícita**: hasta que exista Pagos (S-08) nadie libera las reservas vencidas. Cada reserva se crea con un vencimiento futuro que ese proceso usará (Q2).
- **FR-027**: El pedido MUST construirse a partir del contenido del carrito **leído con bloqueo dentro de la operación atómica** (nunca de una lectura previa), y el carrito MUST vaciarse únicamente cuando el pedido y las reservas queden confirmados en esa misma operación; ante un fallo, el carrito MUST conservar todas sus líneas (Q4).
- **FR-029**: Dos solicitudes de creación del mismo cliente MUST procesarse de forma serializada, también cuando el cliente no tiene carrito o este está vacío; como máximo una de ellas convierte un mismo carrito (Q4, CA-O28).
- **FR-028**: La duración de la reserva MUST obtenerse de una configuración externa y reemplazable por Configuración operativa (S-04), expresada en minutos como entero positivo con un límite técnico documentado; MUST NOT fijarse en el dominio ni tener un valor predeterminado; si falta o es inválida, la creación de un pedido nuevo MUST rechazarse como servicio no disponible sin crear nada (Q2); la repetición de una clave ya confirmada no la consulta (DI-2).

### Key Entities *(include if feature involves data)*

- **Pedido**: compra de un cliente con código único, fecha, clave de operación, importe total y, solo para trazabilidad, la identidad y la huella del carrito procesado. Contiene uno o más subpedidos (RF26–RF28).
- **Subpedido (parte del pedido de un puesto)**: agrupación de líneas de un solo puesto con su subtotal y su estado propio (`ESPERANDO_PAGO` al crear). Es la unidad sobre la que más adelante se paga, prepara y entrega (RF29, DA07, DA09).
- **Línea del pedido**: producto, nombre, unidad, cantidad, precio unitario histórico y subtotal. Inmutable tras la creación.
- **Historial de estados**: registro inmutable de cada transición de un subpedido (anterior, nuevo, fecha, actor/origen) (RF31).
- **Reserva de inventario** *(propiedad de Inventario)*: reserva atómica por producto asociada al pedido mediante su clave de operación; Pedidos no la modifica por otra vía que la API pública de Inventario.
- **Carrito** *(propiedad de Carrito)*: origen de las líneas; Pedidos solo lo lee y, y lo vacía, al confirmarse el pedido, por la API pública de Carrito (Q4).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: En el 100 % de las pruebas de fallo forzado (falta de stock en uno de varios productos de distintos puestos y error técnico a mitad de la operación) quedan **0** pedidos, **0** subpedidos y **0** reservas nuevas (EQ-02; se compara el estado antes y después de cada fallo).
- **SC-002**: Con 20 solicitudes simultáneas y la misma clave de operación existe exactamente **1** pedido y **1** conjunto de reservas, y las 20 respuestas muestran el mismo código.
- **SC-003**: Con 2 clientes sobre el último stock de un producto (repetido 100 veces) exactamente **1** obtiene el pedido y **0** reservas superan el stock físico.
- **SC-004**: Para un pedido de 3 puestos, el total mostrado es igual a la suma de los subtotales por puesto y esta a la suma de las líneas, con importes exactos, en el 100 % de los casos de prueba (incluidos importes que fallarían con coma flotante, como 0.10 × 3 y 19.99 × 3).
- **SC-005**: Tras cambiar el precio de un producto, el 100 % de las consultas de pedidos anteriores devuelve los importes originales.
- **SC-006**: En 1 000 creaciones de prueba no se repite ningún código de pedido.
- **SC-007**: El 100 % de los intentos de leer pedidos ajenos (otro cliente, otros roles, sin sesión) recibe 404, 403 o 401 y ningún dato del pedido.
- **SC-008**: El historial de cada pedido nuevo contiene un registro inicial por subpedido y ninguna transición no permitida altera un estado en las pruebas de la máquina de estados (100 % de transiciones inválidas rechazadas).
- **SC-009**: Con ediciones del carrito concurrentes a la creación del pedido (100 repeticiones), 0 líneas se pierden o se duplican y 0 carritos quedan vaciados sin pedido.
- **SC-010**: Con interbloqueos forzados durante la creación, 0 pedidos duplicados y 0 reservas duplicadas; el número de reintentos está acotado.
- **SC-011**: Con 2 solicitudes simultáneas del mismo cliente y claves distintas sobre un mismo carrito (100 repeticiones), exactamente 1 pedido y 1 conjunto de reservas; la otra recibe «carrito vacío».

## Matriz RF/HU → criterios de aceptación → prueba

| HU · RF | Criterio de aceptación | Escenarios | Prueba |
|---|---|---|---|
| HU07 · RF26 | **CA-O1**: un pedido con productos de 1 a N puestos se registra completo | US1-1 | Unitaria (dominio); HTTP; persistencia |
| HU07 · RF27 | **CA-O2**: cada pedido tiene un código único | US1-1; SC-006 | Unitaria; persistencia (restricción de unicidad y 1 000 generaciones) |
| HU07 · RF29 | **CA-O3**: líneas agrupadas en un subpedido por puesto | US1-1 | Unitaria; HTTP; persistencia (clave del puesto del producto) |
| RF32 (presentación) · RF22–RF23 | **CA-O5**: subtotal por puesto y total exactos; total = suma de subtotales | US1-1; SC-004 | Unitaria (importes); HTTP |
| HU07 · RF28 | **CA-O21**: el pedido pertenece al cliente de la sesión, no al indicado en el cuerpo | FR-002 | HTTP; persistencia |
| HU07 · RF25 · RF15 | **CA-O6**: la creación reserva exactamente lo pedido y no toca el stock físico | US1-2 | HTTP (con Inventario); persistencia |
| HU07 · RF25 · EQ-02 | **CA-O7**: falta de stock en un producto rechaza todo; sin reservas colgadas | US1-3; SC-001 | Unitaria (fallo en puerto); persistencia con fallo forzado |
| HU07 · RF25 | **CA-O8**: carrito vacío o con líneas no vigentes se rechaza | US1-4 | Unitaria; HTTP |
| AC08 · EQ-02 | **CA-O9**: un error a mitad de la operación no deja estado parcial | US1-5; SC-001 | Persistencia (fallo forzado) |
| — · importes históricos | **CA-O4**: los importes no cambian si cambia el catálogo | US3-2; SC-005 | HTTP; persistencia |
| ADR-003 §7 | **CA-O10**: repetir la misma clave devuelve el mismo pedido sin reservar de nuevo | US2-1 | Unitaria; HTTP; persistencia |
| ADR-003 §7 · AC07 | **CA-O11**: solicitudes simultáneas con la misma clave crean un solo pedido | US2-2; SC-002 | Persistencia (concurrencia) |
| ADR-003 §7 | **CA-O12**: repetir la clave devuelve el pedido original sin reservar de nuevo, aunque el carrito esté vacío o distinto (no se compara contenido) | US2-3 | Unitaria; HTTP; persistencia |
| ADR-003 §7 | **CA-O13**: la clave es obligatoria y válida | US2-4 | Unitaria; HTTP |
| AC07 · DA02 | **CA-O20**: dos clientes por el último stock: solo uno obtiene pedido | edge; SC-003 | Persistencia (concurrencia) |
| HU09 · RF30 · RF32 | **CA-O14**: el cliente consulta código, estados, líneas, subtotales y total | US3-1 | HTTP; persistencia |
| AC12 | **CA-O15**: un pedido ajeno es inexistente para otro cliente | US3-3; SC-007 | HTTP; persistencia |
| AC04 | **CA-O16**: 401 sin sesión, 403 con rol no permitido | US3-4; SC-007 | HTTP (incluida la matriz de autorización rol × ruta) |
| HU09 · RF31 | **CA-O17**: el historial inicial existe por subpedido | US4-1; SC-008 | Unitaria; HTTP; persistencia |
| RF31 · AC06 | **CA-O18**: el historial es cronológico e inmutable | US4-2 | Unitaria; persistencia (sin actualización ni borrado) |
| DA09 · C4 N4 §3 | **CA-O19**: solo se admiten las transiciones del diagrama aprobado | US4-3; SC-008 | Unitaria (máquina de estados) |
| Q4 · AC08 | **CA-O23**: el pedido refleja el carrito bloqueado durante la operación; cada línea queda en el pedido o en el carrito, nunca perdida ni duplicada; el vaciado solo ocurre con pedido y reservas confirmados | US1-6; US1-7; SC-009 | Unitaria; persistencia (concurrencia sobre el carrito) |
| Q2 · RF45 | **CA-O24**: sin configuración válida de reserva no se crea nada (503) en una creación nueva; con ella, el vencimiento es futuro; la repetición de una clave confirmada no la requiere (DI-2) | US1-8 | Unitaria; HTTP |
| Q3 · RF30 | **CA-O25**: estado general = estado común o `MIXTO`, sin persistirse | US3-5 | Unitaria (dominio); HTTP |
| Q9 · RF27 | **CA-O26**: el código es aleatorio y legible; la colisión se reintenta de forma acotada | edge; SC-006 | Unitaria; persistencia (colisión forzada) |
| Q5 · ADR-003 | **CA-O27**: el reintento por interbloqueo cubre toda la operación sin duplicados | edge; SC-010 | Persistencia (interbloqueo forzado) |
| Q4 · FR-029 | **CA-O28**: dos claves distintas sobre el mismo carrito: solo una lo convierte; la otra recibe «carrito vacío»; también sin carrito | US1-9; SC-011 | Persistencia (concurrencia por cliente) |
| Constitución IX | **CA-O22**: compilación, lint, arquitectura y regresión sin fallos | — | Compilación/lint; `npm run arquitectura` |

## Decisiones de la sesión de clarificación

| Id | Decisión (en términos de negocio) | Respaldo | Estado |
|---|---|---|---|
| Q1 | Reserva al crear el pedido | ADR-003 §6.2; C4 N4 | CERRADA (documentación) |
| Q2 | Duración de reserva en minutos (entero positivo con límite técnico) desde configuración externa reemplazable, sin valor asumido; expiración dependiente de Pagos | Equipo 2026-11-06 (dos rondas); RF45, RF54; constitución VII | CERRADA (equipo) |
| Q3 | Estado general derivado (común o `MIXTO`), no persistido | Equipo 2026-11-06 | CERRADA (equipo) |
| Q4 | Vaciado del carrito solo con pedido y reservas confirmados en la misma operación atómica; sin pérdida de líneas nuevas | Equipo 2026-11-06 | CERRADA (equipo) |
| Q5 | Operación atómica única entre Carrito, Pedidos e Inventario; reintento de la operación completa, hasta 5 intentos, solo ante errores transitorios | ADR-003 §6.2; C4 N3/N4; equipo 2026-11-06 (dos rondas) | CERRADA (documentación y equipo) |
| Q6 | Clave `(cliente, clave)`; sin `carritoId`; repetición devuelve el pedido existente aunque el carrito esté vacío o distinto; **sin comparar contenido**; compra nueva = clave nueva | ADR-003 §7; C4 N4; equipo 2026-11-06 (DE-5, segunda ronda) | CERRADA (equipo) |
| Q7 | Sin cancelación en esta fase | C4 N4 §3; RF40 | CERRADA (documentación) |
| Q8 | Importes vigentes al crear; rechazo completo si algo no se puede comprar | C4 N4; RF25; EQ-02 | CERRADA (documentación) |
| Q9 | `PED-` + 8 caracteres legibles con aleatoriedad criptográficamente segura; unicidad estricta; reintentos acotados por colisión | Equipo 2026-11-06 (dos rondas); RF27 | CERRADA (equipo) |
| Q10 | Solo el cliente dueño consulta | HU09; C4 N3 | CERRADA (documentación) |
| Q11 | Sin pago ni auditoría salvo el historial | C4 N4; constitución VI y VIII | CERRADA (documentación) |
| DI-2 | La repetición de una clave ya confirmada se resuelve **antes** de consultar la configuración de reserva: devuelve el mismo pedido aunque la configuración falte; la configuración solo se exige para creaciones nuevas | Equipo (decisión de implementación aprobada tras T010) | CERRADA (equipo) |

El diseño técnico (propagación de la transacción, restricciones de base de datos, contratos, riesgos y pruebas) se desarrolla en `plan.md`, `research.md`, `data-model.md` y `contracts/`; no forma parte de esta especificación.

## Assumptions

- **Reutilización**: se aprovechan sin cambiar su comportamiento Catálogo, Productos, Carrito e Inventario; Pedidos usa solo sus APIs públicas (`index.ts`) y puertos (constitución I y II). Hoy Inventario y Catálogo tienen `index.ts`; **Carrito no tiene contrato público ni exporta casos de uso**, por lo que S-07 requiere añadir uno (cambio aditivo en `cart`, descrito en `plan.md`).
- **Nombre del módulo**: en el código es `orders`; los diagramas dicen `pedidos` (equivalencia pendiente de DEC-06). Se conserva el nombre del código.
- **Moneda y exactitud**: soles (PEN), céntimos enteros; mismo tratamiento que el carrito (`specs/002-carrito` R6).
- **Cantidades**: enteros de 1 a 10 000 por producto y hasta 50 productos distintos por pedido, como en el carrito y en una reserva de Inventario.
- **Pruebas de base de datos** contra el PostgreSQL local de Docker (`npm run test:db`), con concurrencia y fallo forzado (EQ-02, EQ-03); datos etiquetados que se eliminan al terminar (constitución IV y IX).
- **Rendimiento**: AC01 no fija un umbral numérico para pedidos (solo para catálogo); esta especificación no inventa uno.
- **Fuera de alcance de esta fase**: pago y Checkout (RF32 salvo presentación, RF33–RF35, RF47–RF55), preparación, retiro y variaciones (RF36–RF39), consulta por comerciante, trabajador o administrador (RF46, HU16, HU17, HU23), cancelaciones y reembolsos (RF40), expiración de reservas y de pedidos sin pago (RF54, módulo Pagos), notificaciones (RF41), auditoría (RF42), configuración de tiempos (RF45) y pantallas del frontend.
- **Equivalencias de estados**: los estados de los subpedidos son los de `EstadoPedidoPuesto` en C4 N4 (`ESPERANDO_PAGO`, `PAGO_APROBADO`, `EN_PREPARACION`, `LISTO_PARA_RETIRO`, `ENTREGADO`, `EXPIRADO`, `CANCELADO`); en esta fase solo `ESPERANDO_PAGO` es alcanzable al crear y el resto se modela como máquina de estados con sus transiciones aprobadas, sin endpoints que las disparen (Q2, Q3 y Q7).
- **Dependencias abiertas hacia otros módulos**: Configuración operativa (S-04) para sustituir la configuración externa de la duración de reserva, y Pagos (S-08) para el pago pendiente, el cobro, la expiración y la aprobación del pago. Ninguna se implementa aquí.
- **Limitación documentada de la idempotencia**: como la solicitud solo expresa la clave, un cliente que reutilice una clave para una compra nueva recibirá el pedido anterior. La interfaz debe generar una clave nueva por cada intento de compra (ver `contracts/api-pedidos.md`).
- **Triggers diferidos de totales**: no se implementan inicialmente; la integridad de importes se sostiene con las restricciones de la tabla, las invariantes de dominio y pruebas de integridad.
