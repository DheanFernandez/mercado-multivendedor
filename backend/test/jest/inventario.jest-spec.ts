/**
 * Suite representativa con Jest (spec 006): inventario (RF12–RF15; ADR-003) con los dobles en memoria. Reservas atómicas,
 * idempotentes y todo-o-nada. Sin red, PostgreSQL ni Supabase.
 */
import { beforeEach, describe, expect, it } from '@jest/globals';
import type { Actor } from '../../src/shared/domain/actor.js';
import { ErrorDeValidacion, ErrorProhibido } from '../../src/shared/domain/errors.js';
import {
  ClaveOperacionReutilizadaError,
  ProductoNoEncontradoError,
  ReservaNoEncontradaError,
  ReservaYaConfirmadaError,
  ReservaYaLiberadaError,
  StockFisicoInsuficienteError,
  StockInsuficienteError,
} from '../../src/modules/inventory/domain/errors.js';
import {
  ConfirmarVentaReservada,
  ConsultarDisponibilidad,
  ConsultarInventarioProducto,
  ExpirarReservasVencidas,
  LiberarReserva,
  ListarInventario,
  ListarMovimientos,
  RegistrarMovimientoStock,
  ReservarInventario,
} from '../../src/modules/inventory/application/use-cases/inventario.use-cases.js';
import { InventarioEnMemoria, PropiedadEnMemoria } from '../../src/modules/inventory/application/use-cases/test-doubles.js';

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const A: Actor = { id: id(1), rol: 'COMERCIANTE' };
const B: Actor = { id: id(2), rol: 'COMERCIANTE' };
const CLIENTE: Actor = { id: id(3), rol: 'CLIENTE' };
const ADMIN: Actor = { id: id(4), rol: 'ADMINISTRADOR' };
const P1 = id(101);
const P2 = id(102);
const PB = id(103);
const futuro = () => new Date(Date.now() + 3_600_000);

let inv: InventarioEnMemoria;
let prop: PropiedadEnMemoria;
let registrar: RegistrarMovimientoStock;
let reservar: ReservarInventario;
let liberar: LiberarReserva;
let confirmar: ConfirmarVentaReservada;

beforeEach(async () => {
  inv = new InventarioEnMemoria();
  prop = new PropiedadEnMemoria();
  prop.productos.set(P1, { puestoId: id(201), usuarioIdTitular: A.id });
  prop.productos.set(P2, { puestoId: id(201), usuarioIdTitular: A.id });
  prop.productos.set(PB, { puestoId: id(202), usuarioIdTitular: B.id });
  registrar = new RegistrarMovimientoStock(inv, prop);
  reservar = new ReservarInventario(inv);
  liberar = new LiberarReserva(inv);
  confirmar = new ConfirmarVentaReservada(inv);
  await registrar.ejecutar(P1, { tipo: 'INGRESO', cantidad: 10 }, A);
  await registrar.ejecutar(P2, { tipo: 'INGRESO', cantidad: 5 }, A);
});

