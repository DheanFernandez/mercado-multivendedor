# Nivel 4 · Diagrama de Código

> **Proyecto:** Plataforma Integral Multivendedor · **Módulos detallados:** Pedidos e Inventario
> **Modelo:** C4 · Nivel 4 de 4 · **Notación:** UML · **Versión:** 1.0

---

## 1. Objetivo

Mostrar **cómo está organizado el código** de un componente del nivel 3: sus clases, interfaces y la forma en que colaboran. Se detalla el flujo **Crear pedido multivendedor**, que involucra a los módulos **Pedidos**, **Inventario** y **Pagos** y responde a los drivers DA02 (consistencia del inventario) y DA07 (pedidos multivendedor).

| Aspecto | Descripción |
|---|---|
| Pregunta que responde | ¿Qué clases existen dentro de un módulo y cómo se relacionan? |
| Audiencia | Desarrolladores |
| Notación | UML (diagrama de clases y diagrama de secuencia). El modelo C4 recomienda UML para este nivel |
| Por qué estos módulos | El nivel 4 es opcional en C4 y se dibuja solo para los componentes más críticos. Pedidos e Inventario concentran la reserva concurrente de stock ([ADR-003](../01-analisis-de-sistema/decisiones/ADR-003-control-concurrencia.md)) |
| Nivel anterior | [Nivel 3 · Diagrama de componentes](Nivel3-Diagrama-de-Componentes.md) |

> El flujo de **validación del pago** del módulo Pagos se detalla en el [diseño interno de módulos](../03-diseño-de-software/diseño-interno/diseño-interno-de-modulos.md).

---

## 2. Diagrama de clases

```mermaid
classDiagram
    direction LR
    class PedidosController {
        -crearPedido: CrearPedidoUseCase
        +crear(usuario, body)
    }
    class CrearPedidoUseCase {
        -pedidos: PedidoRepository
        -carrito: CarritoPort
        -inventario: ReservaInventarioPort
        -pagos: PagosPort
        -uow: UnidadDeTrabajo
        +ejecutar(cmd: CrearPedidoCommand)
    }
    class CrearPedidoCommand {
        +clienteId: string
        +carritoId: string
        +claveIdempotencia: string
    }
    class Pedido {
        -id: string
        -codigo: string
        -clienteId: string
        -grupos: PedidoPuesto[]
        +crear(clienteId, items) Pedido
        +total() Monto
    }
    class PedidoPuesto {
        -puestoId: string
        -items: ItemPedido[]
        -estado: EstadoPedidoPuesto
        +subtotal() Monto
        +habilitarPreparacion()
    }
    class ItemPedido {
        +productoId: string
        +cantidad: number
        +precioUnitario: Monto
        +subtotal() Monto
    }
    class EstadoPedidoPuesto {
        <<enumeration>>
        ESPERANDO_PAGO
        PAGO_VALIDADO
        EN_PREPARACION
        LISTO_PARA_RETIRO
        ENTREGADO
        CANCELADO
    }
    class PedidoRepository {
        <<interface>>
        +guardar(pedido)
        +buscarPorClaveIdempotencia(clave) Pedido
    }
    class ReservaInventarioPort {
        <<interface>>
        +reservar(puestoId, productoId, cantidad) bool
    }
    class PagosPort {
        <<interface>>
        +crearPagoPorPuesto(pedidoId, puestoId, monto)
    }
    class UnidadDeTrabajo {
        <<interface>>
        +ejecutarEnTransaccion(trabajo)
    }
    class PostgresPedidoRepository
    class InventarioAdapter
    class PostgresUnidadDeTrabajo
    class ReservarInventarioUseCase {
        +ejecutar(puestoId, productoId, cantidad) bool
    }
    class InventarioRepository {
        <<interface>>
        +reservarSiDisponible(puestoId, productoId, cantidad) bool
    }
    class PostgresInventarioRepository

    PedidosController ..> CrearPedidoCommand : crea
    PedidosController --> CrearPedidoUseCase
    CrearPedidoUseCase --> PedidoRepository
    CrearPedidoUseCase --> ReservaInventarioPort
    CrearPedidoUseCase --> PagosPort
    CrearPedidoUseCase --> UnidadDeTrabajo
    CrearPedidoUseCase ..> Pedido : crea
    Pedido *-- PedidoPuesto
    PedidoPuesto *-- ItemPedido
    PedidoPuesto --> EstadoPedidoPuesto
    PostgresPedidoRepository ..|> PedidoRepository
    PostgresUnidadDeTrabajo ..|> UnidadDeTrabajo
    InventarioAdapter ..|> ReservaInventarioPort
    InventarioAdapter --> ReservarInventarioUseCase : API pública de Inventario
    ReservarInventarioUseCase --> InventarioRepository
    PostgresInventarioRepository ..|> InventarioRepository
```

