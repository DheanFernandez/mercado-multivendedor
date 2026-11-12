import { ErrorDeValidacion } from '../../../shared/domain/errors.js';
import { TransicionEstadoInvalidaError } from './errors.js';
import { EstadoSubpedido, esEstadoSubpedido, puedeTransicionar } from './estado-subpedido.js';
import type { LineaPedido } from './linea-pedido.js';

/** Origen del registro inicial (C4 N4 §3). */
export const ORIGEN_CREAR_PEDIDO = 'CREAR_PEDIDO';

export interface EntradaHistorial {
  readonly estadoAnterior: EstadoSubpedido | null;
  readonly estadoNuevo: EstadoSubpedido;
  readonly origen: string;
  readonly actorId: string | null;
  readonly creadoEn: Date;
}
export interface CambioEstado {
  origen: string;
  actorId: string | null;
  creadoEn: Date;
}

const fechaValida = (d: unknown): d is Date => d instanceof Date && !Number.isNaN(d.getTime());

function entrada(anterior: EstadoSubpedido | null, nuevo: EstadoSubpedido, c: CambioEstado): EntradaHistorial {
  if (typeof c.origen !== 'string' || c.origen.length < 1 || c.origen.length > 50) throw new ErrorDeValidacion('El origen del cambio debe tener entre 1 y 50 caracteres.');
  if (!fechaValida(c.creadoEn)) throw new ErrorDeValidacion('La fecha del cambio no es válida.');
  return Object.freeze({ estadoAnterior: anterior, estadoNuevo: nuevo, origen: c.origen, actorId: c.actorId, creadoEn: new Date(c.creadoEn) });
}

/** Parte del pedido correspondiente a un puesto. Líneas e importes inmutables; el estado solo cambia por `transicionar`. */
export class Subpedido {
  readonly subtotalCentimos: number;

  private constructor(
    readonly id: string,
    readonly puestoId: string,
    readonly puesto: { readonly codigo: string; readonly nombre: string },
    readonly estado: EstadoSubpedido,
    readonly lineas: readonly LineaPedido[],
    readonly historial: readonly EntradaHistorial[],
  ) {
    this.subtotalCentimos = lineas.reduce((a, l) => a + l.subtotalCentimos, 0);
    Object.freeze(this.puesto);
    Object.freeze(this.lineas);
    Object.freeze(this.historial);
    Object.freeze(this);
  }

  /** Nace en `ESPERANDO_PAGO` con su registro inicial (anterior = null). */
  static crear(d: { id: string; puestoId: string; puesto: { codigo: string; nombre: string }; lineas: readonly LineaPedido[]; clienteId: string; creadoEn: Date }): Subpedido {
    if (d.lineas.length === 0) throw new ErrorDeValidacion('Un subpedido necesita al menos una línea.');
    const inicial = entrada(null, EstadoSubpedido.ESPERANDO_PAGO, { origen: ORIGEN_CREAR_PEDIDO, actorId: d.clienteId, creadoEn: d.creadoEn });
    return new Subpedido(d.id, d.puestoId, { codigo: d.puesto.codigo, nombre: d.puesto.nombre }, EstadoSubpedido.ESPERANDO_PAGO, [...d.lineas], [inicial]);
  }

  /**
   * Rearma un subpedido persistido. Exige un historial encadenado desde (null → ESPERANDO_PAGO) con transiciones del
   * diagrama y cuyo último estado sea el actual. Lanza `Error` simple: `Pedido.reconstituir` lo envuelve.
   */
  static reconstituir(d: { id: string; puestoId: string; puesto: { codigo: string; nombre: string }; estado: EstadoSubpedido; lineas: readonly LineaPedido[]; historial: readonly EntradaHistorial[] }): Subpedido {
    if (!esEstadoSubpedido(d.estado)) throw new Error(`estado desconocido «${String(d.estado)}»`);
    if (d.lineas.length === 0) throw new Error('subpedido sin líneas');
    const [inicial, ...resto] = d.historial;
    if (!inicial || inicial.estadoAnterior !== null || inicial.estadoNuevo !== EstadoSubpedido.ESPERANDO_PAGO) throw new Error('el historial no empieza en (null → ESPERANDO_PAGO)');
    const historial = [entrada(null, inicial.estadoNuevo, inicial)];
    for (const h of resto) {
      const previo = historial[historial.length - 1]!.estadoNuevo;
      if (h.estadoAnterior !== previo || !esEstadoSubpedido(h.estadoNuevo) || !puedeTransicionar(previo, h.estadoNuevo)) {
        throw new Error(`historial roto o fuera del diagrama: ${String(h.estadoAnterior)} → ${String(h.estadoNuevo)}`);
      }
      historial.push(entrada(previo, h.estadoNuevo, h));
    }
    if (historial[historial.length - 1]!.estadoNuevo !== d.estado) throw new Error('el estado no coincide con el último del historial');
    return new Subpedido(d.id, d.puestoId, { codigo: d.puesto.codigo, nombre: d.puesto.nombre }, d.estado, [...d.lineas], historial);
  }

  /** Devuelve un subpedido nuevo en el estado indicado con su entrada de historial; solo las transiciones aprobadas. */
  transicionar(nuevo: EstadoSubpedido, cambio: CambioEstado): Subpedido {
    if (!esEstadoSubpedido(nuevo) || !puedeTransicionar(this.estado, nuevo)) throw new TransicionEstadoInvalidaError(this.estado, String(nuevo));
    const e = entrada(this.estado, nuevo, cambio);
    return new Subpedido(this.id, this.puestoId, this.puesto, nuevo, this.lineas, [...this.historial, e]);
  }
}
