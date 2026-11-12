/**
 * T009 · Los dobles reproducen las propiedades en las que se apoyan las pruebas de `CrearPedido`.
 * (No demuestran las garantías de PostgreSQL: solo que el doble se comporta como el contrato de la unidad de trabajo.)
 */
import { describe, expect, it } from 'vitest';
import { ErrorServicioNoDisponible } from '../../../../shared/domain/errors.js';
import { UnidadDeTrabajoRequeridaError } from '../../../../shared/domain/unidad-de-trabajo.error.js';
import { Pedido } from '../../domain/pedido.entity.js';
import { CodigoPedidoNoGenerableError } from '../ports/pedido.repository.js';
import { StockInsuficientePedidoError } from '../ports/reserva-inventario.port.js';
import { ErrorTransitorioSimulado, montarDobles } from './test-doubles.js';

const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const AHORA = new Date('2026-11-06T10:00:00.000Z');
let ids = 5000;
const pedido = (clave = 'k1', cliente = uuid(1)) =>
  Pedido.crear({
    id: uuid(++ids), clienteId: cliente, claveIdempotencia: clave, carritoId: uuid(2), huellaCarrito: 'a'.repeat(64),
    lineas: [{ productoId: uuid(10), puesto: { id: uuid(20), codigo: 'A-1', nombre: 'A' }, nombre: 'Mango', unidadVenta: 'KILOGRAMO', presentacion: null, cantidad: 1, precioUnitarioCentimos: 100 }],
    reservaVenceEn: new Date(AHORA.getTime() + 60_000), creadoEn: AHORA, generarId: () => uuid(++ids),
  });
const linea = { productoId: uuid(10), puesto: { id: uuid(20), codigo: 'A-1', nombre: 'A' }, nombre: 'Mango', unidadVenta: 'KILOGRAMO', presentacion: null, cantidad: 2, precioUnitarioCentimos: 100, comprable: true };

describe('UnidadDeTrabajoEnMemoria', () => {
  it('si el trabajo falla, restaura TODOS los almacenes (rollback) y propaga el error sin reintentar', async () => {
    const d = montarDobles();
    d.carrito.poner(uuid(1), uuid(2), [linea]);
    d.inventario.fijarDisponible(uuid(10), 5);
    const antes = [d.pedidos.instantanea(), d.carrito.instantanea(), d.inventario.instantanea()];
    await expect(d.uow.ejecutar(async () => {
      await d.pedidos.insertar(pedido());
      await d.carrito.vaciar(uuid(1));
      await d.inventario.reservar({ claveOperacion: 'x', items: [{ productoId: uuid(10), cantidad: 2 }], expiraEn: AHORA });
      throw new Error('fallo');
    })).rejects.toThrow('fallo');
    expect([d.pedidos.instantanea(), d.carrito.instantanea(), d.inventario.instantanea()]).toEqual(antes);
    expect(d.uow.intentos).toBe(1);
    expect(d.entorno.vigente).toBe(false);
  });

  it('reintenta el bloque completo ante un error transitorio y confirma el intento que termina', async () => {
    const d = montarDobles();
    let ejecuciones = 0;
    const r = await d.uow.ejecutar(async () => {
      ejecuciones++;
      await d.pedidos.insertar(pedido('k-' + ejecuciones));
      if (ejecuciones < 3) throw new ErrorTransitorioSimulado();
      return 'ok';
    });
    expect(r).toBe('ok');
    expect(ejecuciones).toBe(3);
    expect(d.uow.intentos).toBe(3);
    expect(d.pedidos.todos().map((p) => p.claveIdempotencia)).toEqual(['k-3']); // los intentos fallidos no dejan rastro
  });

  it('a los 5 intentos transitorios lanza ErrorServicioNoDisponible conservando la causa', async () => {
    const d = montarDobles();
    const causa = new ErrorTransitorioSimulado('quinto');
    let n = 0;
    const e = await d.uow.ejecutar(async () => { n++; throw n === 5 ? causa : new ErrorTransitorioSimulado(); }).catch((x: unknown) => x);
    expect(e).toBeInstanceOf(ErrorServicioNoDisponible);
    expect((e as Error).cause).toBe(causa);
    expect(n).toBe(5);
  });

  it('una unidad anidada se une a la vigente (un solo intento, un solo rollback)', async () => {
    const d = montarDobles();
    await expect(d.uow.ejecutar(() => d.uow.ejecutar(async () => { await d.pedidos.insertar(pedido()); throw new Error('x'); }))).rejects.toThrow('x');
    expect(d.uow.unidades).toBe(1);
    expect(d.pedidos.todos()).toEqual([]);
  });

  it('las operaciones transaccionales fallan fuera de una unidad', async () => {
    const d = montarDobles();
    await expect(d.pedidos.bloquearCliente(uuid(1))).rejects.toBeInstanceOf(UnidadDeTrabajoRequeridaError);
    await expect(d.pedidos.insertar(pedido())).rejects.toBeInstanceOf(UnidadDeTrabajoRequeridaError);
    await expect(d.carrito.obtenerParaPedido(uuid(1))).rejects.toBeInstanceOf(UnidadDeTrabajoRequeridaError);
    await expect(d.carrito.vaciar(uuid(1))).rejects.toBeInstanceOf(UnidadDeTrabajoRequeridaError);
    await expect(d.inventario.reservar({ claveOperacion: 'x', items: [], expiraEn: AHORA })).rejects.toBeInstanceOf(UnidadDeTrabajoRequeridaError);
  });
});

