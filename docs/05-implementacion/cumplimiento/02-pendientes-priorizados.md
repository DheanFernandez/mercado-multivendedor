# Pendientes priorizados y lo indispensable para terminar

> **Línea base congelada.** Este documento no reescribe requisitos: ordena lo que falta para cumplirlos. Estado de partida: [matriz de cumplimiento](01-matriz-de-cumplimiento.md) (41 de 55 RF pendientes, 8 EQ sin medir).
> **Tamaños relativos:** S = pocas piezas, M = un módulo mediano, L = módulo grande con reglas críticas. No son estimaciones de calendario.

## 1. Criterios de orden

1. **Dependencias técnicas** de la línea base: C4 nivel 3 §4 (Carrito → Pedidos → Inventario/Pagos; Configuración antes de Inventario y Pedidos; Auditoría usada por Pedidos, Inventario y Pagos), ADR-003 y ADR-005.
2. **Capacidad de demostrar** un resultado funcional de punta a punta al terminar cada hito.
3. **Capacidad de habilitar mediciones** EQ cuanto antes (la de rendimiento del catálogo ya es posible).

## 2. Hitos demostrables

| Hito | Contenido | Demostración al terminar | RF/HU que cierra | EQ y AC que habilita | Tamaño |
|---|---|---|---|---|---|
| **H0** Cierre de lo construido | Administración completa, Storage real verificado, catálogo con filtro por puesto, seed de datos, entorno aislado de medición | El administrador da de alta comerciantes y puestos; el comerciante publica productos con imágenes reales; el cliente los encuentra | RF05–RF07, RF11, RF18; HU02, HU13, HU21, HU22 | **EQ-04 (AC01)**, matriz de autorización (AC04) | M |
| **H1** Fundaciones | Configuración operativa, Auditoría mínima, registros estructurados, CI | El administrador cambia el tiempo de reserva y consulta la auditoría | RF42, RF45; HU24, HU26 | AC06 (parcial) | M |
| **H2** Inventario | Stock físico, reservado y disponible; movimientos; reserva atómica | El comerciante carga stock y el catálogo muestra disponibilidad | RF12–RF15, RF19; HU03, HU14, HU15 | **EQ-03 (AC07)** | L |
| **H3** Carrito | Carrito multivendedor con subtotales por puesto | El cliente arma un carrito con 3 puestos y ve subtotales y total | RF20–RF24; HU04–HU06 | — | M |
| **H4** Pedidos y subpedidos | Pedido agrupado por puesto, reserva transaccional, estados, preparación, entrega | El cliente confirma el pedido; cada puesto prepara y entrega lo suyo (con pago simulado hasta H5) | RF25–RF31, RF36–RF39, RF46; HU07, HU09, HU10, HU16, HU18, HU19 | **EQ-02 (AC08)** | L |
| **H5** Pagos | Cobro único Sandbox, Webhook verificado, idempotencia, conciliación, expiración, reembolsos, comisión/neto, vinculación | El cliente paga una sola vez y el pedido pasa a preparación solo con el pago aprobado | RF32–RF35, RF47–RF55; HU08, HU17, HU27–HU29 | **EQ-01, EQ-07, EQ-08 (AC03, AC04, AC05, AC06)**, AC09 | L |
| **H6** Resto de módulos | Trabajadores de puesto, tiendas, notificaciones, incidencias, reportes | Flujo completo con notificaciones y panel de reportes | RF08, RF40, RF41, RF43, RF44; HU11, HU16, HU20, HU23, HU25 | EQ-06 (AC03, AC11) | L |
| **H7** Cierre | PWA mínima, despliegue público, EQ-05, paquete de evidencias | Sistema accesible por Internet con las evidencias de calidad | RC01, RC20 | **EQ-05 (AC02)**; revisión de todos los EQ | M |

## 3. Lista priorizada de funcionalidades pendientes

Orden pedido en el encargo; cada punto indica **qué falta para completarlo y probarlo**.

### 3.1 Administrador, comerciantes y puestos *(H0 — ya existe lo esencial)*

| Falta | RF/HU | Tamaño |
|---|---|---|
| Editar comerciante y puesto; suspender y reactivar comerciante; desactivar y reactivar puesto (el campo `estado` existe, las operaciones no) | RF06, RF07, HU22 | S |
| Desactivar y reactivar usuarios (control de quién accede) | RF01–RF05, HU21 | S |
| Cambiar el rol de un usuario desde la administración (hoy solo con un script) | RF05, HU21 | S |
| Paginación en servidor de las listas (hoy la interfaz carga 100 registros) | AC01 | S |
| Verificar con Supabase real: registro, confirmación, inicio de sesión, recuperación e invitación (requiere la clave de servicio) | RF01, RF02 | S (manual, con evidencia) |
| Pruebas de interfaz de los flujos de administración (Playwright) | RF04 | M |

### 3.2 Productos, categorías e imágenes *(H0)*

