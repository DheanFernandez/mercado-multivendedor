/** Enumeración aprobada `EstadoPedidoPuesto` (C4 N4 §3). `MIXTO` NO forma parte: es solo una representación de consulta. */
export const EstadoSubpedido = {
  ESPERANDO_PAGO: 'ESPERANDO_PAGO',
  PAGO_APROBADO: 'PAGO_APROBADO',
  EN_PREPARACION: 'EN_PREPARACION',
  LISTO_PARA_RETIRO: 'LISTO_PARA_RETIRO',
  ENTREGADO: 'ENTREGADO',
  EXPIRADO: 'EXPIRADO',
  CANCELADO: 'CANCELADO',
} as const;
export type EstadoSubpedido = (typeof EstadoSubpedido)[keyof typeof EstadoSubpedido];
export const ESTADOS_SUBPEDIDO: readonly EstadoSubpedido[] = Object.values(EstadoSubpedido);

const E = EstadoSubpedido;
/** Únicas transiciones válidas (data-model §4). */
const TRANSICIONES: ReadonlyMap<EstadoSubpedido, readonly EstadoSubpedido[]> = new Map([
  [E.ESPERANDO_PAGO, [E.PAGO_APROBADO, E.EXPIRADO, E.CANCELADO]],
  [E.PAGO_APROBADO, [E.EN_PREPARACION, E.CANCELADO]],
  [E.EN_PREPARACION, [E.LISTO_PARA_RETIRO, E.CANCELADO]],
  [E.LISTO_PARA_RETIRO, [E.ENTREGADO]],
  [E.EXPIRADO, [E.PAGO_APROBADO]],
  [E.ENTREGADO, []],
  [E.CANCELADO, []],
]);

export const esEstadoSubpedido = (v: unknown): v is EstadoSubpedido => typeof v === 'string' && ESTADOS_SUBPEDIDO.includes(v as EstadoSubpedido);

export function puedeTransicionar(desde: EstadoSubpedido, hacia: EstadoSubpedido): boolean {
  return TRANSICIONES.get(desde)?.includes(hacia) ?? false;
}
