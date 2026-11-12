/**
 * (research D2; POC-001 aprobada, integrado en T001). Clasifica los errores que justifican reintentar la UNIDAD DE TRABAJO COMPLETA.
 *
 * Transitorios: SQLSTATE `40P01` (interbloqueo), `40001` (fallo de serialización) y el código de Prisma `P2034`.
 * NO transitorios: errores de dominio, de integridad (`23xxx`), tiempos agotados, cancelaciones y pérdida de conexión
 * (tras una caída el COMMIT pudo ejecutarse: el reintento seguro lo hace el cliente con la misma clave de idempotencia).
 *
 * Prisma y el adaptador envuelven los errores del servidor, por lo que el código se busca en la cadena de causas y en
 * `meta`, y como último recurso en el mensaje.
 */
import { ErrorDeDominio } from '../../domain/errors.js';

const SQLSTATE_TRANSITORIOS = new Set(['40P01', '40001']);
const PRISMA_TRANSITORIOS = new Set(['P2034']);
const PROFUNDIDAD_MAXIMA = 5;
const MENSAJE_TRANSITORIO = /deadlock detected|could not serialize access|40P01|40001/i;

/** Recorre el objeto (sin ciclos) y reúne los valores de texto de las propiedades de código y los mensajes. */
function recolectar(error: unknown, codigos: Set<string>, mensajes: string[], vistos: Set<unknown>, profundidad: number): void {
  if (error === null || typeof error !== 'object' || vistos.has(error) || profundidad > PROFUNDIDAD_MAXIMA) return;
  vistos.add(error);
  for (const [clave, valor] of Object.entries(error as Record<string, unknown>)) {
    if (typeof valor === 'string') {
      if (/code|state|kind/i.test(clave)) codigos.add(valor);
    } else if (typeof valor === 'object') {
      recolectar(valor, codigos, mensajes, vistos, profundidad + 1);
    }
  }
  const e = error as { message?: unknown; cause?: unknown };
  if (typeof e.message === 'string') mensajes.push(e.message);
  if (e.cause) recolectar(e.cause, codigos, mensajes, vistos, profundidad + 1);
}

export function codigosDelError(error: unknown): string[] {
  const codigos = new Set<string>();
  recolectar(error, codigos, [], new Set(), 0);
  return [...codigos];
}

export function esTransitorio(error: unknown): boolean {
  if (error instanceof ErrorDeDominio) return false;
  const codigos = new Set<string>();
  const mensajes: string[] = [];
  recolectar(error, codigos, mensajes, new Set(), 0);
  for (const c of codigos) if (SQLSTATE_TRANSITORIOS.has(c) || PRISMA_TRANSITORIOS.has(c)) return true;
  // Un error de integridad explícito nunca es transitorio, aunque su mensaje contenga texto parecido.
  for (const c of codigos) if (/^23[0-9A-Z]{3}$/.test(c)) return false;
  return mensajes.some((m) => MENSAJE_TRANSITORIO.test(m));
}