| Falta | RF/HU | Tamaño |
|---|---|---|
| Crear el bucket público y ejecutar `npm run storage:verificar` con la clave de servicio; guardar la evidencia | RF11, RC09 | S (manual) |
| Prueba de interfaz de alta de producto con imagen | HU12, HU13 | S |

### 3.3 Catálogo público *(H0 y H2)*

| Falta | RF/HU | Tamaño |
|---|---|---|
| Filtro por puesto en la interfaz | RF18 | S |
| Seed de datos representativos y medición **EQ-04** | AC01 | M |
| Mostrar disponibilidad en el detalle | RF19, HU03 | S (depende de H2) |

### 3.4 Inventario *(H2 — módulo vacío)*

Modelo por producto y puesto (stock físico, reservado, disponible); movimientos de ingreso, venta, devolución y ajuste; reserva atómica con `UPDATE` condicional en transacción corta; liberación idempotente; expiración de reservas con el tiempo de RF45; API y pantalla del comerciante; pruebas de concurrencia en base aislada (**EQ-03**). Cierra RF12–RF15 y RF25 (con Pedidos). Tamaño **L**.

### 3.5 Carrito multivendedor *(H3 — módulo vacío)*

Carrito del cliente con ítems de varios puestos, identificación del puesto, subtotales y total con importes exactos, modificación y eliminación, reverificación de disponibilidad; pantallas de carrito. Cierra RF20–RF24. Tamaño **M**.

### 3.6 Pedidos y subpedidos *(H4 — módulo vacío)*

Pedido con código único y cliente, **agrupación por puesto**, creación con idempotencia (`claveIdempotencia`, ADR-003 §7) y reserva dentro de una sola transacción, historial de estados, consulta del cliente, vista del comerciante por puesto (RF46), preparación, «listo para retiro», entrega y variaciones de peso o precio (con las tolerancias de RF45). Pantallas del cliente y del comerciante. Cierra RF25–RF31, RF36–RF39, RF46. Tamaño **L**.

### 3.7 Pagos *(H5 — módulo vacío)*

`PasarelaPagoPort` con adaptador de Checkout Sandbox; cobro por la suma de subtotales; Webhook con firma, consulta a la API y verificación de monto/referencia; idempotencia y registro de notificaciones; conciliación periódica; expiración ligada a la reserva (RF54); reembolsos totales y parciales; comisión e importe neto por puesto (RF53); vinculación de la cuenta del comerciante (RF52); evento `PagoAprobado` por Outbox hacia Pedidos; pantallas de pago del cliente y de cobros del comerciante. Cierra RF32–RF35 y RF47–RF55. Tamaño **L** y **bloqueado** por las decisiones del §5.

### 3.8 Demás módulos exigidos por la línea base *(H1, H6, H7)*

| Módulo | RF/HU | Contenido mínimo para cumplir | Tamaño |
|---|---|---|---|
| Configuración operativa | RF45, HU24 | Tiempos de reserva y de expiración; tolerancias de peso y precio | S |
| Auditoría | RF42, HU26 | Registro de operaciones críticas y consulta del administrador | M |
| Trabajadores de puesto | HU20, RF05 | Asignación a un puesto con permisos de preparar y entregar | M |
| Tiendas virtuales | RF08, HU11 | Página pública del puesto | S–M |
| Notificaciones | RF41 | Avisos de cambio de estado del pedido, aislados de la compra (DA11) | M |
| Incidencias | RF40, HU23, HU29 | Cancelaciones, devoluciones y reclamos con solicitud de reembolso | M |
| Reportes | RF43, RF44, RF46, HU16, HU23, HU25 | Consultas del administrador (pedidos, pagos, conciliación) y del comerciante; indicadores básicos | M |
| PWA | RC01 | Manifiesto y service worker mínimos | S |
| Despliegue público | RC20 | Frontend y backend accesibles por Internet; URL pública del Webhook | M |
| Integración continua | RC10; EQ-07 | GitHub Actions con compilación, lint y pruebas | S |

## 4. Lo indispensable para terminar el sistema

### 4.1 Ruta crítica funcional (sin esto no hay sistema)

`Inventario → Carrito → Pedidos → Pagos` más `Configuración operativa` y `Auditoría mínima`. De los 41 RF pendientes, 31 pertenecen a esta ruta (RF12–RF15, RF20–RF39, RF42, RF45, RF47–RF50 y RF54).

### 4.2 Soporte que los propios escenarios exigen

- **Registros de auditoría y de notificaciones** (EQ-01 y EQ-08 verifican «el registro de auditoría» y «los registros de notificaciones»).
- **Registros estructurados de errores** (AC06; EQ-06 y EQ-08 verifican que «el error queda registrado»).
- **Conciliación periódica** (RF50, EQ-08).

### 4.3 Infraestructura de medición (sin ella los EQ no se pueden demostrar)

| Necesidad | Estado |
|---|---|
| Docker Desktop **iniciado** (hoy la CLI existe pero el servicio no responde) | Acción manual |
| Instalar: Testcontainers, MSW, Pino, `dependency-cruiser`, Playwright, Faker, k6 (o su imagen), Lighthouse, Toxiproxy, OWASP ZAP | Pendiente |
| Entorno aislado (`ops/medicion/`) con la guarda que impide usar la base compartida | Pendiente |
| GitHub Actions | Pendiente |

