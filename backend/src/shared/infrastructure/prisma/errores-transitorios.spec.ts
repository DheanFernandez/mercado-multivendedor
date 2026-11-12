import { describe, expect, it } from 'vitest';
import { ErrorDeConflicto, ErrorDeValidacion, ErrorServicioNoDisponible } from '../../domain/errors.js';
import { esTransitorio } from './errores-transitorios.js';

const conCodigo = (mensaje: string, extra: Record<string, unknown>) => Object.assign(new Error(mensaje), extra);

describe('esTransitorio (POC-001 · research D2)', () => {
  it.each([
    ['SQLSTATE 40P01 directo', conCodigo('x', { code: '40P01' })],
    ['SQLSTATE 40001 directo', conCodigo('x', { code: '40001' })],
    ['Prisma P2034', conCodigo('Transaction failed due to a write conflict or a deadlock', { code: 'P2034' })],
    ['código anidado en meta', conCodigo('x', { code: 'P2010', meta: { code: '40P01', message: 'deadlock detected' } })],
    ['código en la cadena de causas', conCodigo('x', { cause: { originalCode: '40001' } })],
    ['código en un adaptador de controlador', conCodigo('x', { cause: { cause: { kind: 'postgres', code: '40P01' } } })],
    ['solo el mensaje', new Error('ERROR: deadlock detected')],
    ['solo el mensaje de serialización', new Error('could not serialize access due to concurrent update')],
  ])('es transitorio: %s', (_n, e) => expect(esTransitorio(e)).toBe(true));

  it.each([
    ['error de dominio (conflicto)', new ErrorDeConflicto('sin stock')],
    ['error de dominio (validación)', new ErrorDeValidacion('mal')],
    ['servicio no disponible (ya es el resultado de agotar reintentos)', new ErrorServicioNoDisponible('x')],
    ['única 23505', conCodigo('duplicate key', { code: '23505' })],
    ['clave foránea 23503', conCodigo('x', { code: 'P2010', meta: { code: '23503' } })],
    ['check 23514', conCodigo('x', { cause: { code: '23514' } })],
    ['23505 con mensaje parecido', conCodigo('serialization deadlock detected en un texto', { code: '23505' })],
    ['tiempo agotado P2028', conCodigo('Transaction API error', { code: 'P2028' })],
    ['cancelación 57014', conCodigo('x', { code: '57014' })],
    ['pérdida de conexión', conCodigo('Connection terminated unexpectedly', { code: 'ECONNRESET' })],
    ['error genérico', new Error('boom')],
    ['valor no objeto', 'texto'],
    ['null', null],
  ])('NO es transitorio: %s', (_n, e) => expect(esTransitorio(e)).toBe(false));

  it('tolera referencias circulares', () => {
    const a: Record<string, unknown> = { code: 'X' };
    a['yo'] = a;
    expect(esTransitorio(a)).toBe(false);
    const b = new Error('x') as Error & { cause?: unknown };
    b.cause = b;
    expect(esTransitorio(b)).toBe(false);
  });
});
