import { ErrorDeValidacion } from '../../../shared/domain/errors.js';
import { esCodigoPedidoValido } from './codigo-pedido.js';
import { CarritoVacioError, ReconstitucionInvalidaError } from './errors.js';
import { estadoGeneral, type EstadoGeneral } from './estado-general.js';
import { LineaPedido, textoObligatorio, type LineaNueva } from './linea-pedido.js';
import type { EstadoSubpedido } from './estado-subpedido.js';
import { Subpedido, type EntradaHistorial } from './subpedido.entity.js';

export type { LineaNueva } from './linea-pedido.js';

/** Mismo máximo que el carrito. */
export const MAX_LINEAS_PEDIDO = 50;
const CLAVE = /^[A-Za-z0-9:_.-]{1,100}$/;
const HUELLA = /^[0-9a-f]{64}$/;

export interface DatosNuevoPedido {
  id: string;
  clienteId: string;
  claveIdempotencia: string;
  carritoId: string;
  huellaCarrito: string;
  lineas: readonly LineaNueva[];
  reservaVenceEn: Date;
  creadoEn: Date;
  /** Generador de identificadores para subpedidos y líneas (inyectado: el dominio no depende de la fuente). */
  generarId: () => string;
}

const fechaValida = (d: unknown): d is Date => d instanceof Date && !Number.isNaN(d.getTime());

/** Datos persistidos de un pedido (lo que el repositorio lee), con importes ya convertidos a céntimos enteros. */
export interface DatosReconstitucionPedido {
  id: string;
  codigo: string;
  clienteId: string;
  claveIdempotencia: string;
  carritoId: string;
  huellaCarrito: string;
  totalCentimos: number;
  reservaVenceEn: Date;
  creadoEn: Date;
  subpedidos: {
    id: string;
    puestoId: string;
    puesto: { codigo: string; nombre: string };
    estado: EstadoSubpedido;
    subtotalCentimos: number;
    lineas: { id: string; productoId: string; nombre: string; unidadVenta: string; presentacion: string | null; cantidad: number; precioUnitarioCentimos: number; subtotalCentimos: number }[];
    historial: EntradaHistorial[];
  }[];
}

/**
 * Raíz del agregado: un pedido del cliente con un subpedido por puesto. Importes en céntimos enteros;
 * total = Σ subpedidos; subpedido = Σ líneas. Inmutable tras crearse (el estado de cada subpedido evoluciona en `Subpedido`).
 */
export class Pedido {
  readonly totalCentimos: number;

  private constructor(
    readonly id: string,
    readonly codigo: string | null,
    readonly clienteId: string,
    readonly claveIdempotencia: string,
    readonly carritoId: string,
    readonly huellaCarrito: string,
    readonly reservaVenceEn: Date,
    readonly creadoEn: Date,
    readonly subpedidos: readonly Subpedido[],
  ) {
    this.totalCentimos = subpedidos.reduce((a, s) => a + s.subtotalCentimos, 0);
    Object.freeze(this.subpedidos);
    Object.freeze(this);
  }