describe('Movimientos manuales (RF12, RF13)', () => {
  it('cada ingreso, devolución o ajuste actualiza el stock y deja un movimiento', async () => {
    await registrar.ejecutar(P1, { tipo: 'DEVOLUCION', cantidad: 2 }, A);
    const v = await registrar.ejecutar(P1, { tipo: 'AJUSTE', cantidad: -3, motivo: 'merma' }, A);
    expect(v).toMatchObject({ stockFisico: 9, stockReservado: 0, stockDisponible: 9 });
    const mov = await new ListarMovimientos(inv, prop).ejecutar(P1, A);
    expect(mov.datos.map((m) => m.tipo)).toEqual(['AJUSTE', 'DEVOLUCION', 'INGRESO']);
    expect(mov.datos[0]).toMatchObject({ variacionFisica: -3, stockFisicoDespues: 9, motivo: 'merma', actorId: A.id });
  });

  it('valida el tipo, la cantidad y el motivo', async () => {
    await expect(registrar.ejecutar(P1, { tipo: 'AJUSTE', cantidad: -1 }, A)).rejects.toThrow(ErrorDeValidacion);
    await expect(registrar.ejecutar(P1, { tipo: 'INGRESO', cantidad: -1 }, A)).rejects.toThrow(ErrorDeValidacion);
    await expect(registrar.ejecutar(P1, { tipo: 'VENTA', cantidad: 1 }, A)).rejects.toThrow(ErrorDeValidacion);
    await expect(registrar.ejecutar(P1, { tipo: 'INGRESO', cantidad: 1.5 }, A)).rejects.toThrow(ErrorDeValidacion);
  });

  it('un ajuste no puede dejar el físico por debajo de lo reservado', async () => {
    await reservar.ejecutar({ claveOperacion: 'r', items: [{ productoId: P1, cantidad: 8 }], expiraEn: futuro() });
    await expect(registrar.ejecutar(P1, { tipo: 'AJUSTE', cantidad: -3, motivo: 'merma' }, A)).rejects.toThrow(StockFisicoInsuficienteError);
    expect(await inv.obtener(P1)).toMatchObject({ stockFisico: 10, stockReservado: 8 });
  });

  it('solo el comerciante titular modifica; el administrador solo lee; otros roles quedan fuera', async () => {
    await expect(registrar.ejecutar(P1, { tipo: 'INGRESO', cantidad: 1 }, B)).rejects.toThrow(ErrorProhibido);
    await expect(registrar.ejecutar(P1, { tipo: 'INGRESO', cantidad: 1 }, ADMIN)).rejects.toThrow(ErrorProhibido);
    await expect(registrar.ejecutar(P1, { tipo: 'INGRESO', cantidad: 1 }, CLIENTE)).rejects.toThrow(ErrorProhibido);
    expect(await new ConsultarInventarioProducto(inv, prop).ejecutar(P1, ADMIN)).toMatchObject({ stockFisico: 10 });
    await expect(new ConsultarInventarioProducto(inv, prop).ejecutar(P1, B)).rejects.toThrow(ErrorProhibido);
  });

  it('un producto inexistente o con identificador inválido es «no encontrado»', async () => {
    await expect(registrar.ejecutar(id(999), { tipo: 'INGRESO', cantidad: 1 }, A)).rejects.toThrow(ProductoNoEncontradoError);
    await expect(registrar.ejecutar('x', { tipo: 'INGRESO', cantidad: 1 }, A)).rejects.toThrow(ProductoNoEncontradoError);
  });

  it('el comerciante lista solo las existencias de sus puestos; el administrador, todas', async () => {
    await registrar.ejecutar(PB, { tipo: 'INGRESO', cantidad: 7 }, B);
    const listar = new ListarInventario(inv, prop);
    expect((await listar.ejecutar(A)).datos.map((e) => e.productoId).sort()).toEqual([P1, P2].sort());
    expect((await listar.ejecutar(ADMIN)).total).toBe(3);
    await expect(listar.ejecutar(A, { puestoId: id(202) })).rejects.toThrow(ErrorProhibido);
    await expect(listar.ejecutar(CLIENTE)).rejects.toThrow(ErrorProhibido);
  });
});