describe('almacenes', () => {
  it('insertar: ante colisión genera otro código (≤ 5) y, agotados, CodigoPedidoNoGenerableError', async () => {
    const d = montarDobles({ codigos: ['PED-AAAAAAAA', 'PED-BBBBBBBB'] });
    d.pedidos.codigosOcupados.add('PED-AAAAAAAA');
    const p = await d.uow.ejecutar(() => d.pedidos.insertar(pedido()));
    expect(p.codigo).toBe('PED-BBBBBBBB');
    expect(d.generador.generados).toBe(2);

    const e = montarDobles({ codigos: Array(5).fill('PED-CCCCCCCC') });
    e.pedidos.codigosOcupados.add('PED-CCCCCCCC');
    await expect(e.uow.ejecutar(() => e.pedidos.insertar(pedido()))).rejects.toBeInstanceOf(CodigoPedidoNoGenerableError);
    expect(e.generador.generados).toBe(5);
    expect(e.uow.intentos).toBe(1);
  });

  it('insertar respeta la unicidad (cliente, clave) como red de seguridad', async () => {
    const d = montarDobles();
    await d.uow.ejecutar(() => d.pedidos.insertar(pedido('k')));
    await expect(d.uow.ejecutar(() => d.pedidos.insertar(pedido('k')))).rejects.toThrow('unicidad');
    await expect(d.uow.ejecutar(() => d.pedidos.insertar(pedido('k', uuid(9))))).resolves.toBeDefined();
  });

  it('reservar es todo o nada y una clave de operación no reserva dos veces', async () => {
    const d = montarDobles();
    d.inventario.fijarDisponible(uuid(10), 5);
    d.inventario.fijarDisponible(uuid(11), 1);
    const items = [{ productoId: uuid(10), cantidad: 3 }, { productoId: uuid(11), cantidad: 2 }];
    const e = await d.uow.ejecutar(() => d.inventario.reservar({ claveOperacion: 'a', items, expiraEn: AHORA })).catch((x: unknown) => x);
    expect(e).toBeInstanceOf(StockInsuficientePedidoError);
    expect((e as StockInsuficientePedidoError).productoId).toBe(uuid(11));
    expect(d.inventario.disponibleDe(uuid(10))).toBe(5);
    await d.uow.ejecutar(() => d.inventario.reservar({ claveOperacion: 'b', items: [{ productoId: uuid(10), cantidad: 3 }], expiraEn: AHORA }));
    expect(d.inventario.disponibleDe(uuid(10))).toBe(2);
    await expect(d.uow.ejecutar(() => d.inventario.reservar({ claveOperacion: 'b', items: [{ productoId: uuid(10), cantidad: 1 }], expiraEn: AHORA }))).rejects.toThrow('ya reservó');
  });

  it('listar e historial: solo los pedidos del cliente; ajeno ⇒ null', async () => {
    const d = montarDobles();
    const p = await d.uow.ejecutar(async () => { const x = await d.pedidos.insertar(pedido('k')); await d.pedidos.guardarDetalle(x); return x; });
    expect((await d.pedidos.listar(uuid(1), { limite: 10, desplazamiento: 0 })).items.map((r) => r.codigo)).toEqual([p.codigo]);
    expect((await d.pedidos.listar(uuid(9), { limite: 10, desplazamiento: 0 })).total).toBe(0);
    expect((await d.pedidos.historial(uuid(1), p.id, { limite: 10, desplazamiento: 0 }))?.items[0]).toMatchObject({ estadoAnterior: null, estadoNuevo: 'ESPERANDO_PAGO', origen: 'CREAR_PEDIDO' });
    expect(await d.pedidos.historial(uuid(9), p.id, { limite: 10, desplazamiento: 0 })).toBeNull();
    expect(await d.pedidos.buscarPorId(uuid(9), p.id)).toBeNull();
  });
});
