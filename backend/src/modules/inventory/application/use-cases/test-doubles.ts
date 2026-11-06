/** Dobles de prueba en memoria (solo para pruebas). Aplican las mismas reglas que PostgreSQL mediante el dominio `Stock`. */
import { randomUUID } from 'node:crypto';
import {
  ClaveOperacionReutilizadaError,
  ReservaNoEncontradaError,
  ReservaYaConfirmadaError,
  ReservaYaLiberadaError,
  StockInsuficienteError,
} from '../../domain/errors.js';
import { Stock } from '../../domain/stock.js';
import {
  toExistencias,
  type EstadoReserva,
  type ExistenciasProducto,
  type InventarioRepository,
  type ItemReserva,
  type MovimientoInventario,
  type PropiedadProductoPort,
  type ResultadoReservar,
  type TipoMovimiento,
} from '../ports/ports.js';

interface Fila { productoId: string; puestoId: string; stock: Stock; movimientos: MovimientoInventario[] }
interface Reserva { clave: string; productoId: string; cantidad: number; estado: EstadoReserva; expiraEn: Date }

export class InventarioEnMemoria implements InventarioRepository {
  readonly filas = new Map<string, Fila>();
  readonly reservas: Reserva[] = [];
  /** Si se define, se lanza al procesar el ítem con ese índice (simula un fallo a mitad de la transacción). */
  fallarEnItem: number | null = null;

  private vista(f: Fila): ExistenciasProducto { return toExistencias(f.productoId, f.puestoId, f.stock); }
  private mover(f: Fila, tipo: TipoMovimiento, vf: number, vr: number, motivo: string | null, actorId: string | null, referencia: string | null) {
    f.movimientos.unshift({ id: randomUUID(), tipo, variacionFisica: vf, variacionReservada: vr, stockFisicoDespues: f.stock.fisico, stockReservadoDespues: f.stock.reservado, motivo, actorId, referencia, creadoEn: new Date() });
  }

  async obtener(productoId: string) { const f = this.filas.get(productoId); return f ? this.vista(f) : null; }
  async listar(q: { puestoIds?: string[]; puestoId?: string; limite: number; desplazamiento: number }) {
    const todos = [...this.filas.values()].filter((f) => (!q.puestoId || f.puestoId === q.puestoId) && (!q.puestoIds || q.puestoIds.includes(f.puestoId)));
    return { items: todos.slice(q.desplazamiento, q.desplazamiento + q.limite).map((f) => this.vista(f)), total: todos.length };
  }
  async listarMovimientos(productoId: string, q: { limite: number; desplazamiento: number }) {
    const m = this.filas.get(productoId)?.movimientos ?? [];
    return { items: m.slice(q.desplazamiento, q.desplazamiento + q.limite).map((x) => ({ ...x })), total: m.length };
  }
  async variarStock(c: Parameters<InventarioRepository['variarStock']>[0]) {
    const f = this.filas.get(c.productoId) ?? { productoId: c.productoId, puestoId: c.puestoId, stock: Stock.vacio(), movimientos: [] };
    f.stock = f.stock.variarFisico(c.delta); // lanza StockFisicoInsuficienteError antes de modificar nada
    this.filas.set(c.productoId, f);
    this.mover(f, c.tipo, c.delta, 0, c.motivo, c.actorId, null);
    return this.vista(f);
  }
  async reservar(c: { claveOperacion: string; items: ItemReserva[]; expiraEn: Date }): Promise<ResultadoReservar> {
    const previas = this.reservas.filter((r) => r.clave === c.claveOperacion);
    if (previas.length > 0) {
      const mismas = previas.length === c.items.length && c.items.every((i) => previas.some((r) => r.productoId === i.productoId && r.cantidad === i.cantidad));
      if (!mismas) throw new ClaveOperacionReutilizadaError();
      return { reservas: previas.map((r) => ({ productoId: r.productoId, cantidad: r.cantidad, estado: r.estado })), repetida: true };
    }
    // Transacción simulada: se trabaja sobre copias y solo se confirma si todo salió bien.
    const trabajo = new Map<string, Stock>();
    c.items.forEach((i, n) => {
      if (this.fallarEnItem === n) throw new Error('Fallo simulado a mitad de la transacción.');
      const f = this.filas.get(i.productoId);
      if (!f) throw new StockInsuficienteError(i.productoId);
      trabajo.set(i.productoId, f.stock.reservar(i.cantidad, i.productoId));
    });
    for (const i of c.items) {
      const f = this.filas.get(i.productoId)!;
      f.stock = trabajo.get(i.productoId)!;
      this.mover(f, 'RESERVA', 0, i.cantidad, null, null, c.claveOperacion);
      this.reservas.push({ clave: c.claveOperacion, productoId: i.productoId, cantidad: i.cantidad, estado: 'RESERVADA', expiraEn: c.expiraEn });
    }
    return { reservas: c.items.map((i) => ({ ...i, estado: 'RESERVADA' as const })), repetida: false };
  }
  async liberar(c: { claveOperacion: string; soloVencidasAl?: Date; motivo: string }) {
    const todas = this.reservas.filter((r) => r.clave === c.claveOperacion);
    if (todas.length === 0) { if (c.soloVencidasAl) return { liberadas: 0 }; throw new ReservaNoEncontradaError(); }
    const aplicables = todas.filter((r) => r.estado === 'RESERVADA' && (!c.soloVencidasAl || r.expiraEn <= c.soloVencidasAl));
    if (aplicables.length === 0 && todas.some((r) => r.estado === 'CONFIRMADA') && !c.soloVencidasAl) throw new ReservaYaConfirmadaError();
    let liberadas = 0;
    for (const r of aplicables) {
      const f = this.filas.get(r.productoId)!;
      f.stock = f.stock.liberar(r.cantidad);
      r.estado = 'LIBERADA';
      this.mover(f, 'LIBERACION', 0, -r.cantidad, c.motivo, null, c.claveOperacion);
      liberadas += r.cantidad;
    }
    return { liberadas };
  }
  async confirmarVenta(c: { claveOperacion: string }) {
    const todas = this.reservas.filter((r) => r.clave === c.claveOperacion);
    if (todas.length === 0) throw new ReservaNoEncontradaError();
    const pendientes = todas.filter((r) => r.estado === 'RESERVADA');
    if (pendientes.length === 0 && todas.some((r) => r.estado === 'LIBERADA')) throw new ReservaYaLiberadaError();
    let confirmadas = 0;
    for (const r of pendientes) {
      const f = this.filas.get(r.productoId)!;
      f.stock = f.stock.vender(r.cantidad);
      r.estado = 'CONFIRMADA';
      this.mover(f, 'VENTA', -r.cantidad, -r.cantidad, null, null, c.claveOperacion);
      confirmadas += r.cantidad;
    }
    return { confirmadas };
  }
  async clavesVencidas(ahora: Date, lote: number) {
    return [...new Set(this.reservas.filter((r) => r.estado === 'RESERVADA' && r.expiraEn <= ahora).map((r) => r.clave))].slice(0, lote);
  }
}

export class PropiedadEnMemoria implements PropiedadProductoPort {
  /** productoId → puesto y titular */
  readonly productos = new Map<string, { puestoId: string; usuarioIdTitular: string }>();
  async productoConTitular(productoId: string) { const p = this.productos.get(productoId); return p ? { productoId, ...p } : null; }
  async idsPuestoDeTitular(usuarioId: string) { return [...new Set([...this.productos.values()].filter((p) => p.usuarioIdTitular === usuarioId).map((p) => p.puestoId))]; }
}
