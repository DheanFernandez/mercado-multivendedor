# Contratos entre módulos y puertos internos

Regla (constitución I; C4 N3): un módulo usa a otro solo por su `index.ts`/`*.module.ts`; el consumidor define un **puerto** en `application/` y un **adaptador** en `infrastructure/` que llama a la API pública del proveedor. Dependencias previstas, sin ciclos: `orders → cart, inventory`; `cart → catalog` (ya existente).

## 1. API pública de Carrito (nueva: `cart/index.ts`)

```ts
export { ObtenerCarritoParaPedido, VaciarCarritoDelPedido } from './application/use-cases/pedido.use-cases.js';
export type { CarritoParaPedido, LineaParaPedido } from './application/use-cases/pedido.use-cases.js';

export interface LineaParaPedido {
  productoId: string;
  puesto: { id: string; codigo: string; nombre: string } | null;  // null: el producto ya no es comprable
  nombre: string | null;
  unidadVenta: string | null;
  presentacion: string | null;
  cantidad: number;
  precioUnitarioCentimos: number | null;                          // céntimos enteros; null si no es comprable
  comprable: boolean;
}
export interface CarritoParaPedido {
  carritoId: string | null;        // null si el cliente aún no tiene carrito; no se expone por HTTP
  lineas: LineaParaPedido[];       // orden estable por producto; [] si está vacío
}

ObtenerCarritoParaPedido.ejecutar(clienteId: string): Promise<CarritoParaPedido>
//   REQUIERE una unidad de trabajo vigente (falla de inmediato si no la hay).
//   Toma FOR UPDATE sobre la fila del carrito y sus ítems y lee los datos de Catálogo en lote por la conexión activa.
//   Es la lectura AUTORITATIVA: no existe lectura previa fuera de la transacción.
VaciarCarritoDelPedido.ejecutar(clienteId: string): Promise<void>
//   REQUIERE la unidad vigente y el carrito ya bloqueado; borra sus ítems.
```

Sin `Actor` HTTP (API interna, como la de Inventario). Cambio **aditivo**: `ConsultarCarrito` y los endpoints actuales no cambian. Las líneas no comprables se informan para que Pedidos las rechace en bloque (409) sin crear nada.

## 2. API pública de Catálogo (existente: `catalog/index.ts`)

```ts
export { ObtenerDetalleCatalogo, ObtenerDetallesCatalogo } from …;      // ObtenerDetallesCatalogo: NUEVO (aditivo)
ObtenerDetallesCatalogo.ejecutar(ids: string[]): Promise<Map<string, ProductoCatalogo>>   // una consulta; omite los no publicados
```

Lo consume **Carrito** (no Pedidos). La lectura usa la conexión activa si hay una unidad vigente; fuera de ella usa el pool como hoy.

## 3. API pública de Inventario (existente: `inventory/index.ts`)

Sin cambios de contrato, salvo exportar el error de falta de stock:

```ts
export { ReservarInventario, LiberarReserva, ConfirmarVentaReservada, ExpirarReservasVencidas, ConsultarDisponibilidad } from …;
export { StockInsuficienteError } from './domain/errors.js';    // NUEVO (aditivo): trae productoId
ReservarInventario.ejecutar({ claveOperacion: 'pedido:<id>', items: [{ productoId, cantidad }], expiraEn: Date })
```

Pedidos hace **una sola llamada** con todos los productos (Inventario los ordena por producto y los reserva todo-o-nada). `LiberarReserva` no se usa en esta fase: la reversión es el `ROLLBACK`. Dentro de una unidad vigente la reserva comparte la transacción (la infraestructura de Inventario se modifica para unirse; contrato y dominio intactos).

## 4. Puertos de Pedidos (`orders/application/ports/`)

