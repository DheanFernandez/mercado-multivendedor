/**
 * T012 · Reconstitución del agregado desde la persistencia. El repositorio Prisma devuelve `Pedido` (puerto de T009), y el
 * dominio solo sabía CREARLO; `Pedido.reconstituir` lo rearma validando que lo leído es coherente. Una incoherencia es un
 * fallo inesperado (dato corrupto o defecto), NO un error de dominio: no se traduce a 4xx.
 */
import { describe, expect, it } from 'vitest';
import { ErrorDeDominio } from '../../../shared/domain/errors.js';
import { ReconstitucionInvalidaError } from './errors.js';
import { EstadoSubpedido } from './estado-subpedido.js';
import { Pedido, type DatosReconstitucionPedido, type LineaNueva } from './pedido.entity.js';

const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const AHORA = new Date('2026-11-06T10:00:00.000Z');
const puesto = (n: number) => ({ id: uuid(100 + n), codigo: `P-${n}`, nombre: `Puesto ${n}` });
const linea = (n: number, p: number, cantidad: number, precio: number): LineaNueva => ({
  productoId: uuid(200 + n), puesto: puesto(p), nombre: `Producto ${n}`, unidadVenta: 'KILOGRAMO', presentacion: n % 2 ? null : 'Bolsa', cantidad, precioUnitarioCentimos: precio,
});
let ids = 1000;
const original = () =>
  Pedido.crear({
    id: uuid(9), clienteId: uuid(1), claveIdempotencia: 'clave-1', carritoId: uuid(8), huellaCarrito: 'b'.repeat(64),
    lineas: [linea(1, 1, 3, 10), linea(2, 2, 3, 1999), linea(3, 1, 2, 650)], reservaVenceEn: new Date(AHORA.getTime() + 60_000), creadoEn: AHORA, generarId: () => uuid(++ids),
  }).conCodigo('PED-7K3MQ9XA');

/** Proyección de un pedido a los datos que guarda la base (lo que el repositorio leerá). */
function aDatos(p: Pedido): DatosReconstitucionPedido {
  return {
    id: p.id, codigo: p.codigo!, clienteId: p.clienteId, claveIdempotencia: p.claveIdempotencia, carritoId: p.carritoId, huellaCarrito: p.huellaCarrito,
    totalCentimos: p.totalCentimos, reservaVenceEn: p.reservaVenceEn, creadoEn: p.creadoEn,
    subpedidos: p.subpedidos.map((s) => ({
      id: s.id, puestoId: s.puestoId, puesto: { ...s.puesto }, estado: s.estado, subtotalCentimos: s.subtotalCentimos,
      lineas: s.lineas.map((l) => ({ id: l.id, productoId: l.productoId, nombre: l.nombre, unidadVenta: l.unidadVenta, presentacion: l.presentacion, cantidad: l.cantidad, precioUnitarioCentimos: l.precioUnitarioCentimos, subtotalCentimos: l.subtotalCentimos })),
      historial: s.historial.map((h) => ({ ...h })),
    })),
  };
}
const fallaCon = (d: DatosReconstitucionPedido) => {
  const e = (() => { try { Pedido.reconstituir(d); } catch (x) { return x; } return undefined; })();
  expect(e).toBeInstanceOf(ReconstitucionInvalidaError);
  expect(e).not.toBeInstanceOf(ErrorDeDominio);
  return e as ReconstitucionInvalidaError;
};

