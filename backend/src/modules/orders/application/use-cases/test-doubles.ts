/**
 * Dobles en memoria de los puertos de Pedidos (SOLO para pruebas unitarias).
 *
 * Reproducen las PROPIEDADES que el caso de uso necesita de la infraestructura (rollback que restaura todos los almacenes,
 * reintento de la unidad completa ante errores transitorios, operaciones que exigen una unidad vigente, reserva todo o nada,
 * colisiones de código resueltas dentro de `insertar`). NO demuestran las garantías reales de PostgreSQL (bloqueo consultivo,
 * FOR UPDATE, restricciones únicas, aislamiento): esas se verifican con las pruebas de persistencia y concurrencia.
 */
import { ErrorServicioNoDisponible } from '../../../../shared/domain/errors.js';
import { UnidadDeTrabajoRequeridaError } from '../../../../shared/domain/unidad-de-trabajo.error.js';
import { estadoGeneral } from '../../domain/estado-general.js';
import { generarCodigoPedido } from '../../domain/codigo-pedido.js';
import type { Pedido } from '../../domain/pedido.entity.js';
import type { CarritoParaPedido, CarritoPort, LineaParaPedido } from '../ports/carrito.port.js';
import type { ConfiguracionReservaPort } from '../ports/configuracion-reserva.port.js';
import type { GeneradorCodigoPort } from '../ports/generador-codigo.port.js';
import {
  CodigoPedidoNoGenerableError,
  MAX_INTENTOS_CODIGO,
  type EntradaHistorialPedido,
  type Paginacion,
  type PedidoRepository,
  type ResumenPedido,
} from '../ports/pedido.repository.js';
import type { RelojPort } from '../ports/reloj.port.js';
import { StockInsuficientePedidoError, type ReservaInventarioPort } from '../ports/reserva-inventario.port.js';
import type { UnidadDeTrabajo } from '../ports/unidad-de-trabajo.port.js';

/** Representa un interbloqueo o fallo de serialización (40P01, 40001, P2034): lo único que la unidad reintenta. */
export class ErrorTransitorioSimulado extends Error {
  constructor(mensaje = 'interbloqueo simulado') {
    super(mensaje);
    this.name = 'ErrorTransitorioSimulado';
  }
}

/** Puntos de paso instrumentados (se registran DESPUÉS de que la operación produjo su efecto). */
export type Paso =
  | 'pedidos.bloquearCliente'
  | 'pedidos.buscarPorClave'
  | 'carrito.obtenerParaPedido'
  | 'pedidos.insertar'
  | 'pedidos.guardarDetalle'
  | 'carrito.vaciar'
  | 'inventario.reservar';

/** Estado compartido por los dobles: vigencia de la unidad, registro de pasos, fallos y ganchos inyectados. */
export class EntornoEnMemoria {
  vigente = false;
  /** Pasos ejecutados, en orden (incluye los de intentos revertidos). */
  readonly pasos: { paso: Paso; enUnidad: boolean }[] = [];
  private readonly fallos = new Map<Paso, { crear: () => Error; veces: number }>();
  private readonly ganchos = new Map<Paso, () => Promise<void>>();

  /** El paso lanzará el error las `veces` indicadas (después de producir su efecto). */
  fallarEn(paso: Paso, error: Error | (() => Error), veces = 1): void {
    this.fallos.set(paso, { crear: typeof error === 'function' ? error : () => error, veces });
  }
  /** Ejecuta `gancho` UNA vez, la primera vez que se alcance el paso (simula una operación concurrente). */
  alPasar(paso: Paso, gancho: () => Promise<void>): void {
    this.ganchos.set(paso, gancho);
  }
  exigirUnidad(operacion: string): void {
    if (!this.vigente) throw new UnidadDeTrabajoRequeridaError(operacion);
  }
  async paso(paso: Paso): Promise<void> {
    this.pasos.push({ paso, enUnidad: this.vigente });
    const gancho = this.ganchos.get(paso);
    if (gancho) {
      this.ganchos.delete(paso);
      await gancho();
    }
    const f = this.fallos.get(paso);
    if (f && f.veces > 0) {
      f.veces--;
      throw f.crear();
    }
  }
  nombresDePasos(): Paso[] {
    return this.pasos.map((p) => p.paso);
  }
}

export interface Restaurable {
  instantanea(): unknown;
  restaurar(instantanea: unknown): void;
}

