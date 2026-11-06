import { ErrorDeValidacion } from '../domain/errors.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const esUuid = (v: unknown): v is string => typeof v === 'string' && UUID.test(v);

export interface Pagina<T> {
  datos: T[];
  pagina: number;
  limite: number;
  total: number;
  totalPaginas: number;
}

export function paginar(pagina = 1, limite = 20, maxLimite = 50): { pagina: number; limite: number; desplazamiento: number } {
  if (!Number.isInteger(pagina) || pagina < 1 || pagina > 100000) throw new ErrorDeValidacion('La página no es válida.');
  if (!Number.isInteger(limite) || limite < 1 || limite > maxLimite) throw new ErrorDeValidacion(`El límite debe estar entre 1 y ${maxLimite}.`);
  return { pagina, limite, desplazamiento: (pagina - 1) * limite };
}
