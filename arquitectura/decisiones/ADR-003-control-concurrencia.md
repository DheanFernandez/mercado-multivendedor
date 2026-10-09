
# ADR-003: Control de Concurrencia en Inventario y Repartidores

## 1. Información de la decisión

| Campo | Descripción |
|---|---|
| ID | ADR-003 |
| Título | Control de concurrencia en inventario y repartidores |
| Estado | Propuesta |
| Fecha | 08/10/2026 |
| Proyecto | Plataforma Integral Multivendedor para la Gestión Comercial y Operativa de un Mercado de Abastos |
| Drivers principales | DA02, DA03 |
| Drivers relacionados | DA01, DA08, DA09, DA11 |
| Atributos de calidad | AC07 - Concurrencia, AC08 - Integridad de la información, AC01 - Rendimiento |

## 2. Contexto

La plataforma permitirá que múltiples clientes realicen pedidos simultáneamente a diferentes puestos comerciales.

Cada puesto administrará su propio inventario y publicará productos disponibles en el marketplace.

Durante una operación de compra, dos o más clientes podrían intentar reservar cantidades del mismo producto cuando el stock es limitado.

Asimismo, diferentes clientes podrían intentar seleccionar simultáneamente a un mismo repartidor.

Si estas operaciones no cuentan con mecanismos de concurrencia, podrían producirse sobreventas, reservas incompatibles, duplicación de asignaciones e inconsistencias en los pedidos.

## 3. Problema arquitectónico

¿Cómo garantizar que las operaciones concurrentes de reserva de inventario y asignación de repartidores mantengan la consistencia de la información sin bloquear innecesariamente operaciones independientes?

## 4. Alternativas evaluadas

| Alternativa | Ventajas | Limitaciones |
|---|---|---|
| Validación únicamente en el frontend | Mejora la experiencia del usuario y permite mostrar advertencias tempranas. | No impide condiciones de carrera entre solicitudes simultáneas. |
| Bloqueos administrados únicamente en memoria del backend | Implementación inicialmente sencilla. | No garantiza coordinación cuando existen varias instancias del backend y puede perder el estado ante fallos. |
| Transacciones y control de concurrencia en PostgreSQL | Permite realizar validaciones y actualizaciones atómicas, manteniendo consistencia en la fuente principal de datos. | Requiere manejar conflictos, tiempos de espera, bloqueos y reintentos cuidadosamente. |
| Cola de procesamiento de reservas | Permite ordenar determinadas operaciones. | Introduce infraestructura adicional y no elimina la necesidad de garantizar consistencia en la base de datos. |

## 5. Decisión arquitectónica

Se propone utilizar PostgreSQL como mecanismo principal para garantizar la consistencia de las operaciones concurrentes.

Las operaciones críticas se ejecutarán mediante transacciones de base de datos y actualizaciones condicionales o bloqueos de filas cuando corresponda.

Las reglas generales serán:

1. No confirmar reservas de inventario superiores al stock disponible.
2. No permitir reservas incompatibles sobre un mismo repartidor.
3. Garantizar que la comprobación y actualización de disponibilidad se realicen de forma atómica.
4. Mantener transacciones cortas.
5. Registrar correctamente el resultado de cada operación.
6. Revertir las operaciones que fallen antes de su confirmación.
7. Controlar los reintentos para evitar operaciones duplicadas.

La implementación de estas operaciones se realizará mediante adaptadores de persistencia y mecanismos de coordinación transaccional definidos por la aplicación.

## 6. Control de concurrencia del inventario

### 6.1. Identificación del recurso

El inventario se administrará por producto y puesto comercial.

La disponibilidad de un producto deberá calcularse considerando su stock físico, reservado y disponible.

### 6.2. Proceso de reserva

Cuando el cliente confirme un pedido:

1. El backend recibirá la solicitud.
2. El caso de uso verificará la estructura y cantidades del pedido.
3. Se iniciará una transacción de base de datos.
4. Se comprobará la disponibilidad de los productos solicitados.
5. Se realizarán reservas de stock de manera atómica.
6. Se registrará el pedido y sus agrupaciones por puesto.
7. Se confirmará la transacción si todas las operaciones críticas fueron satisfactorias.
8. Ante un conflicto o error, se revertirán las modificaciones y se informará al cliente.

La reserva de productos pertenecientes a diferentes puestos deberá mantener un resultado consistente para el pedido completo.

### 6.3. Estrategia técnica

Para garantizar que no se reserve más stock del disponible, se podrán implementar operaciones SQL condicionales dentro de una transacción.

Por ejemplo:

