import { describe, expect, it } from 'vitest';
import { ESTADOS_SUBPEDIDO, EstadoSubpedido, puedeTransicionar } from './estado-subpedido.js';

const E = EstadoSubpedido;
/** Tabla de C4 N4 §3 / data-model §4: ÚNICAS transiciones válidas. */
const VALIDAS: [string, string][] = [
  [E.ESPERANDO_PAGO, E.PAGO_APROBADO],
  [E.ESPERANDO_PAGO, E.EXPIRADO],
  [E.ESPERANDO_PAGO, E.CANCELADO],
  [E.PAGO_APROBADO, E.EN_PREPARACION],
  [E.PAGO_APROBADO, E.CANCELADO],
  [E.EN_PREPARACION, E.LISTO_PARA_RETIRO],
  [E.EN_PREPARACION, E.CANCELADO],
  [E.LISTO_PARA_RETIRO, E.ENTREGADO],
  [E.EXPIRADO, E.PAGO_APROBADO],
];

describe('EstadoSubpedido', () => {
  it('es exactamente la enumeración aprobada: siete estados y sin MIXTO', () => {
    expect([...ESTADOS_SUBPEDIDO].sort()).toEqual(
      ['CANCELADO', 'ENTREGADO', 'EN_PREPARACION', 'ESPERANDO_PAGO', 'EXPIRADO', 'LISTO_PARA_RETIRO', 'PAGO_APROBADO'],
    );
    expect(ESTADOS_SUBPEDIDO as readonly string[]).not.toContain('MIXTO');
  });

  it.each(VALIDAS)('permite %s → %s', (desde, hacia) => {
    expect(puedeTransicionar(desde as never, hacia as never)).toBe(true);
  });

  it('rechaza TODAS las demás combinaciones (49 − 9 = 40), incluida la transición a sí mismo', () => {
    const permitidas = new Set(VALIDAS.map(([d, h]) => `${d}>${h}`));
    let rechazadas = 0;
    for (const d of ESTADOS_SUBPEDIDO) {
      for (const h of ESTADOS_SUBPEDIDO) {
        if (permitidas.has(`${d}>${h}`)) continue;
        expect(puedeTransicionar(d, h), `${d} → ${h}`).toBe(false);
        rechazadas++;
      }
    }
    expect(rechazadas).toBe(40);
  });

  it('ENTREGADO y CANCELADO no tienen salida; EXPIRADO solo sale por la aprobación tardía', () => {
    for (const h of ESTADOS_SUBPEDIDO) {
      expect(puedeTransicionar(E.ENTREGADO, h)).toBe(false);
      expect(puedeTransicionar(E.CANCELADO, h)).toBe(false);
    }
    expect(ESTADOS_SUBPEDIDO.filter((h) => puedeTransicionar(E.EXPIRADO, h))).toEqual([E.PAGO_APROBADO]);
  });

  it('no se puede saltar etapas (p. ej. ESPERANDO_PAGO → ENTREGADO) ni retroceder', () => {
    expect(puedeTransicionar(E.ESPERANDO_PAGO, E.ENTREGADO)).toBe(false);
    expect(puedeTransicionar(E.ESPERANDO_PAGO, E.EN_PREPARACION)).toBe(false);
    expect(puedeTransicionar(E.EN_PREPARACION, E.PAGO_APROBADO)).toBe(false);
    expect(puedeTransicionar(E.LISTO_PARA_RETIRO, E.EN_PREPARACION)).toBe(false);
  });

  it('un valor que no es un estado nunca es transición válida', () => {
    expect(puedeTransicionar('MIXTO' as never, E.ENTREGADO)).toBe(false);
    expect(puedeTransicionar(E.ESPERANDO_PAGO, 'MIXTO' as never)).toBe(false);
    expect(puedeTransicionar('x' as never, 'y' as never)).toBe(false);
    expect(puedeTransicionar('toString' as never, 'constructor' as never)).toBe(false);
  });
});