/**
 * Unidad de trabajo en memoria: toma una instantánea de TODOS los almacenes al empezar cada intento y la restaura si el
 * intento falla (equivalente al ROLLBACK). Reintenta el bloque completo solo ante `ErrorTransitorioSimulado`, hasta
 * `maxIntentos` intentos en total; agotados, lanza `ErrorServicioNoDisponible` con la causa (como el componente de T001).
 * Si ya hay una unidad vigente, se une a ella.
 */
export class UnidadDeTrabajoEnMemoria implements UnidadDeTrabajo {
  /** Intentos de transacción iniciados (todas las unidades). */
  intentos = 0;
  /** Unidades (límites de transacción externos) iniciadas. */
  unidades = 0;

  constructor(private readonly entorno: EntornoEnMemoria, private readonly almacenes: Restaurable[], private readonly maxIntentos = 5) {}

  async ejecutar<T>(trabajo: () => Promise<T>): Promise<T> {
    if (this.entorno.vigente) return trabajo();
    this.unidades++;
    for (let intento = 1; ; intento++) {
      this.intentos++;
      const fotos = this.almacenes.map((a) => a.instantanea());
      this.entorno.vigente = true;
      try {
        return await trabajo();
      } catch (e) {
        this.almacenes.forEach((a, i) => a.restaurar(fotos[i]));
        if (!(e instanceof ErrorTransitorioSimulado)) throw e;
        if (intento >= this.maxIntentos) {
          const agotado = new ErrorServicioNoDisponible('El servicio no pudo completar la operación; intente de nuevo.');
          agotado.cause = e;
          throw agotado;
        }
      } finally {
        this.entorno.vigente = false;
      }
    }
  }
}

const copiarLinea = (l: LineaParaPedido): LineaParaPedido => ({ ...l, puesto: l.puesto ? { ...l.puesto } : null });

export class CarritoPedidosEnMemoria implements CarritoPort, Restaurable {
  private carritos = new Map<string, CarritoParaPedido>();

  constructor(private readonly entorno: EntornoEnMemoria) {}

  /** Prepara el carrito de un cliente (fuera de cualquier unidad). */
  poner(clienteId: string, carritoId: string, lineas: LineaParaPedido[]): void {
    this.carritos.set(clienteId, { carritoId, lineas: lineas.map(copiarLinea) });
  }
  lineasDe(clienteId: string): LineaParaPedido[] {
    return (this.carritos.get(clienteId)?.lineas ?? []).map(copiarLinea);
  }

  async obtenerParaPedido(clienteId: string): Promise<CarritoParaPedido> {
    this.entorno.exigirUnidad('obtenerParaPedido');
    const c = this.carritos.get(clienteId);
    const r: CarritoParaPedido = c
      ? { carritoId: c.carritoId, lineas: [...c.lineas].sort((a, b) => (a.productoId < b.productoId ? -1 : 1)).map(copiarLinea) }
      : { carritoId: null, lineas: [] };
    await this.entorno.paso('carrito.obtenerParaPedido');
    return r;
  }
  async vaciar(clienteId: string): Promise<void> {
    this.entorno.exigirUnidad('vaciar');
    const c = this.carritos.get(clienteId);
    if (c) this.carritos.set(clienteId, { carritoId: c.carritoId, lineas: [] });
    await this.entorno.paso('carrito.vaciar');
  }

  instantanea(): unknown {
    return new Map([...this.carritos].map(([k, v]) => [k, { carritoId: v.carritoId, lineas: v.lineas.map(copiarLinea) }]));
  }
  restaurar(i: unknown): void {
    this.carritos = i as Map<string, CarritoParaPedido>;
  }
}

export interface ReservaRegistrada {
  claveOperacion: string;
  items: { productoId: string; cantidad: number }[];
  expiraEn: Date;
}

/** Inventario: todo o nada, y una clave de operación no puede reservar dos veces. */
export class ReservaInventarioEnMemoria implements ReservaInventarioPort, Restaurable {
  private disponible = new Map<string, number>();
  private reservas = new Map<string, ReservaRegistrada>();

  constructor(private readonly entorno: EntornoEnMemoria) {}

