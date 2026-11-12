import type { EstadoSubpedido } from './estado-subpedido.js';

export const ESTADO_MIXTO = 'MIXTO';
export type EstadoGeneral = EstadoSubpedido | typeof ESTADO_MIXTO;

/** Estado derivado del pedido (Q3): el común de sus subpedidos o `MIXTO`. Nunca se persiste. */
export function estadoGeneral(estados: readonly EstadoSubpedido[]): EstadoGeneral {
  const [primero, ...resto] = estados;
  if (primero === undefined) throw new Error('Un pedido sin subpedidos no tiene estado general.');
  return resto.every((e) => e === primero) ? primero : ESTADO_MIXTO;
}
