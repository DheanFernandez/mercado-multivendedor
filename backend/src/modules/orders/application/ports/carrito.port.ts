/**
 * Puerto hacia Carrito (contracts §4). Tipos PROPIOS de Pedidos: el adaptador mapea desde `cart/index.ts`.
 * Ambas operaciones exigen una unidad de trabajo vigente.
 */
export interface LineaParaPedido {
  productoId: string;
  /** null: el producto ya no es comprable. */
  puesto: { id: string; codigo: string; nombre: string } | null;
  nombre: string | null;
  unidadVenta: string | null;
  presentacion: string | null;
  cantidad: number;
  /** Céntimos enteros; null si no es comprable. */
  precioUnitarioCentimos: number | null;
  comprable: boolean;
}

export interface CarritoParaPedido {
  /** null si el cliente aún no tiene carrito. */
  carritoId: string | null;
  /** Orden estable por producto; [] si está vacío. */
  lineas: LineaParaPedido[];
}

export interface CarritoPort {
  /** Lectura AUTORITATIVA: bloquea el carrito y sus ítems dentro de la unidad y lee el catálogo por la misma conexión. */
  obtenerParaPedido(clienteId: string): Promise<CarritoParaPedido>;
  /** Borra los ítems del carrito ya bloqueado, en la misma unidad. */
  vaciar(clienteId: string): Promise<void>;
}

export const CARRITO_PORT = Symbol('CARRITO_PORT');