describe('Pedido.reconstituir', () => {
  it('rearma exactamente el pedido guardado (identidades, importes, instantáneas, estado e historial)', () => {
    const p = original();
    const r = Pedido.reconstituir(aDatos(p));
    expect(r).toEqual(p);
    expect(r.estadoGeneral).toBe('ESPERANDO_PAGO');
  });

  it('admite subpedidos en otros estados con su historial encadenado (estado general MIXTO)', () => {
    const p = original();
    const d = aDatos(p);
    const s0 = p.subpedidos[0]!.transicionar(EstadoSubpedido.PAGO_APROBADO, { origen: 'PAGO', actorId: null, creadoEn: new Date(AHORA.getTime() + 1000) });
    d.subpedidos[0] = { ...d.subpedidos[0]!, estado: s0.estado, historial: s0.historial.map((h) => ({ ...h })) };
    const r = Pedido.reconstituir(d);
    expect(r.subpedidos[0]!.estado).toBe('PAGO_APROBADO');
    expect(r.subpedidos[0]!.historial).toHaveLength(2);
    expect(r.estadoGeneral).toBe('MIXTO');
  });

  it('el resultado es inmutable como el creado', () => {
    const r = Pedido.reconstituir(aDatos(original()));
    expect(() => { (r as { totalCentimos: number }).totalCentimos = 1; }).toThrow(TypeError);
    expect(() => (r.subpedidos[0]!.historial as unknown[]).push({})).toThrow(TypeError);
  });

  describe('rechaza datos incoherentes con ReconstitucionInvalidaError (fallo inesperado, no 4xx)', () => {
    it('total persistido distinto de la suma de subtotales', () => {
      const d = aDatos(original());
      d.totalCentimos += 1;
      expect(fallaCon(d).message).toMatch(/total/i);
    });
    it('subtotal del subpedido distinto de la suma de sus líneas', () => {
      const d = aDatos(original());
      d.subpedidos[0]!.subtotalCentimos -= 1;
      d.totalCentimos -= 1;
      fallaCon(d);
    });
    it('subtotal de una línea distinto de precio × cantidad', () => {
      const d = aDatos(original());
      d.subpedidos[1]!.lineas[0]!.subtotalCentimos += 100;
      d.subpedidos[1]!.subtotalCentimos += 100;
      d.totalCentimos += 100;
      fallaCon(d);
    });
    it('línea inválida (cantidad 0): la causa original se conserva', () => {
      const d = aDatos(original());
      d.subpedidos[0]!.lineas[0]!.cantidad = 0;
      expect(fallaCon(d).cause).toBeInstanceOf(Error);
    });
    it('código ausente o con formato inválido', () => {
      const d = aDatos(original());
      fallaCon({ ...d, codigo: '' });
      fallaCon({ ...d, codigo: 'PED-1234567I' });
    });
    it('sin subpedidos, o un subpedido sin líneas', () => {
      const d = aDatos(original());
      fallaCon({ ...d, subpedidos: [], totalCentimos: 0 });
      const sinLineas = aDatos(original());
      sinLineas.totalCentimos -= sinLineas.subpedidos[0]!.subtotalCentimos;
      sinLineas.subpedidos[0] = { ...sinLineas.subpedidos[0]!, lineas: [], subtotalCentimos: 0 };
      fallaCon(sinLineas);
    });
    it('dos subpedidos del mismo puesto o el mismo producto en dos líneas', () => {
      const d = aDatos(original());
      d.subpedidos[1]!.puestoId = d.subpedidos[0]!.puestoId;
      fallaCon(d);
      const e = aDatos(original());
      e.subpedidos[1]!.lineas[0]!.productoId = e.subpedidos[0]!.lineas[0]!.productoId;
      fallaCon(e);
    });
    it('historial vacío, que no empieza en ESPERANDO_PAGO con anterior nulo, o cuyo último estado no es el del subpedido', () => {
      const vacio = aDatos(original());
      vacio.subpedidos[0]!.historial = [];
      fallaCon(vacio);
      const inicio = aDatos(original());
      inicio.subpedidos[0]!.historial[0] = { ...inicio.subpedidos[0]!.historial[0]!, estadoAnterior: EstadoSubpedido.PAGO_APROBADO };
      fallaCon(inicio);
      const desfasado = aDatos(original());
      desfasado.subpedidos[0]!.estado = EstadoSubpedido.PAGO_APROBADO;
      fallaCon(desfasado);
    });
    it('historial con una transición fuera del diagrama o con la cadena rota', () => {
      const salto = aDatos(original());
      const h0 = salto.subpedidos[0]!.historial[0]!;
      salto.subpedidos[0]!.historial.push({ estadoAnterior: 'ESPERANDO_PAGO', estadoNuevo: 'ENTREGADO', origen: 'X', actorId: null, creadoEn: h0.creadoEn });
      salto.subpedidos[0]!.estado = 'ENTREGADO';
      fallaCon(salto);
      const rota = aDatos(original());
      rota.subpedidos[0]!.historial.push({ estadoAnterior: 'PAGO_APROBADO', estadoNuevo: 'EN_PREPARACION', origen: 'X', actorId: null, creadoEn: h0.creadoEn });
      rota.subpedidos[0]!.estado = 'EN_PREPARACION';
      fallaCon(rota);
    });
    it('estado que no pertenece a la enumeración', () => {
      const d = aDatos(original());
      d.subpedidos[0]!.estado = 'MIXTO' as never;
      fallaCon(d);
    });
  });
});