  static crear(d: DatosNuevoPedido): Pedido {
    textoObligatorio(d.id, 'El identificador del pedido');
    textoObligatorio(d.clienteId, 'El cliente');
    textoObligatorio(d.carritoId, 'El carrito');
    if (typeof d.claveIdempotencia !== 'string' || !CLAVE.test(d.claveIdempotencia)) throw new ErrorDeValidacion('La clave de operación no es válida.');
    if (typeof d.huellaCarrito !== 'string' || !HUELLA.test(d.huellaCarrito)) throw new ErrorDeValidacion('La huella del carrito no es válida.');
    if (!fechaValida(d.creadoEn) || !fechaValida(d.reservaVenceEn)) throw new ErrorDeValidacion('Las fechas del pedido no son válidas.');
    if (d.reservaVenceEn.getTime() <= d.creadoEn.getTime()) throw new ErrorDeValidacion('La reserva debe vencer después de la creación del pedido.');
    if (d.lineas.length === 0) throw new CarritoVacioError();
    if (d.lineas.length > MAX_LINEAS_PEDIDO) throw new ErrorDeValidacion(`Un pedido admite como máximo ${MAX_LINEAS_PEDIDO} productos distintos.`);

    const usados = new Set<string>([d.id]);
    const nuevoId = (): string => {
      const id = d.generarId();
      if (usados.has(id)) throw new ErrorDeValidacion('El generador de identificadores repitió un valor.');
      usados.add(id);
      return id;
    };

    const productos = new Set<string>();
    const porPuesto = new Map<string, { puesto: LineaNueva['puesto']; lineas: LineaNueva[] }>();
    for (const l of d.lineas) {
      if (productos.has(l.productoId)) throw new ErrorDeValidacion('El mismo producto no puede repetirse en el pedido.');
      productos.add(l.productoId);
      textoObligatorio(l.puesto.id, 'El puesto');
      textoObligatorio(l.puesto.codigo, 'El código del puesto');
      textoObligatorio(l.puesto.nombre, 'El nombre del puesto');
      const grupo = porPuesto.get(l.puesto.id);
      if (!grupo) porPuesto.set(l.puesto.id, { puesto: l.puesto, lineas: [l] });
      else if (grupo.puesto.codigo !== l.puesto.codigo || grupo.puesto.nombre !== l.puesto.nombre) throw new ErrorDeValidacion('El mismo puesto aparece con datos distintos.');
      else grupo.lineas.push(l);
    }

    const subpedidos = [...porPuesto.entries()]
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([puestoId, g]) =>
        Subpedido.crear({
          id: nuevoId(),
          puestoId,
          puesto: g.puesto,
          lineas: [...g.lineas].sort((a, b) => (a.productoId < b.productoId ? -1 : 1)).map((l) => LineaPedido.crear(nuevoId(), l)),
          clienteId: d.clienteId,
          creadoEn: d.creadoEn,
        }),
      );
    return new Pedido(d.id, null, d.clienteId, d.claveIdempotencia, d.carritoId, d.huellaCarrito, new Date(d.reservaVenceEn), new Date(d.creadoEn), subpedidos);
  }

  /**
   * Rearma un pedido leído de la persistencia validando su coherencia: importes (línea = precio × cantidad, subpedido =
   * Σ líneas, total = Σ subpedidos), un subpedido por puesto, productos sin repetir e historial encadenado. Cualquier
   * incoherencia lanza `ReconstitucionInvalidaError` (fallo inesperado) con la causa original.
   */
  static reconstituir(d: DatosReconstitucionPedido): Pedido {
    try {
      if (!esCodigoPedidoValido(d.codigo)) throw new Error('código con formato inválido');
      textoObligatorio(d.id, 'El identificador del pedido');
      textoObligatorio(d.clienteId, 'El cliente');
      textoObligatorio(d.carritoId, 'El carrito');
      if (!CLAVE.test(d.claveIdempotencia) || !HUELLA.test(d.huellaCarrito)) throw new Error('clave o huella con formato inválido');
      if (!fechaValida(d.creadoEn) || !fechaValida(d.reservaVenceEn)) throw new Error('fechas inválidas');
      if (d.subpedidos.length === 0) throw new Error('pedido sin subpedidos');
      const puestos = new Set<string>();
      const productos = new Set<string>();
      const subpedidos = [...d.subpedidos]
        .sort((a, b) => (a.puestoId < b.puestoId ? -1 : 1))
        .map((s) => {
          if (puestos.has(s.puestoId)) throw new Error('dos subpedidos del mismo puesto');
          puestos.add(s.puestoId);
          const lineas = [...s.lineas]
            .sort((a, b) => (a.productoId < b.productoId ? -1 : 1))
            .map((l) => {
              if (productos.has(l.productoId)) throw new Error('producto repetido en el pedido');
              productos.add(l.productoId);
              const lp = LineaPedido.crear(l.id, { ...l, puesto: { id: s.puestoId, ...s.puesto } });
              if (lp.subtotalCentimos !== l.subtotalCentimos) throw new Error(`subtotal de línea ${l.subtotalCentimos} ≠ precio × cantidad ${lp.subtotalCentimos}`);
              return lp;
            });
          const sp = Subpedido.reconstituir({ id: s.id, puestoId: s.puestoId, puesto: s.puesto, estado: s.estado, lineas, historial: s.historial });
          if (sp.subtotalCentimos !== s.subtotalCentimos) throw new Error(`subtotal de subpedido ${s.subtotalCentimos} ≠ Σ líneas ${sp.subtotalCentimos}`);
          return sp;
        });
      if (productos.size > MAX_LINEAS_PEDIDO) throw new Error('más líneas que el máximo');
      const p = new Pedido(d.id, d.codigo, d.clienteId, d.claveIdempotencia, d.carritoId, d.huellaCarrito, new Date(d.reservaVenceEn), new Date(d.creadoEn), subpedidos);
      if (p.totalCentimos !== d.totalCentimos) throw new Error(`total persistido ${d.totalCentimos} ≠ Σ subtotales ${p.totalCentimos}`);
      return p;
    } catch (e) {
      throw new ReconstitucionInvalidaError(e instanceof Error ? e.message : String(e), { cause: e });
    }
  }

  /** El código lo asigna la persistencia al insertar (puede reintentarse ante colisión). Una sola vez. */
  conCodigo(codigo: string): Pedido {
    if (!esCodigoPedidoValido(codigo)) throw new ErrorDeValidacion('El código del pedido no tiene el formato PED-XXXXXXXX.');
    if (this.codigo !== null) throw new ErrorDeValidacion('El pedido ya tiene código.');
    return new Pedido(this.id, codigo, this.clienteId, this.claveIdempotencia, this.carritoId, this.huellaCarrito, this.reservaVenceEn, this.creadoEn, this.subpedidos);
  }

  /** Derivado, nunca persistido (Q3). */
  get estadoGeneral(): EstadoGeneral {
    return estadoGeneral(this.subpedidos.map((s) => s.estado));
  }
}
