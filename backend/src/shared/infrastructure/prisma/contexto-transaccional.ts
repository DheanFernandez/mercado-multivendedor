/**
 * Contexto de la transacción activa (spec 003-pedidos-subpedidos, research D1; POC-001 aprobada, integrado en T001) basado en `AsyncLocalStorage`.
 *
 * Reglas de diseño:
 * - Solo `run` (nunca `enterWith`): el contexto queda limitado a la callback y no se filtra al resto de la cadena.
 * - Cada unidad crea su PROPIO almacén: dos solicitudes concurrentes nunca comparten transacción.
 * - El almacén lleva una bandera de vigencia que se apaga al terminar la unidad. Un acceso posterior (p. ej. desde una
 *   promesa que sobrevivió al commit) FALLA de inmediato en lugar de usar el pool, lo que rompería la atomicidad.
 *
 * Es infraestructura compartida: no depende de ningún módulo de negocio.
 */
import { AsyncLocalStorage } from 'node:async_hooks';
import type { Prisma } from '../../../generated/prisma/client.js';

export type ClienteTransaccional = Prisma.TransactionClient;

interface Almacen {
  readonly id: number;
  readonly tx: ClienteTransaccional;
  vigente: boolean;
}

/** Se usó el contexto transaccional después de que la unidad terminó (commit, rollback o error). */
export class ContextoFueraDeVigenciaError extends Error {
  constructor() {
    super('La transacción de la unidad de trabajo ya terminó: no puede usarse su contexto.');
    this.name = 'ContextoFueraDeVigenciaError';
  }
}

/** Se usó el cliente base de Prisma mientras había una unidad de trabajo vigente (rompería la atomicidad). */
export class ClienteBaseEnUnidadError extends Error {
  constructor(readonly operacion: string) {
    super(`No se puede usar el cliente base de Prisma («${operacion}») dentro de una unidad de trabajo: use \`prisma.db\` o \`prisma.atomico()\` para participar de la transacción.`);
    this.name = 'ClienteBaseEnUnidadError';
  }
}

const almacenamiento = new AsyncLocalStorage<Almacen>();
let secuencia = 0;

/** Ejecuta `trabajo` con `tx` como transacción activa y la marca fuera de vigencia al terminar. */
export function ejecutarEnContexto<T>(tx: ClienteTransaccional, trabajo: () => Promise<T>): Promise<T> {
  const almacen: Almacen = { id: ++secuencia, tx, vigente: true };
  return almacenamiento.run(almacen, async () => {
    try {
      return await trabajo();
    } finally {
      almacen.vigente = false;
    }
  });
}

/**
 * Transacción activa de la cadena asíncrona actual. `undefined` si no hay unidad de trabajo;
 * lanza `ContextoFueraDeVigenciaError` si hubo una y ya terminó.
 */
export function transaccionVigente(): ClienteTransaccional | undefined {
  const almacen = almacenamiento.getStore();
  if (!almacen) return undefined;
  if (!almacen.vigente) throw new ContextoFueraDeVigenciaError();
  return almacen.tx;
}

/** Identificador del almacén activo (diagnóstico y pruebas de aislamiento); `undefined` fuera de una unidad. */
export function identidadContexto(): number | undefined {
  return almacenamiento.getStore()?.id;
}

/** Falla si hay una unidad de trabajo vigente (o terminada que aún tiene el contexto): usado por el resguardo del cliente base. */
export function exigirSinUnidadVigente(operacion: string): void {
  if (transaccionVigente()) throw new ClienteBaseEnUnidadError(operacion);
}
