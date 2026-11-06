/**
 * Inventario contra PostgreSQL local de Docker (npm run test:db): restricciones del modelo, reservas atómicas,
 * concurrencia, integridad e idempotencia (ADR-003; RF12–RF15, RF25; AC07, AC08). Nunca se ejecuta contra una base remota.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ClaveOperacionReutilizadaError, ReservaYaConfirmadaError, StockFisicoInsuficienteError, StockInsuficienteError } from '../src/modules/inventory/domain/errors.js';
import { abrirBase, clave, etiqueta, Fixtures, intentar, manana, reservadoSuperaFisico } from './helpers/inventario-db.js';

const { prisma, repo, reservar } = abrirBase();
const fx = new Fixtures(prisma, etiqueta());
const reservarUno = (productoId: string, k: string, cantidad = 1) => reservar.ejecutar({ claveOperacion: k, items: [{ productoId, cantidad }], expiraEn: manana() });
const stockDe = async (productoId: string) => (await repo.obtener(productoId))!;
const SQL = async (productoId: string) => {
  const [f] = await prisma.$queryRaw<{ f: number; r: number; mov: bigint }[]>`
    SELECT i.stock_fisico AS f, i.stock_reservado AS r,
           (SELECT coalesce(sum(variacion_fisica), 0) FROM movimientos_inventario m WHERE m.inventario_id = i.id) AS mov
    FROM inventarios i WHERE i.producto_id = ${productoId}::uuid`;
  return { fisico: f!.f, reservado: f!.r, sumaMovimientosFisicos: Number(f!.mov) };
};

beforeAll(async () => { await prisma.$connect(); });
afterAll(async () => {
  expect(await reservadoSuperaFisico(prisma)).toBe(0); // invariante global de toda la base de pruebas
  await fx.limpiar();
  await prisma.$disconnect();
});

describe('restricciones del modelo (AC08)', () => {
  it('la base rechaza reservado > físico, valores negativos, cantidades no positivas y claves vacías', async () => {
    const { productoId, puestoId } = await fx.productoConStock(5);
    const inv = (await prisma.inventario.findUnique({ where: { productoId } }))!;
    const rechaza = async (q: Promise<unknown>) => { expect((await intentar(() => q)).ok).toBe(false); };
    await rechaza(prisma.$executeRaw`UPDATE inventarios SET stock_reservado = 6 WHERE id = ${inv.id}::uuid`);
    await rechaza(prisma.$executeRaw`UPDATE inventarios SET stock_fisico = -1, stock_reservado = 0 WHERE id = ${inv.id}::uuid`);
    await rechaza(prisma.$executeRaw`UPDATE inventarios SET stock_reservado = -1 WHERE id = ${inv.id}::uuid`);
    await rechaza(prisma.$executeRaw`INSERT INTO reservas_inventario (id, clave_operacion, inventario_id, cantidad, expira_en) VALUES (gen_random_uuid(), 'x', ${inv.id}::uuid, 0, now())`);
    await rechaza(prisma.$executeRaw`INSERT INTO reservas_inventario (id, clave_operacion, inventario_id, cantidad, expira_en) VALUES (gen_random_uuid(), '', ${inv.id}::uuid, 1, now())`);
    await rechaza(prisma.$executeRaw`INSERT INTO movimientos_inventario (id, inventario_id, tipo, variacion_fisica, variacion_reservada, stock_fisico_despues, stock_reservado_despues) VALUES (gen_random_uuid(), ${inv.id}::uuid, 'AJUSTE', 0, 0, 5, 0)`);
    expect(puestoId).toBeTruthy();
    expect(await stockDe(productoId)).toMatchObject({ stockFisico: 5, stockReservado: 0 });
  });

  it('el inventario no puede declarar un puesto distinto al del producto (clave foránea compuesta) ni duplicarse', async () => {
    const a = await fx.productoConStock(0);
    const otro = await fx.puesto();
    expect((await intentar(() => prisma.inventario.create({ data: { productoId: a.productoId, puestoId: otro.puestoId } }))).ok).toBe(false);
    await prisma.inventario.create({ data: { productoId: a.productoId, puestoId: a.puestoId } });
    expect((await intentar(() => prisma.inventario.create({ data: { productoId: a.productoId, puestoId: a.puestoId } }))).ok).toBe(false);
  });
});

describe('movimientos y actualizaciones de stock (RF12, RF13)', () => {
  it('ingreso, devolución y ajuste crean el inventario si falta, actualizan el saldo y dejan el libro de movimientos', async () => {
    const { productoId, puestoId } = await fx.productoConStock(0);
    const actorId = (await prisma.puesto.findUniqueOrThrow({ where: { id: puestoId }, include: { comerciante: true } })).comerciante.usuarioId;
    await repo.variarStock({ productoId, puestoId, tipo: 'INGRESO', delta: 10, motivo: null, actorId });
    await repo.variarStock({ productoId, puestoId, tipo: 'DEVOLUCION', delta: 2, motivo: null, actorId });
    const v = await repo.variarStock({ productoId, puestoId, tipo: 'AJUSTE', delta: -3, motivo: 'merma', actorId });
    expect(v).toMatchObject({ stockFisico: 9, stockReservado: 0, stockDisponible: 9 });
    const m = await repo.listarMovimientos(productoId, { limite: 10, desplazamiento: 0 });
    expect(m.total).toBe(3);
    expect(m.items.map((x) => x.tipo).sort()).toEqual(['AJUSTE', 'DEVOLUCION', 'INGRESO']);
    expect(m.items.find((x) => x.tipo === 'AJUSTE')).toMatchObject({ variacionFisica: -3, stockFisicoDespues: 9, motivo: 'merma', actorId });
    expect(await SQL(productoId)).toEqual({ fisico: 9, reservado: 0, sumaMovimientosFisicos: 9 });
  });

  it('prevención de stock negativo: un ajuste que dejaría el físico < reservado se rechaza y nada cambia', async () => {
    const { productoId, puestoId } = await fx.productoConStock(5);
    await reservarUno(productoId, clave('neg'), 4);
    const falla = await intentar(() => repo.variarStock({ productoId, puestoId, tipo: 'AJUSTE', delta: -2, motivo: 'x', actorId: '00000000-0000-4000-8000-000000000001' }));
    expect(!falla.ok && falla.error).toBeInstanceOf(StockFisicoInsuficienteError);
    expect(await stockDe(productoId)).toMatchObject({ stockFisico: 5, stockReservado: 4 });
    const movs = await repo.listarMovimientos(productoId, { limite: 50, desplazamiento: 0 });
    expect(movs.items.map((x) => x.tipo)).toEqual(['RESERVA']); // el ajuste fallido no dejó movimiento
  });

  it('actualizaciones simultáneas: 60 ingresos de +1 en paralelo suman exactamente 60 (ninguna se pisa)', async () => {
    const { productoId, puestoId } = await fx.productoConStock(0);
    const res = await Promise.all(Array.from({ length: 60 }, () => intentar(() => repo.variarStock({ productoId, puestoId, tipo: 'INGRESO', delta: 1, motivo: null, actorId: '00000000-0000-4000-8000-000000000001' }))));
    expect(res.every((r) => r.ok)).toBe(true);
    expect(await SQL(productoId)).toEqual({ fisico: 60, reservado: 0, sumaMovimientosFisicos: 60 });
  });

  it('prevención de stock negativo bajo concurrencia: 30 ajustes de −1 sobre stock 10 → exactamente 10 se aplican', async () => {
    const { productoId, puestoId } = await fx.productoConStock(10);
    const res = await Promise.all(Array.from({ length: 30 }, () => intentar(() => repo.variarStock({ productoId, puestoId, tipo: 'AJUSTE', delta: -1, motivo: 'x', actorId: '00000000-0000-4000-8000-000000000001' }))));
    expect(res.filter((r) => r.ok)).toHaveLength(10);
    expect(res.filter((r) => !r.ok).every((r) => !r.ok && r.error instanceof StockFisicoInsuficienteError)).toBe(true);
    expect(await SQL(productoId)).toEqual({ fisico: 0, reservado: 0, sumaMovimientosFisicos: -10 });
  });
});

describe('reservas: stock suficiente e insuficiente', () => {
  it('reserva si alcanza y deja físico/reservado/disponible correctos, con su movimiento', async () => {
    const { productoId } = await fx.productoConStock(10);
    const r = await reservarUno(productoId, clave('ok'), 4);
    expect(r).toMatchObject({ repetida: false, reservas: [{ productoId, cantidad: 4, estado: 'RESERVADA' }] });
    expect(await stockDe(productoId)).toMatchObject({ stockFisico: 10, stockReservado: 4, stockDisponible: 6 });
    expect((await repo.listarMovimientos(productoId, { limite: 5, desplazamiento: 0 })).items[0]).toMatchObject({ tipo: 'RESERVA', variacionReservada: 4, stockReservadoDespues: 4 });
  });

  it('rechaza con falta de stock si no alcanza (respuesta controlada) y no deja rastro', async () => {
    const { productoId } = await fx.productoConStock(3);
    const k = clave('no');
    const r = await intentar(() => reservarUno(productoId, k, 4));
    expect(!r.ok && r.error).toBeInstanceOf(StockInsuficienteError);
    expect(await stockDe(productoId)).toMatchObject({ stockReservado: 0 });
    expect(await prisma.reservaInventario.count({ where: { claveOperacion: k } })).toBe(0);
  });

  it('un producto sin fila de existencias no se puede reservar', async () => {
    const { productoId } = await fx.productoConStock(0);
    const r = await intentar(() => reservarUno(productoId, clave('vacio')));
    expect(!r.ok && r.error).toBeInstanceOf(StockInsuficienteError);
  });
});

describe('concurrencia: dos o más compradores sobre las mismas unidades (AC07)', () => {
  it('dos compradores y un solo stock: uno gana, el otro recibe falta de stock', async () => {
    for (let i = 0; i < 25; i++) {
      const { productoId } = await fx.productoConStock(1);
      const res = await Promise.all([intentar(() => reservarUno(productoId, clave('a'))), intentar(() => reservarUno(productoId, clave('b')))]);
      expect(res.filter((r) => r.ok)).toHaveLength(1);
      const perdedor = res.find((r) => !r.ok);
      expect(perdedor && !perdedor.ok && perdedor.error).toBeInstanceOf(StockInsuficienteError);
      expect(await stockDe(productoId)).toMatchObject({ stockFisico: 1, stockReservado: 1, stockDisponible: 0 });
    }
  });

  it('50 compradores y stock 7: exactamente 7 reservas, el resto falta de stock', async () => {
    const { productoId } = await fx.productoConStock(7);
    const res = await Promise.all(Array.from({ length: 50 }, () => intentar(() => reservarUno(productoId, clave('m')))));
    expect(res.filter((r) => r.ok)).toHaveLength(7);
    expect(res.filter((r) => !r.ok).every((r) => !r.ok && r.error instanceof StockInsuficienteError)).toBe(true);
    expect(await stockDe(productoId)).toMatchObject({ stockReservado: 7, stockDisponible: 0 });
  });

  it('cantidades distintas: lo reservado nunca supera el físico y coincide con las reservas aceptadas', async () => {
    const { productoId } = await fx.productoConStock(10);
    const pedidos = [3, 3, 3, 3, 2, 2, 4, 1, 1, 5];
    const res = await Promise.all(pedidos.map((c) => intentar(() => reservarUno(productoId, clave('v'), c))));
    const aceptado = res.reduce((s, r, i) => s + (r.ok ? pedidos[i]! : 0), 0);
    expect(aceptado).toBeLessThanOrEqual(10);
    const s = await stockDe(productoId);
    expect(s.stockReservado).toBe(aceptado);
    expect(s.stockReservado).toBeLessThanOrEqual(s.stockFisico);
    expect(res.filter((r) => !r.ok).every((r) => !r.ok && r.error instanceof StockInsuficienteError)).toBe(true);
  });

  it('reservas y ajustes simultáneos sobre el mismo producto conservan la invariante y el libro cuadra', async () => {
    const { productoId, puestoId } = await fx.productoConStock(20);
    const actorId = '00000000-0000-4000-8000-000000000001';
    const ops = [
      ...Array.from({ length: 25 }, () => () => reservarUno(productoId, clave('r'))),
      ...Array.from({ length: 25 }, () => () => repo.variarStock({ productoId, puestoId, tipo: 'AJUSTE', delta: -1, motivo: 'x', actorId })),
    ];
    const res = await Promise.all(ops.map((o) => intentar(o)));
    const reservasOk = res.slice(0, 25).filter((r) => r.ok).length;
    const ajustesOk = res.slice(25).filter((r) => r.ok).length;
    const sql = await SQL(productoId);
    expect(sql.reservado).toBe(reservasOk);
    expect(sql.fisico).toBe(20 - ajustesOk);
    expect(sql.reservado).toBeLessThanOrEqual(sql.fisico);
    expect(sql.sumaMovimientosFisicos + ajustesOk).toBe(0); // el libro registra exactamente los ajustes aplicados
    // Ningún error inesperado: solo faltas de stock controladas.
    expect(res.filter((r) => !r.ok).every((r) => !r.ok && (r.error instanceof StockInsuficienteError || r.error instanceof StockFisicoInsuficienteError))).toBe(true);
  });

  it('productos distintos del mismo puesto no se afectan entre sí', async () => {
    const { puestoId } = await fx.puesto();
    const ids = await Promise.all(Array.from({ length: 15 }, () => fx.producto(puestoId, 2)));
    const res = await Promise.all(ids.flatMap((id) => [intentar(() => reservarUno(id, clave('x'))), intentar(() => reservarUno(id, clave('y')))]));
    expect(res.every((r) => r.ok)).toBe(true);
    for (const id of ids) expect(await stockDe(id)).toMatchObject({ stockReservado: 2 });
  });
});

describe('integridad de las transacciones (AC08)', () => {
  it('reserva multiproducto todo-o-nada: si un producto no alcanza, ninguno queda reservado (en ambos órdenes)', async () => {
    const { puestoId } = await fx.puesto();
    // Dos productos; se prueba con cada uno como el insuficiente, de modo que el fallo ocurre a mitad de la transacción en al menos un caso.
    for (const [okPrimero] of [[true], [false]] as const) {
      const bueno = await fx.producto(puestoId, 5);
      const escaso = await fx.producto(puestoId, 1);
      const k = clave('multi');
      const items = okPrimero ? [{ productoId: bueno, cantidad: 2 }, { productoId: escaso, cantidad: 2 }] : [{ productoId: escaso, cantidad: 2 }, { productoId: bueno, cantidad: 2 }];
      const r = await intentar(() => reservar.ejecutar({ claveOperacion: k, items, expiraEn: manana() }));
      expect(!r.ok && r.error).toBeInstanceOf(StockInsuficienteError);
      expect(await stockDe(bueno)).toMatchObject({ stockReservado: 0 });
      expect(await stockDe(escaso)).toMatchObject({ stockReservado: 0 });
      expect(await prisma.reservaInventario.count({ where: { claveOperacion: k } })).toBe(0);
      expect(await prisma.movimientoInventario.count({ where: { referencia: k } })).toBe(0);
    }
  });

  it('una reserva multiproducto válida reserva todos los productos o ninguno, también en concurrencia', async () => {
    const { puestoId } = await fx.puesto();
    const x = await fx.producto(puestoId, 3);
    const y = await fx.producto(puestoId, 3);
    // 10 pedidos que piden 1 de X y 1 de Y, la mitad con los ítems en orden inverso (sin interbloqueos): solo caben 3.
    const res = await Promise.all(Array.from({ length: 10 }, (_, i) => intentar(() => repo.reservar({
      claveOperacion: clave('par'),
      items: i % 2 ? [{ productoId: x, cantidad: 1 }, { productoId: y, cantidad: 1 }] : [{ productoId: y, cantidad: 1 }, { productoId: x, cantidad: 1 }],
      expiraEn: manana(),
    }))));
    expect(res.filter((r) => r.ok)).toHaveLength(3);
    expect(res.filter((r) => !r.ok).every((r) => !r.ok && r.error instanceof StockInsuficienteError)).toBe(true);
    expect(await stockDe(x)).toMatchObject({ stockReservado: 3 });
    expect(await stockDe(y)).toMatchObject({ stockReservado: 3 });
  });

  it('una violación de CHECK a mitad de la transacción revierte todo lo anterior de esa transacción', async () => {
    const { productoId } = await fx.productoConStock(5);
    class Revertir extends Error {}
    await intentar(() => prisma.$transaction(async (tx) => {
      await tx.$executeRaw`UPDATE inventarios SET stock_reservado = 2 WHERE producto_id = ${productoId}::uuid`;
      await tx.$executeRaw`UPDATE inventarios SET stock_reservado = 99 WHERE producto_id = ${productoId}::uuid`; // viola el CHECK
    }));
    await intentar(() => prisma.$transaction(async (tx) => {
      await tx.$executeRaw`UPDATE inventarios SET stock_reservado = 3 WHERE producto_id = ${productoId}::uuid`;
      throw new Revertir();
    }));
    expect(await stockDe(productoId)).toMatchObject({ stockFisico: 5, stockReservado: 0 });
  });
});

describe('reintentos e idempotencia (ADR-003 §7)', () => {
  it('el mismo pedido enviado 12 veces a la vez reserva una sola vez y todos reciben el mismo resultado', async () => {
    const { productoId } = await fx.productoConStock(10);
    const k = clave('dup');
    const res = await Promise.all(Array.from({ length: 12 }, () => intentar(() => reservarUno(productoId, k, 4))));
    expect(res.every((r) => r.ok)).toBe(true);
    const oks = res.map((r) => (r.ok ? r.valor : null)!);
    expect(oks.filter((r) => !r.repetida)).toHaveLength(1);
    expect(oks.every((r) => r.reservas[0]!.cantidad === 4 && r.reservas[0]!.estado === 'RESERVADA')).toBe(true);
    expect(await stockDe(productoId)).toMatchObject({ stockReservado: 4 });
    expect(await prisma.reservaInventario.count({ where: { claveOperacion: k } })).toBe(1);
    expect(await prisma.movimientoInventario.count({ where: { referencia: k, tipo: 'RESERVA' } })).toBe(1);
  });

  it('reintentar después de confirmada devuelve el resultado anterior; con otros datos es conflicto', async () => {
    const { productoId } = await fx.productoConStock(10);
    const k = clave('r');
    await reservarUno(productoId, k, 2);
    expect((await reservarUno(productoId, k, 2)).repetida).toBe(true);
    const otro = await intentar(() => reservarUno(productoId, k, 3));
    expect(!otro.ok && otro.error).toBeInstanceOf(ClaveOperacionReutilizadaError);
    expect(await stockDe(productoId)).toMatchObject({ stockReservado: 2 });
  });

  it('la misma clave simultánea con stock justo: se concede una vez y el reintento no consume otra unidad', async () => {
    const { productoId } = await fx.productoConStock(1);
    const k = clave('justo');
    const res = await Promise.all(Array.from({ length: 8 }, () => intentar(() => reservarUno(productoId, k, 1))));
    expect(res.every((r) => r.ok)).toBe(true);
    expect(await stockDe(productoId)).toMatchObject({ stockReservado: 1 });
  });
});

describe('liberación, venta y expiración (ADR-003 §6.4–6.5)', () => {
  it('liberar 10 veces a la vez devuelve las unidades una sola vez', async () => {
    const { productoId } = await fx.productoConStock(10);
    const k = clave('lib');
    await reservarUno(productoId, k, 4);
    const res = await Promise.all(Array.from({ length: 10 }, () => intentar(() => repo.liberar({ claveOperacion: k, motivo: 'CANCELACION' }))));
    expect(res.every((r) => r.ok)).toBe(true);
    expect(res.reduce((s, r) => s + (r.ok ? r.valor.liberadas : 0), 0)).toBe(4);
    expect(await stockDe(productoId)).toMatchObject({ stockFisico: 10, stockReservado: 0 });
    expect(await prisma.movimientoInventario.count({ where: { referencia: k, tipo: 'LIBERACION' } })).toBe(1);
  });

  it('confirmar la venta 10 veces a la vez descuenta una sola vez (físico y reservado)', async () => {
    const { productoId } = await fx.productoConStock(10);
    const k = clave('ven');
    await reservarUno(productoId, k, 4);
    const res = await Promise.all(Array.from({ length: 10 }, () => intentar(() => repo.confirmarVenta({ claveOperacion: k }))));
    expect(res.reduce((s, r) => s + (r.ok ? r.valor.confirmadas : 0), 0)).toBe(4);
    expect(await SQL(productoId)).toMatchObject({ fisico: 6, reservado: 0 });
  });

  it('liberar y confirmar a la vez sobre el mismo pedido: gana uno solo y el stock queda coherente', async () => {
    for (let i = 0; i < 20; i++) {
      const { productoId } = await fx.productoConStock(10);
      const k = clave('carrera');
      await reservarUno(productoId, k, 4);
      const [lib, conf] = await Promise.all([intentar(() => repo.liberar({ claveOperacion: k, motivo: 'X' })), intentar(() => repo.confirmarVenta({ claveOperacion: k }))]);
      const s = await SQL(productoId);
      const libero = lib.ok && lib.valor.liberadas === 4;
      const vendio = conf.ok && conf.valor.confirmadas === 4;
      expect(libero !== vendio).toBe(true); // exactamente uno
      expect(s).toMatchObject(libero ? { fisico: 10, reservado: 0 } : { fisico: 6, reservado: 0 });
      if (!lib.ok) expect(lib.error).toBeInstanceOf(ReservaYaConfirmadaError);
    }
  });

  it('la expiración libera solo lo vencido, es idempotente y respeta lo ya confirmado', async () => {
    const { productoId } = await fx.productoConStock(10);
    const vencida = clave('vencida');
    const vigente = clave('vigente');
    const pagada = clave('pagada');
    await reservarUno(productoId, vencida, 2);
    await reservarUno(productoId, vigente, 3);
    await reservarUno(productoId, pagada, 1);
    await repo.confirmarVenta({ claveOperacion: pagada });
    await prisma.$executeRaw`UPDATE reservas_inventario SET expira_en = now() - interval '1 minute' WHERE clave_operacion IN (${vencida}, ${pagada})`;
    const ahora = new Date();
    const claves = (await repo.clavesVencidas(ahora, 100)).filter((c) => [vencida, vigente, pagada].includes(c));
    expect(claves).toEqual([vencida]); // la pagada ya no está RESERVADA; la vigente no venció
    const res = await Promise.all(Array.from({ length: 5 }, () => repo.liberar({ claveOperacion: vencida, soloVencidasAl: ahora, motivo: 'EXPIRACION' })));
    expect(res.reduce((s, r) => s + r.liberadas, 0)).toBe(2);
    expect(await SQL(productoId)).toMatchObject({ fisico: 9, reservado: 3 });
  });

  it('expiración y confirmación simultáneas (Webhook) sobre el mismo pedido: nunca se libera lo ya vendido', async () => {
    for (let i = 0; i < 20; i++) {
      const { productoId } = await fx.productoConStock(5);
      const k = clave('exp');
      await reservarUno(productoId, k, 2);
      await prisma.$executeRaw`UPDATE reservas_inventario SET expira_en = now() - interval '1 minute' WHERE clave_operacion = ${k}`;
      const [exp, conf] = await Promise.all([intentar(() => repo.liberar({ claveOperacion: k, soloVencidasAl: new Date(), motivo: 'EXPIRACION' })), intentar(() => repo.confirmarVenta({ claveOperacion: k }))]);
      const s = await SQL(productoId);
      const expiro = exp.ok && exp.valor.liberadas === 2;
      const vendio = conf.ok && conf.valor.confirmadas === 2;
      expect(expiro !== vendio).toBe(true);
      expect(s).toMatchObject(expiro ? { fisico: 5, reservado: 0 } : { fisico: 3, reservado: 0 });
    }
  });
});