```sql
UPDATE inventarios
SET stock_reservado = stock_reservado + :cantidad
WHERE producto_id = :producto_id
  AND puesto_id = :puesto_id
  AND stock_fisico - stock_reservado >= :cantidad
RETURNING producto_id, puesto_id, stock_reservado;
```

Esta sentencia es ilustrativa. Los nombres de tablas y columnas deberán adaptarse al modelo de datos definitivo.

Si la actualización no devuelve filas, la reserva no deberá considerarse confirmada.

### 6.4. Liberación y confirmación

Cuando un pedido sea cancelado antes de completar la compra, el sistema deberá liberar las cantidades reservadas mediante una operación consistente.

Cuando se registre la compra efectiva, el inventario deberá actualizar sus cantidades físicas y reservadas sin aplicar el descuento dos veces.

Las variaciones de peso o precio deberán gestionarse de acuerdo con las reglas del pedido y la disponibilidad correspondiente.

## 7. Control de concurrencia de repartidores

### 7.1. Identificación del recurso

Cada repartidor tendrá un estado de habilitación, disponibilidad y asignación.

Solo los repartidores verificados, habilitados y disponibles podrán recibir nuevas solicitudes compatibles con sus condiciones de operación.

### 7.2. Reserva temporal

Cuando un cliente seleccione un repartidor:

1. El backend verificará que el repartidor esté habilitado.
2. Se comprobará su disponibilidad.
3. Se intentará registrar una reserva temporal de forma atómica.
4. Se establecerá un tiempo de expiración.
5. Se notificará la solicitud al repartidor.
6. El repartidor podrá aceptarla o rechazarla.
7. Si se rechaza o expira, se liberará la reserva.

### 7.3. Estrategia técnica

Se utilizarán transacciones y actualizaciones condicionales en PostgreSQL.

La reserva solamente podrá confirmarse si el repartidor continúa disponible y no posee una asignación incompatible.

También podrán utilizarse restricciones de unicidad o mecanismos de bloqueo apropiados para proteger las invariantes del modelo de datos.

La expiración de una reserva deberá comprobarse en el backend, incluso si el procesamiento de tareas programadas se retrasa.

## 8. Idempotencia y reintentos

Las solicitudes de creación de pedidos, reserva de inventario y asignación de repartidores deberán protegerse frente a reintentos duplicados.

Para ello se utilizarán identificadores únicos de operación o mecanismos equivalentes.

Un reintento de una operación ya confirmada deberá devolver su resultado anterior cuando corresponda, sin generar una segunda reserva incompatible.

Los conflictos transaccionales deberán manejarse con respuestas controladas.

## 9. Relación con Clean Architecture

**Dominio**

Define las reglas sobre stock disponible, reservas y asignaciones permitidas.

**Aplicación**

Coordina casos de uso como ReservarInventario y SeleccionarRepartidor, incluyendo los límites de las operaciones transaccionales.

**Infraestructura**

Implementa los repositorios y operaciones transaccionales mediante PostgreSQL.

**Presentación**

Recibe las solicitudes y comunica los resultados al usuario.

Los casos de uso no deberán depender directamente de sentencias SQL ni de implementaciones concretas de persistencia.

## 10. Consecuencias

### Consecuencias positivas

- Prevención de sobreventas.
- Prevención de reservas incompatibles de repartidores.
- Mayor consistencia de pedidos e inventarios.
- Capacidad de coordinación entre varias instancias del backend mediante una base de datos compartida.
- Mayor confiabilidad de las operaciones críticas.

### Consecuencias negativas

- Las transacciones pueden generar contención sobre recursos muy solicitados.
- Será necesario gestionar bloqueos y conflictos.
- Algunas solicitudes podrán rechazarse si otro usuario reserva primero el recurso.
- Se requerirán pruebas específicas de concurrencia.

## 11. Pruebas propuestas

Se realizarán pruebas para comprobar:

1. Dos clientes intentando reservar el último stock disponible.
2. Múltiples clientes intentando reservar un mismo repartidor.
3. Cancelación de un pedido con stock previamente reservado.
4. Expiración de una reserva de repartidor.
5. Reintentos de creación de un mismo pedido.
6. Fallos durante transacciones de inventario.
7. Operaciones simultáneas sobre productos de diferentes puestos.

## 12. Resultado esperado

Las operaciones críticas de inventario y asignación de repartidores mantendrán consistencia incluso ante solicitudes simultáneas.

La arquitectura utilizará PostgreSQL como fuente principal de coordinación transaccional, manteniendo las reglas de negocio desacopladas de las implementaciones concretas.

## 13. Relación con otras decisiones

- ADR-001: Monolito modular.
- ADR-002: Clean Architecture.
- ADR-004: Gestión de pagos mediante QR.