### 2.1 Capas de Clean Architecture

| Capa | Contiene | Regla |
|---|---|---|
| **Presentación** | Controladores REST de NestJS | Traduce HTTP a llamadas del caso de uso y viceversa |
| **Aplicación** | Casos de uso y puertos (interfaces) | Coordina los pasos del proceso; no conoce la tecnología |
| **Dominio** | Entidades, objetos de valor, enumeraciones | Contiene las reglas del negocio; no importa nada de las otras capas |
| **Infraestructura** | Repositorios y adaptadores | Implementa los puertos con PostgreSQL o con la API pública de otro módulo |

> **Regla de dependencia:** las flechas del código apuntan hacia el dominio. Las clases de infraestructura implementan los puertos (triángulo hueco); el dominio nunca conoce a la infraestructura ([ADR-002](../01-analisis-de-sistema/decisiones/ADR-002-clean-architecture.md)).

### 2.2 Clases del módulo Pedidos

| Clase | Tipo | Capa | Responsabilidad |
|---|---|---|---|
| `PedidosController` | Controlador | Presentación | Recibe `POST /api/v1/pedidos` y responde al cliente |
| `CrearPedidoUseCase` | Caso de uso | Aplicación | Valida el carrito, reserva el stock, registra el pedido y crea los pagos por puesto en una transacción |
| `CrearPedidoCommand` | DTO | Aplicación | Datos de entrada, incluida la clave de idempotencia para reintentos |
| `Pedido` | Entidad | Dominio | Pedido principal: código único, cliente, agrupaciones por puesto y total general (RF26–RF29) |
| `PedidoPuesto` | Entidad | Dominio | Parte del pedido de un puesto: ítems, subtotal y estado propio (DA07, DA09) |
| `ItemPedido` | Objeto de valor | Dominio | Producto, cantidad, precio unitario y subtotal |
| `EstadoPedidoPuesto` | Enumeración | Dominio | Estados de la parte del pedido de cada puesto |
| `PedidoRepository` | Interfaz | Aplicación | Contrato para guardar pedidos y buscar por clave de idempotencia |
| `ReservaInventarioPort` | Interfaz | Aplicación | Contrato para reservar stock en el módulo Inventario |
| `PagosPort` | Interfaz | Aplicación | Contrato para crear el pago de cada puesto en el módulo Pagos |
| `UnidadDeTrabajo` | Interfaz | Aplicación | Contrato para ejecutar varias operaciones en una sola transacción |
| `PostgresPedidoRepository` | Repositorio | Infraestructura | Implementa `PedidoRepository` con PostgreSQL |
| `PostgresUnidadDeTrabajo` | Adaptador | Infraestructura | Implementa `UnidadDeTrabajo` con transacciones de PostgreSQL |
| `InventarioAdapter` | Adaptador | Infraestructura | Implementa `ReservaInventarioPort` usando la API pública del módulo Inventario |

> **TODO:** los estados de `EstadoPedidoPuesto` son una propuesta derivada del flujo de [ADR-004](../01-analisis-de-sistema/decisiones/ADR-004-pagos-qr.md); deben confirmarse junto con el estado general del pedido.

### 2.3 Clases del módulo Inventario

| Clase | Tipo | Capa | Responsabilidad |
|---|---|---|---|
| `ReservarInventarioUseCase` | Caso de uso (API pública) | Aplicación | Único punto por el que otros módulos reservan stock |
| `InventarioRepository` | Interfaz | Aplicación | Contrato para reservar solo si hay stock disponible |
| `PostgresInventarioRepository` | Repositorio | Infraestructura | Ejecuta el `UPDATE` condicional sobre stock físico y reservado ([ADR-003](../01-analisis-de-sistema/decisiones/ADR-003-control-concurrencia.md)) |

### 2.4 Notación UML utilizada

| Símbolo | Significado | Ejemplo |
|---|---|---|
| Línea continua con flecha abierta | Asociación: la clase tiene una referencia a la otra | `CrearPedidoUseCase` → `PedidoRepository` |
| Línea discontinua con flecha abierta | Dependencia: la usa o la crea | `CrearPedidoUseCase` «crea» `Pedido` |
| Línea discontinua con triángulo hueco | Realización: implementa una interfaz | `PostgresPedidoRepository` ▷ `PedidoRepository` |
| Rombo relleno | Composición: la parte no existe sin el todo | `Pedido` ◆ `PedidoPuesto` ◆ `ItemPedido` |
| «interface» | Interfaz | `ReservaInventarioPort` |
| `-` y `+` | Atributo o método privado y público | `- estado`, `+ total()` |

