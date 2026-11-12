/**
 * Unidad de trabajo sobre Prisma (spec 003-pedidos-subpedidos; POC-001 aprobada, integrada en T001).
 *
 * - `db`: transacción vigente o, si no hay, el cliente base.
 * - `atomico()`: se une a la unidad vigente (sin reintento propio); fuera de una unidad abre su propia transacción con el
 *   reintento que ya usaban Inventario y Carrito (5 intentos, espera `10 ms × n`, relanza el error original).
 * - `unidadDeTrabajo()`: límite de transacción. Reintenta el bloque COMPLETO (máx. 5 intentos en total) solo ante errores
 *   transitorios; al agotarlos lanza `ErrorServicioNoDisponible` conservando la causa original. Dentro de una unidad vigente se une.
 *
 * Las operaciones están como FUNCIONES que reciben el cliente (además de la clase y de los métodos de `PrismaService`):
 * así los repositorios existentes, los scripts y las pruebas que construyen el repositorio con un `PrismaClient` simple
 * siguen funcionando sin cambios. Regla para repositorios: toda sentencia usa `db` o `atomico()`; nunca el cliente base
 * mientras haya una unidad vigente (`PrismaService` lo impide).
 */
import type { PrismaClient } from '../../../generated/prisma/client.js';
import { ErrorServicioNoDisponible } from '../../domain/errors.js';
import { type ClienteTransaccional, ejecutarEnContexto, transaccionVigente } from './contexto-transaccional.js';
import { esTransitorio } from './errores-transitorios.js';

export interface PoliticaReintento {
  /** Intentos TOTALES (no reintentos). */
  readonly maxIntentos: number;
  /** Espera antes del intento n+1: `esperaBaseMs × n`. */
  readonly esperaBaseMs: number;
}
export interface OpcionesTransaccion {
  readonly maxWait?: number;
  readonly timeout?: number;
}

export const POLITICA_POR_DEFECTO: PoliticaReintento = { maxIntentos: 5, esperaBaseMs: 10 };
/** Mismas opciones que usan los repositorios de Inventario y Carrito: esperar una conexión del pool ante ráfagas no debe fallar. */
export const OPCIONES_TX_POR_DEFECTO: OpcionesTransaccion = { maxWait: 20_000, timeout: 15_000 };

const esperar = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** Cliente de la transacción vigente o, si no hay unidad, el cliente base indicado. */
export function db(cliente: PrismaClient): ClienteTransaccional | PrismaClient {
  return transaccionVigente() ?? cliente;
}

/** Se une a la unidad vigente (sin reintento propio); fuera de ella, transacción corta con el reintento vigente. */
export async function atomico<T>(
  cliente: PrismaClient,
  trabajo: (tx: ClienteTransaccional) => Promise<T>,
  opciones: OpcionesTransaccion = OPCIONES_TX_POR_DEFECTO,
  politica: PoliticaReintento = POLITICA_POR_DEFECTO,
): Promise<T> {
  const activa = transaccionVigente();
  if (activa) return trabajo(activa);
  for (let intento = 0; ; intento++) {
    try {
      return await cliente.$transaction(trabajo, { ...opciones });
    } catch (e) {
      if (intento >= politica.maxIntentos - 1 || !esTransitorio(e)) throw e;
      await esperar(politica.esperaBaseMs * (intento + 1));
    }
  }
}

/** Límite de transacción: reintenta toda la unidad ante errores transitorios; se une si ya hay una vigente. */
export async function unidadDeTrabajo<T>(
  cliente: PrismaClient,
  trabajo: () => Promise<T>,
  opciones: OpcionesTransaccion = OPCIONES_TX_POR_DEFECTO,
  politica: PoliticaReintento = POLITICA_POR_DEFECTO,
): Promise<T> {
  if (transaccionVigente()) return trabajo();
  for (let intento = 0; ; intento++) {
    try {
      return await cliente.$transaction((tx) => ejecutarEnContexto(tx, trabajo), { ...opciones });
    } catch (e) {
      if (!esTransitorio(e)) throw e;
      if (intento >= politica.maxIntentos - 1) {
        const agotado = new ErrorServicioNoDisponible('El servicio no pudo completar la operación; intente de nuevo.');
        agotado.cause = e; // se conserva la causa original (último error transitorio) para el diagnóstico
        throw agotado;
      }
      await esperar(politica.esperaBaseMs * (intento + 1));
    }
  }
}

/** Fachada con estado (cliente, política y opciones); `PrismaService` la compone. */
export class UnidadDeTrabajoPrisma {
  constructor(
    private readonly cliente: PrismaClient,
    private readonly politica: PoliticaReintento = POLITICA_POR_DEFECTO,
    private readonly opcionesTx: OpcionesTransaccion = OPCIONES_TX_POR_DEFECTO,
  ) {}

  /** Transacción vigente o cliente base. Lanza si se usa después de terminar la unidad. */
  get db(): ClienteTransaccional | PrismaClient {
    return db(this.cliente);
  }

  atomico<T>(trabajo: (tx: ClienteTransaccional) => Promise<T>, opciones: OpcionesTransaccion = this.opcionesTx): Promise<T> {
    return atomico(this.cliente, trabajo, opciones, this.politica);
  }

  unidadDeTrabajo<T>(trabajo: () => Promise<T>): Promise<T> {
    return unidadDeTrabajo(this.cliente, trabajo, this.opcionesTx, this.politica);
  }
}
