import { ErrorDeValidacion } from '../../../shared/domain/errors.js';

/** 32 caracteres legibles: sin `I`, `L`, `O` ni `U` (research D5). */
export const ALFABETO_CODIGO = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
export const PREFIJO_CODIGO = 'PED-';
export const LONGITUD_SUFIJO_CODIGO = 8;

const FORMATO = /^PED-[0-9A-HJKMNP-TV-Z]{8}$/;

export const esCodigoPedidoValido = (v: unknown): v is string => typeof v === 'string' && FORMATO.test(v);

/**
 * `PED-` + 8 caracteres. La aleatoriedad se inyecta: `aleatorio(n)` devuelve un entero en [0, n). La infraestructura
 * le pasa una fuente criptográfica; las pruebas, una determinista.
 */
export function generarCodigoPedido(aleatorio: (maximoExclusivo: number) => number): string {
  let sufijo = '';
  for (let i = 0; i < LONGITUD_SUFIJO_CODIGO; i++) {
    const n = aleatorio(ALFABETO_CODIGO.length);
    if (!Number.isInteger(n) || n < 0 || n >= ALFABETO_CODIGO.length) throw new ErrorDeValidacion('La fuente aleatoria entregó un valor fuera de rango.');
    sufijo += ALFABETO_CODIGO[n];
  }
  return PREFIJO_CODIGO + sufijo;
}