---

## 3. Diagrama de secuencia: crear pedido multivendedor

```mermaid
sequenceDiagram
    actor CL as Cliente (Web/PWA)
    participant CTRL as PedidosController
    participant UC as CrearPedidoUseCase
    participant REPO as PedidoRepository
    participant UOW as UnidadDeTrabajo
    participant INV as ReservaInventarioPort
    participant PED as Pedido
    participant PAG as PagosPort

    CL->>CTRL: POST /api/v1/pedidos (carritoId, claveIdempotencia)
    CTRL->>UC: ejecutar(cmd)
    UC->>REPO: buscarPorClaveIdempotencia(clave)
    alt Reintento de un pedido ya creado
        REPO-->>UC: pedido existente
        UC-->>CTRL: pedido existente
        CTRL-->>CL: 200 OK con el mismo pedido
    else Pedido nuevo
        UC->>PED: crear(clienteId, items del carrito)
        UC->>UOW: ejecutarEnTransaccion(...)
        loop Por cada producto de cada puesto
            UOW->>INV: reservar(puestoId, productoId, cantidad)
        end
        alt Algún producto sin stock
            INV-->>UOW: false
            UOW-->>UC: se revierte toda la transacción
            CTRL-->>CL: 409 Conflict con el producto sin stock
        else Todas las reservas confirmadas
            UOW->>REPO: guardar(pedido)
            loop Por cada puesto del pedido
                UOW->>PAG: crearPagoPorPuesto(pedidoId, puestoId, subtotal)
            end
            UOW-->>UC: transacción confirmada
            CTRL-->>CL: 201 Created con el código del pedido y los pagos por puesto
        end
    end
```

| Paso | Origen → destino | Acción |
|---|---|---|
| 1 | Web/PWA → `PedidosController` | Envía `POST /api/v1/pedidos` con el carrito y una clave de idempotencia |
| 2 | `PedidosController` → `CrearPedidoUseCase` | Ejecuta el caso de uso |
| 3 | `CrearPedidoUseCase` → `PedidoRepository` | Si la clave ya existe, devuelve el pedido anterior sin crear otro (ADR-003, sección 7) |
| 4 | `CrearPedidoUseCase` → `Pedido` | Crea el pedido agrupando los productos por puesto y calcula subtotales y total |
| 5 | `CrearPedidoUseCase` → `UnidadDeTrabajo` | Inicia una transacción corta en PostgreSQL |
| 6 | `UnidadDeTrabajo` → `ReservaInventarioPort` | Reserva cada producto con actualización condicional; si no hay stock, la reserva falla |
| 7 | Alternativa | Si una reserva falla, se revierte todo: no queda pedido parcial ni stock reservado (AC08) |
| 8 | `UnidadDeTrabajo` → `PedidoRepository` | Guarda el pedido y sus agrupaciones por puesto |
| 9 | `UnidadDeTrabajo` → `PagosPort` | Crea un pago en estado PENDIENTE por cada puesto, con el importe esperado (RN02) |
| 10 | `PedidosController` → Web/PWA | Responde `201 Created`; la Web/PWA muestra el importe y el QR de cada puesto |

---

## 4. Patrones y principios que se ven en este nivel

| Elemento del diagrama | Patrón o principio |
|---|---|
| `PedidoRepository` y `PostgresPedidoRepository` | Patrón **Repository** |
| `UnidadDeTrabajo` y `PostgresUnidadDeTrabajo` | Patrón **Unit of Work** |
| `InventarioAdapter` | Patrón **Adapter** hacia la API pública de otro módulo |
| El caso de uso recibe interfaces, no clases concretas | Principio de **inversión de dependencias** (SOLID) |
| Una clase por responsabilidad (controlador, caso de uso, entidad, repositorio) | Principio de **responsabilidad única** (SOLID) |
| Pedidos usa a Inventario solo mediante `ReservarInventarioUseCase` | Regla del **monolito modular**: comunicación por la API pública del módulo |
| `claveIdempotencia` en el comando | **Idempotencia** frente a reintentos ([ADR-003](../01-analisis-de-sistema/decisiones/ADR-003-control-concurrencia.md)) |

> Detalle completo en [patrones de diseño](../03-diseño-de-software/diseño-interno/patrones-de-diseño.md) y [principios de diseño](../03-diseño-de-software/diseño-interno/principios-de-diseño.md).
