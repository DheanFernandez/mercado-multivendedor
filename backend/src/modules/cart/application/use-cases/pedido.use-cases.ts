import { esUuid } from '../../../../shared/application/paginacion.js';
import { ErrorDeValidacion } from '../../../../shared/domain/errors.js';
import type { CarritoRepository, ProductosVendiblesLotePort } from '../ports/ports.js';

/** Línea del carrito tal como la necesita Pedidos. Si el producto ya no es comprable, los datos de catálogo son `null`. */
export interface LineaParaPedido {
  productoId: string;
  puesto: { id: string; codigo: string; nombre: string } | null;
  nombre: string | null;
  unidadVenta: string | null;
  presentacion: string | null;
  cantidad: number;
  precioUnitarioCentimos: number | null;
  comprable: boolean;
}

export interface CarritoParaPedido {
  /** `null` si el cliente aún no tiene carrito; no se expone por HTTP. */
  carritoId: string | null;
  /** Orden estable por producto; `[]` si está vacío. */
  lineas: LineaParaPedido[];
}

function exigirCliente(id: unknown): string {
  if (!esUuid(id)) throw new ErrorDeValidacion('El cliente no es válido.');
  return id;
}

/**
 * Lectura AUTORITATIVA del carrito para crear un pedido (Q4, FR-027). Exige una unidad de trabajo vigente: bloquea el
 * carrito y sus ítems (las ediciones concurrentes esperan) y lee el catálogo en lote por la misma conexión.
 */
export class ObtenerCarritoParaPedido {
  constructor(private readonly carrito: CarritoRepository, private readonly productos: ProductosVendiblesLotePort) {}

  async ejecutar(clienteId: unknown): Promise<CarritoParaPedido> {
    const usuarioId = exigirCliente(clienteId);
    const { carritoId, items } = await this.carrito.bloquearYListar(usuarioId);
    if (items.length === 0) return { carritoId, lineas: [] };
    const vendibles = await this.productos.obtener(items.map((i) => i.productoId));
    const lineas = [...items]
      .sort((a, b) => (a.productoId < b.productoId ? -1 : a.productoId > b.productoId ? 1 : 0))
      .map((i): LineaParaPedido => {
        const p = vendibles.get(i.productoId);
        return p
          ? { productoId: i.productoId, puesto: p.puesto, nombre: p.nombre, unidadVenta: p.unidadVenta, presentacion: p.presentacion, cantidad: i.cantidad, precioUnitarioCentimos: p.precioCentimos, comprable: true }
          : { productoId: i.productoId, puesto: null, nombre: null, unidadVenta: null, presentacion: null, cantidad: i.cantidad, precioUnitarioCentimos: null, comprable: false };
      });
    return { carritoId, lineas };
  }
}

/** Borra los ítems del carrito ya bloqueado por `ObtenerCarritoParaPedido`, en la misma unidad de trabajo. */
export class VaciarCarritoDelPedido {
  constructor(private readonly carrito: CarritoRepository) {}

  async ejecutar(clienteId: unknown): Promise<void> {
    await this.carrito.vaciarItems(exigirCliente(clienteId));
  }
}
