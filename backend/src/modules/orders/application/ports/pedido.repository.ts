import { ErrorDeConflicto, ErrorServicioNoDisponible } from '../../../../shared/domain/errors.js';
import type { EstadoGeneral } from '../../domain/estado-general.js';
import type { EstadoSubpedido } from '../../domain/estado-subpedido.js';
import type { Pedido } from '../../domain/pedido.entity.js';

/** Máximo de códigos generados por inserción ante colisiones (research D5). No consume intentos de la transacción. */
export const MAX_INTENTOS_CODIGO = 5;

/** Se agotaron los códigos por colisión (503). No es transitorio: la unidad no se reintenta. */
export class CodigoPedidoNoGenerableError extends ErrorServicioNoDisponible {
  constructor() {
    super('No se pudo generar un código de pedido único; intente de nuevo.');
  }
}

/**
 * La restricción única `(cliente, clave)` rechazó la inserción: otra operación con la misma clave se confirmó a la vez.
 * Con el bloqueo por cliente no debería ocurrir; es la red de seguridad (research D4). NO es una colisión de código:
 * no consume intentos de código. Conserva la causa original.
 */
export class ClaveIdempotenciaEnUsoError extends ErrorDeConflicto {
  constructor(opciones?: { cause?: unknown }) {
    super('Ya existe un pedido con esa clave de operación.');
    if (opciones?.cause !== undefined) this.cause = opciones.cause;
  }
}

export interface ResumenPedido {
  id: string;
  codigo: string;
  creadoEn: Date;
  estadoGeneral: EstadoGeneral;
  totalCentimos: number;
  cantidadSubpedidos: number;
}

export interface EntradaHistorialPedido {
  subpedidoId: string;
  puesto: { codigo: string; nombre: string };
  estadoAnterior: EstadoSubpedido | null;
  estadoNuevo: EstadoSubpedido;
  origen: string;
  creadoEn: Date;
}

export interface Paginacion {
  limite: number;
  desplazamiento: number;
}

/** Persistencia de Pedidos (contracts §4). Las escrituras y el bloqueo solo dentro de una unidad de trabajo. */
export interface PedidoRepository {
  /** Serializa las creaciones del cliente (bloqueo consultivo transaccional); solo dentro de la unidad. */
  bloquearCliente(clienteId: string): Promise<void>;
  /** Pedido del cliente con esa clave de operación, o null. */
  buscarPorClave(clienteId: string, clave: string): Promise<Pedido | null>;
  /**
   * Inserta la raíz y le asigna el código `PED-XXXXXXXX`; ante colisión genera otro (≤ `MAX_INTENTOS_CODIGO`) sin error ni
   * reintento de la transacción; agotado ⇒ `CodigoPedidoNoGenerableError`. Devuelve el pedido CON su código (el dominio es
   * inmutable: `Pedido.conCodigo` produce una instancia nueva).
   */
  insertar(pedido: Pedido): Promise<Pedido>;
  /** Subpedidos, líneas e historial inicial del pedido ya insertado. */
  guardarDetalle(pedido: Pedido): Promise<void>;
  /** null si no existe o es de otro cliente. */
  buscarPorId(clienteId: string, id: string): Promise<Pedido | null>;
  /** Del más reciente al más antiguo. */
  listar(clienteId: string, f: Paginacion): Promise<{ items: ResumenPedido[]; total: number }>;
  /** Orden cronológico ascendente; null si el pedido no existe o es de otro cliente. */
  historial(clienteId: string, id: string, f: Paginacion): Promise<{ items: EntradaHistorialPedido[]; total: number } | null>;
}

export const PEDIDO_REPOSITORY = Symbol('PEDIDO_REPOSITORY');