describe('ReservarInventario (RF15, ADR-003)', () => {
  it('reserva con stock suficiente y deja el disponible actualizado', async () => {
    const r = await reservar.ejecutar({ claveOperacion: 'pedido-1', items: [{ productoId: P1, cantidad: 4 }], expiraEn: futuro() });
    expect(r).toMatchObject({ repetida: false, reservas: [{ productoId: P1, cantidad: 4, estado: 'RESERVADA' }] });
    expect(await inv.obtener(P1)).toMatchObject({ stockFisico: 10, stockReservado: 4, stockDisponible: 6 });
    expect(await new ConsultarDisponibilidad(inv).ejecutar(P1)).toBe(6);
  });

  it('con stock insuficiente responde con conflicto y no cambia nada', async () => {
    await expect(reservar.ejecutar({ claveOperacion: 'p', items: [{ productoId: P1, cantidad: 11 }], expiraEn: futuro() })).rejects.toThrow(StockInsuficienteError);
    expect(await inv.obtener(P1)).toMatchObject({ stockReservado: 0 });
  });

  it('el último stock se concede a una sola operación', async () => {
    await reservar.ejecutar({ claveOperacion: 'c1', items: [{ productoId: P2, cantidad: 5 }], expiraEn: futuro() });
    await expect(reservar.ejecutar({ claveOperacion: 'c2', items: [{ productoId: P2, cantidad: 1 }], expiraEn: futuro() })).rejects.toThrow(StockInsuficienteError);
  });

  it('es todo-o-nada: si un producto no alcanza, ninguno se reserva', async () => {
    await expect(
      reservar.ejecutar({ claveOperacion: 'p', items: [{ productoId: P1, cantidad: 3 }, { productoId: P2, cantidad: 6 }], expiraEn: futuro() }),
    ).rejects.toThrow(StockInsuficienteError);
    expect(await inv.obtener(P1)).toMatchObject({ stockReservado: 0 });
    expect(inv.reservas).toHaveLength(0);
  });

  it('un fallo a mitad de la transacción no deja nada reservado ni registrado', async () => {
    inv.fallarEnItem = 1;
    await expect(
      reservar.ejecutar({ claveOperacion: 'p', items: [{ productoId: P1, cantidad: 3 }, { productoId: P2, cantidad: 1 }], expiraEn: futuro() }),
    ).rejects.toThrow('Fallo simulado');
    expect(await inv.obtener(P1)).toMatchObject({ stockReservado: 0 });
    expect(inv.reservas).toHaveLength(0);
  });

  it('es idempotente: repetir la misma clave devuelve lo anterior sin reservar otra vez', async () => {
    const solicitud = { claveOperacion: 'pedido-9', items: [{ productoId: P1, cantidad: 4 }], expiraEn: futuro() };
    const primera = await reservar.ejecutar(solicitud);
    const segunda = await reservar.ejecutar(solicitud);
    expect(primera.repetida).toBe(false);
    expect(segunda).toMatchObject({ repetida: true, reservas: [{ productoId: P1, cantidad: 4, estado: 'RESERVADA' }] });
    expect((await inv.obtener(P1))!.stockReservado).toBe(4);
  });

  it('reutilizar la clave con otra cantidad u otros productos es un conflicto', async () => {
    await reservar.ejecutar({ claveOperacion: 'k', items: [{ productoId: P1, cantidad: 2 }], expiraEn: futuro() });
    await expect(reservar.ejecutar({ claveOperacion: 'k', items: [{ productoId: P1, cantidad: 3 }], expiraEn: futuro() })).rejects.toThrow(ClaveOperacionReutilizadaError);
    await expect(reservar.ejecutar({ claveOperacion: 'k', items: [{ productoId: P2, cantidad: 2 }], expiraEn: futuro() })).rejects.toThrow(ClaveOperacionReutilizadaError);
  });

  it('valida la solicitud completa', async () => {
    const ok = { productoId: P1, cantidad: 1 };
    const llamar = (x: object) => reservar.ejecutar({ claveOperacion: 'k', items: [ok], expiraEn: futuro(), ...x });
    await expect(llamar({ claveOperacion: '' })).rejects.toThrow(ErrorDeValidacion);
    await expect(llamar({ items: [] })).rejects.toThrow(ErrorDeValidacion);
    await expect(llamar({ items: [ok, ok] })).rejects.toThrow(ErrorDeValidacion);
    await expect(llamar({ items: [{ productoId: 'x', cantidad: 1 }] })).rejects.toThrow(ErrorDeValidacion);
    await expect(llamar({ items: [{ productoId: P1, cantidad: 0 }] })).rejects.toThrow(ErrorDeValidacion);
    await expect(llamar({ expiraEn: new Date(Date.now() - 1000) })).rejects.toThrow(ErrorDeValidacion);
  });
});

describe('Liberación, venta y expiración', () => {
  const reservarP1 = (clave = 'o1', cantidad = 4, expiraEn = futuro()) => reservar.ejecutar({ claveOperacion: clave, items: [{ productoId: P1, cantidad }], expiraEn });

  it('liberar devuelve las unidades y es idempotente', async () => {
    await reservarP1();
    expect(await liberar.ejecutar('o1')).toEqual({ liberadas: 4 });
    expect(await liberar.ejecutar('o1')).toEqual({ liberadas: 0 });
    expect(await inv.obtener(P1)).toMatchObject({ stockFisico: 10, stockReservado: 0 });
  });

  it('confirmar la venta baja físico y reservado una sola vez', async () => {
    await reservarP1();
    expect(await confirmar.ejecutar('o1')).toEqual({ confirmadas: 4 });
    expect(await confirmar.ejecutar('o1')).toEqual({ confirmadas: 0 });
    expect(await inv.obtener(P1)).toMatchObject({ stockFisico: 6, stockReservado: 0, stockDisponible: 6 });
  });

  it('no se libera una venta confirmada ni se confirma una reserva liberada', async () => {
    await reservarP1('v');
    await confirmar.ejecutar('v');
    await expect(liberar.ejecutar('v')).rejects.toThrow(ReservaYaConfirmadaError);
    await reservarP1('l', 2);
    await liberar.ejecutar('l');
    await expect(confirmar.ejecutar('l')).rejects.toThrow(ReservaYaLiberadaError);
    await expect(liberar.ejecutar('no-existe')).rejects.toThrow(ReservaNoEncontradaError);
  });

  it('las reservas vencidas se liberan; las vigentes no', async () => {
    await reservarP1('vigente', 2, futuro());
    await reservarP1('vencida', 3, new Date(Date.now() + 1000));
    const adelante = () => new Date(Date.now() + 5000);
    const r = await new ExpirarReservasVencidas(inv, adelante).ejecutar();
    expect(r).toEqual({ reservasLiberadas: 1, unidades: 3 });
    expect(await inv.obtener(P1)).toMatchObject({ stockReservado: 2 });
  });
});