```ts
interface UnidadDeTrabajo { ejecutar<T>(trabajo: () => Promise<T>): Promise<T>; }   // reintenta el bloque completo (≤ 5 intentos transitorios)

interface PedidoRepository {
  bloquearCliente(clienteId: string): Promise<void>;                 // pg_advisory_xact_lock; solo dentro de la unidad
  buscarPorClave(clienteId: string, clave: string): Promise<Pedido | null>;
  insertar(pedido: Pedido): Promise<Pedido>;                         // asigna código `PED-XXXXXXXX` y devuelve el pedido inmutable CON código (DI-1); colisión ⇒ otro código (≤ 5); sin error; agotado ⇒ CodigoPedidoNoGenerableError (503)
  guardarDetalle(pedido: Pedido): Promise<void>;                     // subpedidos, líneas, historial inicial
  buscarPorId(clienteId: string, id: string): Promise<Pedido | null>;                  // null si es ajeno
  listar(clienteId: string, f: { limite: number; desplazamiento: number }): Promise<{ items: ResumenPedido[]; total: number }>;
  historial(clienteId: string, id: string, f: { limite: number; desplazamiento: number }): Promise<{ items: EntradaHistorial[]; total: number } | null>;
}
interface CarritoPort {
  obtenerParaPedido(clienteId: string): Promise<CarritoParaPedido>;  // dentro de la unidad
  vaciar(clienteId: string): Promise<void>;
}
interface ReservaInventarioPort {
  reservar(c: { claveOperacion: string; items: { productoId: string; cantidad: number }[]; expiraEn: Date }): Promise<void>;
  // el adaptador traduce StockInsuficienteError ⇒ StockInsuficientePedidoError { productoId }
}
interface ConfiguracionReservaPort { duracionMinutos(): number }     // entero 1…99 999 999 o ConfiguracionReservaNoDisponibleError (503); solo se consulta para creaciones nuevas (DI-2)
interface RelojPort { ahora(): Date }
interface GeneradorCodigoPort { generar(): string }                  // `PED-` + 8 caracteres; aleatoriedad criptográfica; inyectable
```

**Propiedad de los tipos**: `CarritoParaPedido`, `LineaParaPedido`, `Pedido`, etc. que aparecen en los puertos son tipos **propios de `orders/application`** (la capa de aplicación no importa otros módulos); el adaptador mapea desde los tipos exportados por `cart/index.ts`.

Adaptadores: `CarritoAdapter` e `InventarioAdapter` usan solo `cart/index.ts` e `inventory/index.ts`; `ConfiguracionReservaEntornoAdapter` lee `PEDIDOS_RESERVA_MINUTOS` sin valor predeterminado; `PostgresUnidadDeTrabajo` y `PrismaPedidoRepository` usan `PrismaService`.

## 5. Componente compartido de transacción (`shared/infrastructure/prisma/`)

```ts
PrismaService.db                                                  // cliente de la transacción vigente o el servicio; fuera de vigencia (tx cerrada) LANZA
PrismaService.atomico(trabajo: (tx) => Promise<T>, opciones?)     // se une si hay unidad vigente; si no, abre una con reintento (como hoy)
PrismaService.unidadDeTrabajo(trabajo: () => Promise<T>)          // límite de transacción; ≤ 5 intentos ante errores transitorios; se une si ya hay una
esTransitorio(error): boolean                                      // errores-transitorios.ts: 40P01, 40001, P2034
```

Regla para repositorios: toda sentencia usa `this.prisma.db` o `this.prisma.atomico(...)`; ninguno abre `$transaction` por su cuenta. Justificación, límites, anidación y aislamiento: `research.md` D1; verificación: **POC-001**.

## 6. Contratos hacia Pagos (declarados, **no implementados**; S-08)

| Necesidad de Pagos | Forma prevista | Estado |
|---|---|---|
| Datos del pedido para cobrar (total y subtotales por puesto) | caso de uso público de `orders/index.ts` | pendiente |
| Registrar el pago PENDIENTE dentro de la unidad (C4 N4 §4 paso 9) | `PagosPort.registrarPagoPendiente` participando de la misma transacción | pendiente: S-07 crea pedidos sin pago asociado |
| `PagoAprobado` ⇒ `ESPERANDO_PAGO → PAGO_APROBADO` | `Subpedido.marcarPagoAprobado()` ya modelado; el *listener* es de S-08 | pendiente |
| Expiración (RF54) y aprobación tardía | `Subpedido.expirar()`, clave de reserva nueva `pedido:<id>:r<n>`, bloqueo por pedido, programador de tareas y consulta a la pasarela **fuera** de la transacción (ADR-003 §6.5) | pendiente; ver `plan.md` §«Reservas expiradas y coherencia con Pagos» |

## 7. Compatibilidad

Los contratos existentes (`ConsultarCarrito`, endpoints de Carrito y Catálogo, `ReservarInventario` y sus errores) no cambian de firma ni de comportamiento; los cambios son **aditivos** (nuevos casos de uso, un export y métodos de repositorio) más la modificación **interna** de la infraestructura para unirse a la unidad de trabajo, verificada por las suites existentes.