### 4.4 Credenciales y cuentas externas

| Necesidad | Dónde se obtiene | Para qué |
|---|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` y bucket público `productos` | Supabase → API Keys y Storage | Verificar Storage real; invitar comerciantes |
| Aplicación de Mercado Pago (Sandbox): token de acceso, clave del Webhook, **usuario comprador y usuarios vendedores de prueba** | Panel de desarrolladores de Mercado Pago | Pagos, EQ-01, EQ-08 |
| URL pública HTTPS para el Webhook (despliegue o túnel) | Hosting o túnel | Recibir notificaciones reales del Sandbox |
| Cuenta de Sentry (opcional) | sentry.io | Solo si se quiere cumplir literalmente la herramienta de EQ-06/EQ-08; la alternativa son los registros de Pino |

### 4.5 Decisiones del equipo estrictamente necesarias

| Decisión | Mínimo necesario | Referencia |
|---|---|---|
| Distribución y vinculación de pagos | Elegir modalidad antes de especificar Pagos | DEC-01, DEC-02 |
| Trabajadores de puesto | Aprobar el modelo mínimo antes de Pedidos | DEC-09 |
| Auditoría | Confirmar que se hace antes de Inventario | DEC-05 |
| Tienda virtual | Confirmar «página pública del puesto» | DEC-10 |

### 4.6 Qué **no** es indispensable

Nuevos documentos de gobernanza; la refactorización de límites entre módulos, salvo la parte que exijan AC05/EQ-07; Sentry y UptimeRobot (la meta de disponibilidad no está definida); reportes avanzados más allá de RF43/RF44; la PWA completa más allá del manifiesto y el service worker.

## 5. Contradicciones que impiden desarrollar (con solución mínima)

Solo se reportan las que bloquean trabajo real. **No se modifica la línea base.**

| # | Contradicción concreta | Qué bloquea | Solución mínima propuesta |
|---|---|---|---|
| K-1 | ADR-005 elige el pago único con Checkout, pero RC14, RF52 y DA08 exigen que cada comerciante vincule su cuenta y que el cobro se asocie a ella (semántica de Split, que ADR-005 deja como «respaldo») | Especificar Pagos (RF47, RF52, RF53) | Implementar ADR-005 al pie de la letra (cobro único) y registrar subtotal, comisión y neto por puesto como asiento interno rotulado «simulado»; RF52 como indicador de vinculación. Requiere decisión del equipo (DEC-01/02); el borrador está en `docs/06-gobernanza-sdd/borradores/` |
| K-2 | EQ-07 pide una suite de contrato ejecutada con «ambos adaptadores» de respaldo (Split o cobro centralizado), que no se construirán | Medir EQ-07 | Ejecutar la suite con el adaptador de Checkout y el simulador local `PasarelaPagoLocalAdapter`, que el diseño interno ya prevé; dejar constancia de la interpretación en la evidencia |
| K-3 | EQ-05 nombra «Drizzle + Faker»; el proyecto usa Prisma | Seed de EQ-04/EQ-05 | Seed con Prisma y Faker; documentarlo en la evidencia |
| K-4 | EQ-02 y EQ-03 exigen PostgreSQL desechable (Testcontainers); Docker no está en ejecución | Pruebas de integridad y concurrencia | Iniciar Docker Desktop. Alternativa si no es posible: PostgreSQL local instalado en el equipo (nunca la base compartida) |
| K-5 | EQ-04 habla de «datos representativos» y EQ-05 deja «pendiente confirmar la cantidad» de comerciantes y puestos | Medir EQ-04/EQ-05 | Fijar los tamaños como parámetros de la prueba (50 comerciantes, 100 puestos, 5 000 productos) y registrarlos en la evidencia |
| K-6 | EQ-06 usa Sentry y UptimeRobot, y la meta de disponibilidad «está por definir» | EQ-06 | Medir con Pino y MSW/Toxiproxy el criterio «0 operaciones confirmadas perdidas»; UptimeRobot queda fuera hasta que exista una meta |
| K-7 | RC20 exige despliegue accesible por Internet y la documentación no define dónde; el Webhook necesita una URL pública | RC20; EQ-01 con firma real | Desplegar frontend y backend en un servicio gratuito, o usar un túnel durante las pruebas del Sandbox |
| K-8 | RF08 y HU11 hablan de «tiendas» sin definir su contenido | RF08 | Página pública del puesto (DEC-10) |
| K-9 | RF36 y RF39 exigen «trabajador de puesto autorizado» sin definir los permisos | RF36, RF39, HU20 | Asignación trabajador↔puesto con permisos «preparar» y «entregar» (DEC-09) |
| K-10 | La constitución exige ocho etapas; el flujo práctico indicado tiene siete (sin Aclarar ni Analizar) | Forma de trabajo | Conservar Aclarar y Analizar como pasos breves dentro de «Especificar» y «Generar tareas»; o enmendar la constitución |
