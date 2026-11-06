import { beforeEach, describe, expect, it } from 'vitest';
import type { Actor } from '../../../../shared/domain/actor.js';
import { ErrorDeValidacion, ErrorProhibido } from '../../../../shared/domain/errors.js';
import {
  ClaveOperacionReutilizadaError,
  ProductoNoEncontradoError,
  ReservaNoEncontradaError,
  ReservaYaConfirmadaError,
  ReservaYaLiberadaError,
  StockFisicoInsuficienteError,
  StockInsuficienteError,
} from '../../domain/errors.js';
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
} from './inventario.use-cases.js';
import { InventarioEnMemoria, PropiedadEnMemoria } from './test-doubles.js';

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const A: Actor = { id: id(1), rol: 'COMERCIANTE' };
const B: Actor = { id: id(2), rol: 'COMERCIANTE' };
const CLIENTE: Actor = { id: id(3), rol: 'CLIENTE' };
const ADMIN: Actor = { id: id(4), rol: 'ADMINISTRADOR' };
const TRABAJADOR: Actor = { id: id(5), rol: 'TRABAJADOR_PUESTO' };
const P1 = id(101); // del comerciante A
const P2 = id(102); // del comerciante A
const PB = id(103); // del comerciante B
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

describe('RegistrarMovimientoStock (RF12, RF13)', () => {
  it('registra ingresos, devoluciones y ajustes y genera un movimiento por cada uno', async () => {
    await registrar.ejecutar(P1, { tipo: 'DEVOLUCION', cantidad: 2 }, A);
    const v = await registrar.ejecutar(P1, { tipo: 'AJUSTE', cantidad: -3, motivo: 'merma' }, A);
    expect(v).toMatchObject({ stockFisico: 9, stockReservado: 0, stockDisponible: 9 });
    const mov = await new ListarMovimientos(inv, prop).ejecutar(P1, A);
    expect(mov.datos.map((m) => m.tipo)).toEqual(['AJUSTE', 'DEVOLUCION', 'INGRESO']);
    expect(mov.datos[0]).toMatchObject({ variacionFisica: -3, stockFisicoDespues: 9, motivo: 'merma', actorId: A.id });
  });

  it('un ajuste exige motivo, el ingreso no admite cantidades negativas y el tipo debe ser manual', async () => {
    await expect(registrar.ejecutar(P1, { tipo: 'AJUSTE', cantidad: -1 }, A)).rejects.toThrow(ErrorDeValidacion);
    await expect(registrar.ejecutar(P1, { tipo: 'INGRESO', cantidad: -1 }, A)).rejects.toThrow(ErrorDeValidacion);
    await expect(registrar.ejecutar(P1, { tipo: 'VENTA', cantidad: 1 }, A)).rejects.toThrow(ErrorDeValidacion);
    await expect(registrar.ejecutar(P1, { tipo: 'INGRESO', cantidad: 1.5 }, A)).rejects.toThrow(ErrorDeValidacion);
  });

  it('prevención de stock negativo: un ajuste no puede bajar de cero ni de lo reservado', async () => {
    await expect(registrar.ejecutar(P2, { tipo: 'AJUSTE', cantidad: -6, motivo: 'x' }, A)).rejects.toThrow(StockFisicoInsuficienteError);
    await reservar.ejecutar({ claveOperacion: 'o1', items: [{ productoId: P2, cantidad: 4 }], expiraEn: futuro() });
    await expect(registrar.ejecutar(P2, { tipo: 'AJUSTE', cantidad: -2, motivo: 'x' }, A)).rejects.toThrow(StockFisicoInsuficienteError);
    expect((await inv.obtener(P2))!.stockFisico).toBe(5);
  });

  it('autorización: solo el titular escribe (acceso cruzado, cliente, trabajador y administrador reciben 403)', async () => {
    for (const actor of [B, CLIENTE, TRABAJADOR, ADMIN]) {
      await expect(registrar.ejecutar(P1, { tipo: 'INGRESO', cantidad: 1 }, actor)).rejects.toThrow(ErrorProhibido);
    }
    expect((await inv.obtener(P1))!.stockFisico).toBe(10);
  });

  it('autoriza antes de validar la entrada y distingue producto inexistente', async () => {
    await expect(registrar.ejecutar(P1, { tipo: 'basura', cantidad: 'x' }, B)).rejects.toThrow(ErrorProhibido);
    await expect(registrar.ejecutar(id(999), { tipo: 'INGRESO', cantidad: 1 }, A)).rejects.toThrow(ProductoNoEncontradoError);
    await expect(registrar.ejecutar('no-uuid', { tipo: 'INGRESO', cantidad: 1 }, A)).rejects.toThrow(ProductoNoEncontradoError);
  });
});