  fijarDisponible(productoId: string, unidades: number): void {
    this.disponible.set(productoId, unidades);
  }
  disponibleDe(productoId: string): number {
    return this.disponible.get(productoId) ?? 0;
  }
  listaReservas(): ReservaRegistrada[] {
    return [...this.reservas.values()].map((r) => ({ ...r, items: r.items.map((i) => ({ ...i })), expiraEn: new Date(r.expiraEn) }));
  }

  async reservar(c: { claveOperacion: string; items: { productoId: string; cantidad: number }[]; expiraEn: Date }): Promise<void> {
    this.entorno.exigirUnidad('reservar');
    if (this.reservas.has(c.claveOperacion)) throw new Error(`La clave de operación ${c.claveOperacion} ya reservó.`);
    for (const i of c.items) if (this.disponibleDe(i.productoId) < i.cantidad) throw new StockInsuficientePedidoError(i.productoId);
    for (const i of c.items) this.disponible.set(i.productoId, this.disponibleDe(i.productoId) - i.cantidad);
    this.reservas.set(c.claveOperacion, { claveOperacion: c.claveOperacion, items: c.items.map((i) => ({ ...i })), expiraEn: new Date(c.expiraEn) });
    await this.entorno.paso('inventario.reservar');
  }

  instantanea(): unknown {
    return { disponible: new Map(this.disponible), reservas: new Map(this.reservas) };
  }
  restaurar(i: unknown): void {
    const f = i as { disponible: Map<string, number>; reservas: Map<string, ReservaRegistrada> };
    this.disponible = f.disponible;
    this.reservas = f.reservas;
  }
}

/** Repositorio en memoria. `insertar` resuelve las colisiones de código con el generador inyectado (≤ 5). */
export class PedidosEnMemoria implements PedidoRepository, Restaurable {
  private pedidos = new Map<string, Pedido>();
  private conDetalle = new Set<string>();
  /** Códigos ya usados por pedidos que no están en este almacén (para forzar colisiones). */
  readonly codigosOcupados = new Set<string>();
  /** Registro de bloqueos solicitados (no se restaura: el bloqueo real se libera al terminar la transacción). */
  readonly bloqueos: string[] = [];

  constructor(private readonly entorno: EntornoEnMemoria, private readonly generador: GeneradorCodigoPort) {}

  todos(): Pedido[] {
    return [...this.pedidos.values()];
  }
  tieneDetalle(id: string): boolean {
    return this.conDetalle.has(id);
  }
  /** Guarda un pedido ya completo (con código y detalle), p. ej. creado antes de la prueba. */
  sembrar(pedido: Pedido): void {
    this.pedidos.set(pedido.id, pedido);
    this.conDetalle.add(pedido.id);
  }

  async bloquearCliente(clienteId: string): Promise<void> {
    this.entorno.exigirUnidad('bloquearCliente');
    this.bloqueos.push(clienteId);
    await this.entorno.paso('pedidos.bloquearCliente');
  }
  async buscarPorClave(clienteId: string, clave: string): Promise<Pedido | null> {
    const p = this.todos().find((x) => x.clienteId === clienteId && x.claveIdempotencia === clave) ?? null;
    await this.entorno.paso('pedidos.buscarPorClave');
    return p;
  }
  async insertar(pedido: Pedido): Promise<Pedido> {
    this.entorno.exigirUnidad('insertar');
    if (this.pedidos.has(pedido.id)) throw new Error('Identificador de pedido duplicado.');
    if (this.todos().some((x) => x.clienteId === pedido.clienteId && x.claveIdempotencia === pedido.claveIdempotencia)) {
      throw new Error('Violación de la unicidad (cliente, clave).'); // red de seguridad, como la restricción real
    }
    for (let i = 0; i < MAX_INTENTOS_CODIGO; i++) {
      const codigo = this.generador.generar();
      if (this.codigosOcupados.has(codigo) || this.todos().some((x) => x.codigo === codigo)) continue; // ON CONFLICT DO NOTHING
      const conCodigo = pedido.conCodigo(codigo);
      this.pedidos.set(conCodigo.id, conCodigo);
      await this.entorno.paso('pedidos.insertar');
      return conCodigo;
    }
    throw new CodigoPedidoNoGenerableError();
  }
  async guardarDetalle(pedido: Pedido): Promise<void> {
    this.entorno.exigirUnidad('guardarDetalle');
    if (!this.pedidos.has(pedido.id)) throw new Error('El pedido no está insertado.');
    this.conDetalle.add(pedido.id);
    await this.entorno.paso('pedidos.guardarDetalle');
  }
  async buscarPorId(clienteId: string, id: string): Promise<Pedido | null> {
    const p = this.pedidos.get(id);
    return p && p.clienteId === clienteId ? p : null;
  }
  async listar(clienteId: string, f: Paginacion): Promise<{ items: ResumenPedido[]; total: number }> {
    const propios = this.todos()
      .filter((p) => p.clienteId === clienteId)
      .sort((a, b) => b.creadoEn.getTime() - a.creadoEn.getTime() || (a.id < b.id ? -1 : 1));
    const items = propios.slice(f.desplazamiento, f.desplazamiento + f.limite).map((p) => ({
      id: p.id,
      codigo: p.codigo ?? '',
      creadoEn: p.creadoEn,
      estadoGeneral: estadoGeneral(p.subpedidos.map((s) => s.estado)),
      totalCentimos: p.totalCentimos,
      cantidadSubpedidos: p.subpedidos.length,
    }));
    return { items, total: propios.length };
  }
  async historial(clienteId: string, id: string, f: Paginacion): Promise<{ items: EntradaHistorialPedido[]; total: number } | null> {
    const p = await this.buscarPorId(clienteId, id);
    if (!p) return null;
    const todas = p.subpedidos
      .flatMap((s) => s.historial.map((h) => ({ subpedidoId: s.id, puesto: { ...s.puesto }, estadoAnterior: h.estadoAnterior, estadoNuevo: h.estadoNuevo, origen: h.origen, creadoEn: h.creadoEn })))
      .sort((a, b) => a.creadoEn.getTime() - b.creadoEn.getTime());
    return { items: todas.slice(f.desplazamiento, f.desplazamiento + f.limite), total: todas.length };
  }

