import { describe, expect, it } from 'vitest';
import { estadoGeneral } from './estado-general.js';
import { ESTADOS_SUBPEDIDO, EstadoSubpedido } from './estado-subpedido.js';

describe('estadoGeneral (derivado, Q3 · CA-O25)', () => {
  it.each(ESTADOS_SUBPEDIDO)('si todos los subpedidos están en %s, ese es el estado general', (e) => {
    expect(estadoGeneral([e])).toBe(e);
    expect(estadoGeneral([e, e, e])).toBe(e);
  });

  it('si al menos dos difieren, es MIXTO (en cualquier orden)', () => {
    const { ESPERANDO_PAGO: a, PAGO_APROBADO: b, ENTREGADO: c } = EstadoSubpedido;
    expect(estadoGeneral([a, b])).toBe('MIXTO');
    expect(estadoGeneral([b, a])).toBe('MIXTO');
    expect(estadoGeneral([a, a, c])).toBe('MIXTO');
    expect(estadoGeneral([c, a, a])).toBe('MIXTO');
    expect(estadoGeneral([a, b, c])).toBe('MIXTO');
  });

  it('MIXTO no es un estado de subpedido', () => {
    expect(ESTADOS_SUBPEDIDO as readonly string[]).not.toContain('MIXTO');
  });

  it('un pedido sin subpedidos no tiene estado general', () => {
    expect(() => estadoGeneral([])).toThrow();
  });

  it('no modifica la lista recibida', () => {
    const l = [EstadoSubpedido.EXPIRADO, EstadoSubpedido.CANCELADO];
    estadoGeneral(l);
    expect(l).toEqual(['EXPIRADO', 'CANCELADO']);
  });
});