describe('Consultas (RF14, HU15)', () => {
  it('el titular y el administrador consultan; B y el cliente no', async () => {
    const c = new ConsultarInventarioProducto(inv, prop);
    expect(await c.ejecutar(P1, A)).toMatchObject({ stockFisico: 10, stockDisponible: 10 });
    expect(await c.ejecutar(P1, ADMIN)).toMatchObject({ stockFisico: 10 });
    await expect(c.ejecutar(P1, B)).rejects.toThrow(ErrorProhibido);
    await expect(c.ejecutar(P1, CLIENTE)).rejects.toThrow(ErrorProhibido);
    await expect(new ListarMovimientos(inv, prop).ejecutar(P1, B)).rejects.toThrow(ErrorProhibido);
  });

  it('un producto sin existencias registradas se informa con ceros', async () => {
    prop.productos.set(id(150), { puestoId: id(201), usuarioIdTitular: A.id });
    expect(await new ConsultarInventarioProducto(inv, prop).ejecutar(id(150), A)).toMatchObject({ stockFisico: 0, stockDisponible: 0 });
  });

  it('el listado de un comerciante solo incluye sus puestos y no admite el puesto de otro', async () => {
    await registrar.ejecutar(PB, { tipo: 'INGRESO', cantidad: 7 }, B);
    const l = new ListarInventario(inv, prop);
    expect((await l.ejecutar(A)).datos.map((d) => d.productoId).sort()).toEqual([P1, P2]);
    expect((await l.ejecutar(B)).datos.map((d) => d.productoId)).toEqual([PB]);
    expect((await l.ejecutar(ADMIN)).total).toBe(3);
    await expect(l.ejecutar(A, { puestoId: id(202) })).rejects.toThrow(ErrorProhibido);
    await expect(l.ejecutar(CLIENTE)).rejects.toThrow(ErrorProhibido);
    await expect(l.ejecutar(A, { puestoId: 'x' })).rejects.toThrow(ErrorDeValidacion);
  });
});