  instantanea(): unknown {
    return { pedidos: new Map(this.pedidos), conDetalle: new Set(this.conDetalle) };
  }
  restaurar(i: unknown): void {
    const f = i as { pedidos: Map<string, Pedido>; conDetalle: Set<string> };
    this.pedidos = f.pedidos;
    this.conDetalle = f.conDetalle;
  }
}

/** Devuelve primero los códigos indicados y luego una secuencia determinista sin repetición. */
export class GeneradorCodigoSecuencial implements GeneradorCodigoPort {
  private readonly pendientes: string[];
  private n = 0;
  generados = 0;

  constructor(primeros: string[] = []) {
    this.pendientes = [...primeros];
  }
  generar(): string {
    this.generados++;
    const siguiente = this.pendientes.shift();
    if (siguiente !== undefined) return siguiente;
    let v = ++this.n;
    const digitos = Array.from({ length: 8 }, () => {
      const d = v % 32;
      v = Math.floor(v / 32);
      return d;
    }).reverse();
    let i = 0;
    return generarCodigoPedido(() => digitos[i++]!);
  }
}

/** Duración fija, o el error/valor inválido que se quiera simular. Cuenta las lecturas. */
export class ConfiguracionReservaFija implements ConfiguracionReservaPort {
  lecturas = 0;
  constructor(public valor: number | Error) {}
  duracionMinutos(): number {
    this.lecturas++;
    if (this.valor instanceof Error) throw this.valor;
    return this.valor;
  }
}

export class RelojFijo implements RelojPort {
  constructor(public instante: Date) {}
  ahora(): Date {
    return new Date(this.instante);
  }
}

/** Monta todos los dobles conectados al mismo entorno y a la misma unidad de trabajo. */
export function montarDobles(opciones: { duracionMinutos?: number | Error; ahora?: Date; codigos?: string[] } = {}) {
  const entorno = new EntornoEnMemoria();
  const generador = new GeneradorCodigoSecuencial(opciones.codigos);
  const pedidos = new PedidosEnMemoria(entorno, generador);
  const carrito = new CarritoPedidosEnMemoria(entorno);
  const inventario = new ReservaInventarioEnMemoria(entorno);
  const uow = new UnidadDeTrabajoEnMemoria(entorno, [pedidos, carrito, inventario]);
  const configuracion = new ConfiguracionReservaFija(opciones.duracionMinutos ?? 30);
  const reloj = new RelojFijo(opciones.ahora ?? new Date('2026-11-06T10:00:00.000Z'));
  return { entorno, generador, pedidos, carrito, inventario, uow, configuracion, reloj };
}
