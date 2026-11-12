/** Dobles de prueba en memoria (solo para pruebas). Aplican las mismas reglas que la consulta SQL del repositorio real. */
import { UnidadDeTrabajoRequeridaError } from '../../../../shared/domain/unidad-de-trabajo.error.js';
import type { CarritoRepository, DisponibilidadPort, ItemGuardado, ProductoVendible, ProductosVendiblesLotePort, ProductoVendiblePort, ResultadoAgregar } from '../ports/ports.js';

export class CarritoEnMemoria implements CarritoRepository {
  readonly carritos = new Map<string, ItemGuardado[]>();

  private de(usuarioId: string) {
    const c = this.carritos.get(usuarioId) ?? [];
    this.carritos.set(usuarioId, c);
    return c;
  }
  async listar(usuarioId: string) { return (this.carritos.get(usuarioId) ?? []).map((i) => ({ ...i })); }
  async agregar(c: { usuarioId: string; productoId: string; puestoId: string; cantidad: number; tope: number; maxItems: number }): Promise<ResultadoAgregar> {
    if (c.cantidad > c.tope) return { resultado: 'SUPERA_TOPE' };
    const items = this.de(c.usuarioId);
    const existente = items.find((i) => i.productoId === c.productoId);
    if (!existente) {
      if (items.length >= c.maxItems) return { resultado: 'LIMITE_ITEMS' };
      items.push({ productoId: c.productoId, puestoId: c.puestoId, cantidad: c.cantidad });
      return { resultado: 'AGREGADO', cantidad: c.cantidad };
    }
    if (existente.cantidad + c.cantidad > c.tope) return { resultado: 'SUPERA_TOPE' };
    existente.cantidad += c.cantidad;
    return { resultado: 'AGREGADO', cantidad: existente.cantidad };
  }
  async fijarCantidad(c: { usuarioId: string; productoId: string; cantidad: number }) {
    const i = (this.carritos.get(c.usuarioId) ?? []).find((x) => x.productoId === c.productoId);
    if (!i) return false;
    i.cantidad = c.cantidad;
    return true;
  }
  async quitar(c: { usuarioId: string; productoId: string }) {
    const items = this.carritos.get(c.usuarioId) ?? [];
    const idx = items.findIndex((x) => x.productoId === c.productoId);
    if (idx < 0) return false;
    items.splice(idx, 1);
    return true;
  }
  async vaciar(usuarioId: string) { this.carritos.set(usuarioId, []); }

  /** Simula la unidad de trabajo: `bloquearYListar` y `vaciarItems` solo funcionan dentro de `conUnidad`. */
  private unidadVigente = false;
  async conUnidad<T>(trabajo: () => Promise<T>): Promise<T> {
    this.unidadVigente = true;
    try { return await trabajo(); } finally { this.unidadVigente = false; }
  }
  /** Llamadas realizadas a `bloquearYListar` (para comprobar cuántas veces se lee). */
  bloqueos = 0;
  async bloquearYListar(usuarioId: string) {
    if (!this.unidadVigente) throw new UnidadDeTrabajoRequeridaError('bloquearYListar');
    this.bloqueos++;
    const items = this.carritos.get(usuarioId);
    if (!items) return { carritoId: null, items: [] };
    return { carritoId: `carrito-${usuarioId}`, items: items.map((i) => ({ ...i })).sort((a, b) => (a.productoId < b.productoId ? -1 : 1)) };
  }
  async vaciarItems(usuarioId: string) {
    if (!this.unidadVigente) throw new UnidadDeTrabajoRequeridaError('vaciarItems');
    const n = this.carritos.get(usuarioId)?.length ?? 0;
    this.carritos.set(usuarioId, []);
    return n;
  }
}

export class ProductosVendiblesFalsos implements ProductoVendiblePort {
  constructor(readonly productos: Record<string, ProductoVendible> = {}) {}
  async obtener(id: string) { return this.productos[id] ?? null; }
}

export class ProductosVendiblesLoteFalsos implements ProductosVendiblesLotePort {
  /** Una entrada por consulta realizada (los identificadores pedidos). */
  readonly llamadas: string[][] = [];
  constructor(readonly productos: Record<string, ProductoVendible> = {}) {}
  async obtener(ids: string[]) {
    this.llamadas.push([...ids]);
    return new Map(ids.filter((i) => this.productos[i]).map((i) => [i, this.productos[i]!] as const));
  }
}

export class DisponibilidadFalsa implements DisponibilidadPort {
  constructor(readonly unidades: Record<string, number> = {}) {}
  async disponible(id: string) { return this.unidades[id] ?? 0; }
}