describe('ReservarInventario (RF15, RF25, ADR-003)', () => {
  it('stock suficiente: reserva y deja el disponible actualizado', async () => {
    const r = await reservar.ejecutar({ claveOperacion: 'pedido-1', items: [{ productoId: P1, cantidad: 4 }], expiraEn: futuro() });
    expect(r).toMatchObject({ repetida: false, reservas: [{ productoId: P1, cantidad: 4, estado: 'RESERVADA' }] });
    expect(await inv.obtener(P1)).toMatchObject({ stockFisico: 10, stockReservado: 4, stockDisponible: 6 });
    expect(await new ConsultarDisponibilidad(inv).ejecutar(P1)).toBe(6);
  });

  it('stock insuficiente: respuesta controlada y nada cambia', async () => {
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

  it('integridad ante un fallo a mitad de la transacción: no queda nada reservado ni registrado', async () => {
    inv.fallarEnItem = 1;
    await expect(
      reservar.ejecutar({ claveOperacion: 'p', items: [{ productoId: P1, cantidad: 3 }, { productoId: P2, cantidad: 1 }], expiraEn: futuro() }),
    ).rejects.toThrow('Fallo simulado');
    expect(await inv.obtener(P1)).toMatchObject({ stockReservado: 0 });
    expect(inv.reservas).toHaveLength(0);
    expect((await new ListarMovimientos(inv, prop).ejecutar(P1, A)).datos.map((m) => m.tipo)).toEqual(['INGRESO']);
  });

  it('un producto sin existencias registradas no se puede reservar', async () => {
    await expect(reservar.ejecutar({ claveOperacion: 'p', items: [{ productoId: id(150), cantidad: 1 }], expiraEn: futuro() })).rejects.toThrow(StockInsuficienteError);
  });

  it('idempotencia: repetir la misma clave devuelve el resultado anterior sin reservar otra vez', async () => {
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

  it('valida la solicitud', async () => {
    const ok = { productoId: P1, cantidad: 1 };
    const llamar = (x: object) => reservar.ejecutar({ claveOperacion: 'k', items: [ok], expiraEn: futuro(), ...x });
    await expect(llamar({ claveOperacion: '' })).rejects.toThrow(ErrorDeValidacion);
    await expect(llamar({ claveOperacion: 'a b' })).rejects.toThrow(ErrorDeValidacion);
    await expect(llamar({ items: [] })).rejects.toThrow(ErrorDeValidacion);
    await expect(llamar({ items: [ok, ok] })).rejects.toThrow(ErrorDeValidacion);
    await expect(llamar({ items: [{ productoId: 'x', cantidad: 1 }] })).rejects.toThrow(ErrorDeValidacion);
    await expect(llamar({ items: [{ productoId: P1, cantidad: 0 }] })).rejects.toThrow(ErrorDeValidacion);
    await expect(llamar({ expiraEn: new Date(Date.now() - 1000) })).rejects.toThrow(ErrorDeValidacion);
    await expect(llamar({ expiraEn: 'mañana' })).rejects.toThrow(ErrorDeValidacion);
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

  it('no se puede liberar una venta confirmada ni confirmar una reserva liberada; clave inexistente', async () => {
    await reservarP1('v');
    await confirmar.ejecutar('v');
    await expect(liberar.ejecutar('v')).rejects.toThrow(ReservaYaConfirmadaError);
    await reservarP1('l', 2);
    await liberar.ejecutar('l');
    await expect(confirmar.ejecutar('l')).rejects.toThrow(ReservaYaLiberadaError);
    await expect(liberar.ejecutar('nada')).rejects.toThrow(ReservaNoEncontradaError);
    await expect(confirmar.ejecutar('nada')).rejects.toThrow(ReservaNoEncontradaError);
  });

  it('un reintento de la reserva tras liberarla informa su estado anterior y no reserva de nuevo', async () => {
    await reservarP1('r');
    await liberar.ejecutar('r');
    const r = await reservarP1('r');
    expect(r).toMatchObject({ repetida: true, reservas: [{ estado: 'LIBERADA' }] });
    expect((await inv.obtener(P1))!.stockReservado).toBe(0);
  });

  it('la expiración libera solo las reservas vencidas y es idempotente', async () => {
    const t0 = new Date('2026-11-05T10:00:00Z');
    const expirar = new ExpirarReservasVencidas(inv, () => new Date('2026-11-05T11:00:00Z'));
    await new ReservarInventario(inv, () => t0).ejecutar({ claveOperacion: 'viejo', items: [{ productoId: P1, cantidad: 3 }], expiraEn: new Date('2026-11-05T10:30:00Z') });
    await new ReservarInventario(inv, () => t0).ejecutar({ claveOperacion: 'vigente', items: [{ productoId: P1, cantidad: 2 }], expiraEn: new Date('2026-11-05T12:00:00Z') });
    expect(await expirar.ejecutar()).toEqual({ reservasLiberadas: 1, unidades: 3 });
    expect(await expirar.ejecutar()).toEqual({ reservasLiberadas: 0, unidades: 0 });
    expect(await inv.obtener(P1)).toMatchObject({ stockReservado: 2 });
  });

  it('una reserva ya confirmada no se expira', async () => {
    const t0 = new Date('2026-11-05T10:00:00Z');
    await new ReservarInventario(inv, () => t0).ejecutar({ claveOperacion: 'pagado', items: [{ productoId: P1, cantidad: 3 }], expiraEn: new Date('2026-11-05T10:30:00Z') });
    await confirmar.ejecutar('pagado');
    expect(await new ExpirarReservasVencidas(inv, () => new Date('2026-11-05T11:00:00Z')).ejecutar()).toEqual({ reservasLiberadas: 0, unidades: 0 });
    expect(await inv.obtener(P1)).toMatchObject({ stockFisico: 7, stockReservado: 0 });
  });
});
