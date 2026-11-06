import { ErrorDeValidacion } from '../../../shared/domain/errors.js';

/** Máximo de productos distintos por carrito (igual al máximo de ítems de una reserva de inventario). */
export const MAX_ITEMS_CARRITO = 50;
/** Máxima cantidad por producto: con importes ≤ 99 999 999.99 mantiene todos los totales dentro de los enteros exactos. */
export const MAX_CANTIDAD_ITEM = 10_000;

export function cantidadDeItem(valor: unknown): number {
  if (typeof valor !== 'number' || !Number.isInteger(valor)) throw new ErrorDeValidacion('La cantidad debe ser un número entero.');
  if (valor < 1) throw new ErrorDeValidacion('La cantidad debe ser mayor que cero.');
  if (valor > MAX_CANTIDAD_ITEM) throw new ErrorDeValidacion(`La cantidad no puede superar ${MAX_CANTIDAD_ITEM}.`);
  return valor;
}

/** Céntimos enteros → "12.50". Nunca coma flotante. */
export const formatearCentimos = (c: number): string => `${Math.trunc(c / 100)}.${String(c % 100).padStart(2, '0')}`;

export type EstadoLinea = 'OK' | 'NO_DISPONIBLE' | 'STOCK_INSUFICIENTE';

export interface LineaEntrada {
  productoId: string;
  puestoId: string;
  cantidad: number;
  /** null: el producto ya no se puede comprar (despublicado, puesto o categoría inactivos). */
  producto: { nombre: string; unidadVenta: string; presentacion: string | null; precioCentimos: number; puesto: { id: string; codigo: string; nombre: string } } | null;
  disponible: number;
}

export interface LineaCarrito {
  productoId: string;
  nombre: string | null;
  unidadVenta: string | null;
  presentacion: string | null;
  cantidad: number;
  precioUnitario: string | null;
  subtotal: string | null;
  estado: EstadoLinea;
  /** Unidades disponibles hoy (para que el cliente ajuste la cantidad). */
  disponible: number;
}
export interface GrupoPuesto {
  puesto: { id: string; codigo: string | null; nombre: string | null };
  items: LineaCarrito[];
  /** RF22: suma de las líneas vigentes (estado OK) de este puesto. */
  subtotal: string;
}
export interface CarritoCalculado {
  puestos: GrupoPuesto[];
  /** RF23: suma de los subtotales por puesto. */
  total: string;
  totalProductos: number;
  /** true si alguna línea no se puede comprar tal cual: el cliente debe ajustarla antes de confirmar el pedido. */
  requiereRevision: boolean;
}

/**
 * RF21–RF23. Agrupa por puesto y calcula con céntimos enteros. Las líneas no vigentes (producto no disponible o
 * cantidad por encima del stock) se informan pero NO suman: el total refleja solo lo que hoy se puede comprar.
 */
export function calcularCarrito(lineas: readonly LineaEntrada[]): CarritoCalculado {
  const grupos = new Map<string, { puesto: GrupoPuesto['puesto']; items: LineaCarrito[]; centimos: number }>();
  let total = 0;
  let totalProductos = 0;
  let requiereRevision = false;

  for (const l of lineas) {
    const g = grupos.get(l.puestoId) ?? { puesto: { id: l.puestoId, codigo: null, nombre: null }, items: [], centimos: 0 };
    grupos.set(l.puestoId, g);
    if (!l.producto) {
      requiereRevision = true;
      g.items.push({ productoId: l.productoId, nombre: null, unidadVenta: null, presentacion: null, cantidad: l.cantidad, precioUnitario: null, subtotal: null, estado: 'NO_DISPONIBLE', disponible: 0 });
      continue;
    }
    g.puesto = { id: l.producto.puesto.id, codigo: l.producto.puesto.codigo, nombre: l.producto.puesto.nombre };
    const vigente = l.cantidad <= l.disponible;
    const subtotal = l.producto.precioCentimos * l.cantidad;
    if (vigente) {
      g.centimos += subtotal;
      total += subtotal;
      totalProductos += l.cantidad;
    } else {
      requiereRevision = true;
    }
    g.items.push({
      productoId: l.productoId,
      nombre: l.producto.nombre,
      unidadVenta: l.producto.unidadVenta,
      presentacion: l.producto.presentacion,
      cantidad: l.cantidad,
      precioUnitario: formatearCentimos(l.producto.precioCentimos),
      subtotal: formatearCentimos(subtotal),
      estado: vigente ? 'OK' : 'STOCK_INSUFICIENTE',
      disponible: l.disponible,
    });
  }

  const puestos = [...grupos.values()].map((g) => ({ puesto: g.puesto, items: g.items, subtotal: formatearCentimos(g.centimos) }));
  return { puestos, total: formatearCentimos(total), totalProductos, requiereRevision };
}
