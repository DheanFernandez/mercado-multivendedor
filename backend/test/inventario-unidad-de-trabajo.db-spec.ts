/**
 * T002 · Inventario participa en la unidad de trabajo (spec 003-pedidos-subpedidos; RF25, RF15; riesgo R2).
 * El repositorio REAL de Inventario, construido sobre un `PrismaService` real, debe unirse a la transacción de la unidad:
 * sus 4 escrituras (`variarStock`, `reservar`, `liberar`, `confirmarVenta`) comparten la transacción y se revierten con ella.
 * Fuera de una unidad su comportamiento no cambia (lo comprueban las suites existentes de Inventario, que usan un cliente simple).
 *
 * Solo el PostgreSQL local aislado. Los datos se crean con una etiqueta única y se eliminan al terminar (solo los propios).
 */
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { ReservarInventario } from '../src/modules/inventory/application/use-cases/inventario.use-cases.js';
import { StockInsuficienteError as ErrorDelIndice } from '../src/modules/inventory/index.js';
import { PrismaInventarioRepository } from '../src/modules/inventory/infrastructure/prisma-inventario.repository.js';
import { ClienteBaseEnUnidadError } from '../src/shared/infrastructure/prisma/contexto-transaccional.js';
import { abrirBase, clave, etiqueta, Fixtures, intentar, manana, reservadoSuperaFisico } from './helpers/inventario-db.js';
import { crearPrismaService } from './helpers/prisma-service-db.js';

const { prisma } = abrirBase(); // cliente simple: solo prepara y verifica datos desde OTRA conexión
const servicio = crearPrismaService('t002', 10); // el servicio REAL con unidad de trabajo
const repo = new PrismaInventarioRepository(servicio);
const reservar = new ReservarInventario(repo);
const fx = new Fixtures(prisma, etiqueta());

type Estado = { fisico: number; reservado: number; reservas: number; liberadas: number; movimientos: number };
async function estadoDe(productoId: string, claveOp?: string): Promise<Estado> {
  const [f] = await prisma.$queryRaw<{ fisico: number | null; reservado: number | null; reservas: number; liberadas: number; movimientos: number }[]>`
    SELECT i.stock_fisico AS fisico, i.stock_reservado AS reservado,
      (SELECT count(*)::int FROM reservas_inventario r WHERE r.inventario_id = i.id AND (${claveOp ?? null}::text IS NULL OR r.clave_operacion = ${claveOp ?? null})) AS reservas,
      (SELECT count(*)::int FROM reservas_inventario r WHERE r.inventario_id = i.id AND r.estado = 'LIBERADA') AS liberadas,
      (SELECT count(*)::int FROM movimientos_inventario m WHERE m.inventario_id = i.id) AS movimientos
    FROM inventarios i WHERE i.producto_id = ${productoId}::uuid`;
  return f ? { fisico: f.fisico ?? 0, reservado: f.reservado ?? 0, reservas: f.reservas, liberadas: f.liberadas, movimientos: f.movimientos } : { fisico: 0, reservado: 0, reservas: 0, liberadas: 0, movimientos: 0 };
}
const infoTx = async () => (await servicio.db.$queryRaw<{ txid: string; pid: number }[]>`SELECT txid_current()::text AS txid, pg_backend_pid()::int AS pid`)[0]!;
const prod = (id: string) => ({ productoId: id });

beforeAll(async () => { await prisma.$connect(); });
afterEach(async () => { expect(await reservadoSuperaFisico(prisma)).toBe(0); });
afterAll(async () => {
  await fx.limpiar();
  await servicio.$disconnect();
  await prisma.$disconnect();
});

describe('reservar dentro de una unidad comparte la transacción y se revierte con ella', () => {
  it('las filas que crea `reservar` pertenecen a la transacción de la unidad (mismo xid) y no son visibles desde fuera antes del COMMIT', async () => {
    const { productoId } = await fx.productoConStock(10);
    const k = clave('t002');
    const r = await servicio.unidadDeTrabajo(async () => {
      await reservar.ejecutar({ claveOperacion: k, items: [{ ...prod(productoId), cantidad: 3 }], expiraEn: manana() });
      const tx = await infoTx();
      const [m] = await servicio.db.$queryRaw<{ reserva: boolean; inventario: boolean; movimiento: boolean }[]>`
        SELECT
          (SELECT bool_and(r.xmin::text = (txid_current() % 4294967296)::text) FROM reservas_inventario r WHERE r.clave_operacion = ${k}) AS reserva,
          (SELECT i.xmin::text = (txid_current() % 4294967296)::text FROM inventarios i WHERE i.producto_id = ${productoId}::uuid) AS inventario,
          (SELECT bool_and(mi.xmin::text = (txid_current() % 4294967296)::text) FROM movimientos_inventario mi JOIN inventarios i ON i.id = mi.inventario_id WHERE i.producto_id = ${productoId}::uuid AND mi.tipo = 'RESERVA') AS movimiento`;
      expect(await estadoDe(productoId, k)).toMatchObject({ reservado: 0, reservas: 0 }); // otra conexión no ve nada sin confirmar
      return { tx, m: m! };
    });
    expect(r.m).toEqual({ reserva: true, inventario: true, movimiento: true });
    expect(await estadoDe(productoId, k)).toMatchObject({ fisico: 10, reservado: 3, reservas: 1 });
  });

  it('si la unidad falla después de reservar, se revierte todo (reserva, movimiento y stock reservado)', async () => {
    const { productoId } = await fx.productoConStock(10);
    const k = clave('t002r');
    const antes = await estadoDe(productoId);
    let intentos = 0;
    await expect(
      servicio.unidadDeTrabajo(async () => {
        intentos++;
        await reservar.ejecutar({ claveOperacion: k, items: [{ ...prod(productoId), cantidad: 4 }], expiraEn: manana() });
        throw new Error('fallo posterior a la reserva');
      }),
    ).rejects.toThrow('fallo posterior');
    expect(intentos).toBe(1);
    expect(await estadoDe(productoId, k)).toEqual({ ...antes, reservas: 0 });
  });

  it('una reserva repetida (misma clave) dentro de una unidad sigue siendo idempotente', async () => {
    const { productoId } = await fx.productoConStock(10);
    const k = clave('t002i');
    const r = await servicio.unidadDeTrabajo(async () => {
      const a = await reservar.ejecutar({ claveOperacion: k, items: [{ ...prod(productoId), cantidad: 2 }], expiraEn: manana() });
      const b = await reservar.ejecutar({ claveOperacion: k, items: [{ ...prod(productoId), cantidad: 2 }], expiraEn: manana() });
      return { a: a.repetida, b: b.repetida };
    });
    expect(r).toEqual({ a: false, b: true });
    expect(await estadoDe(productoId, k)).toMatchObject({ reservado: 2, reservas: 1 });
  });
});

describe('las otras tres escrituras también participan', () => {
  it('variarStock dentro de una unidad se revierte con ella', async () => {
    const { productoId, puestoId } = await fx.productoConStock(10);
    const actorId = (await prisma.puesto.findUniqueOrThrow({ where: { id: puestoId }, include: { comerciante: true } })).comerciante.usuarioId;
    const antes = await estadoDe(productoId);
    await expect(
      servicio.unidadDeTrabajo(async () => {
        await repo.variarStock({ productoId, puestoId, tipo: 'INGRESO', delta: 5, motivo: null, actorId });
        throw new Error('fallo');
      }),
    ).rejects.toThrow('fallo');
    expect(await estadoDe(productoId)).toEqual(antes);
  });

  it('liberar dentro de una unidad se revierte con ella (la reserva sigue RESERVADA)', async () => {
    const { productoId } = await fx.productoConStock(10);
    const k = clave('t002l');
    await reservar.ejecutar({ claveOperacion: k, items: [{ ...prod(productoId), cantidad: 3 }], expiraEn: manana() }); // fuera de una unidad (comportamiento de siempre)
    const antes = await estadoDe(productoId, k);
    expect(antes).toMatchObject({ reservado: 3, reservas: 1, liberadas: 0 });
    await expect(
      servicio.unidadDeTrabajo(async () => {
        await repo.liberar({ claveOperacion: k, motivo: 'CANCELACION' });
        throw new Error('fallo');
      }),
    ).rejects.toThrow('fallo');
    expect(await estadoDe(productoId, k)).toEqual(antes);
  });

  it('confirmarVenta dentro de una unidad se revierte con ella (el stock físico no baja)', async () => {
    const { productoId } = await fx.productoConStock(10);
    const k = clave('t002c');
    await reservar.ejecutar({ claveOperacion: k, items: [{ ...prod(productoId), cantidad: 3 }], expiraEn: manana() });
    const antes = await estadoDe(productoId, k);
    await expect(
      servicio.unidadDeTrabajo(async () => {
        await repo.confirmarVenta({ claveOperacion: k });
        throw new Error('fallo');
      }),
    ).rejects.toThrow('fallo');
    expect(await estadoDe(productoId, k)).toEqual(antes);
  });

  it('varias escrituras de Inventario en la misma unidad son todo-o-nada: si la reserva falla, el ingreso previo se revierte', async () => {
    const { productoId, puestoId } = await fx.productoConStock(5);
    const actorId = (await prisma.puesto.findUniqueOrThrow({ where: { id: puestoId }, include: { comerciante: true } })).comerciante.usuarioId;
    const antes = await estadoDe(productoId);
    const error = await intentar(() =>
      servicio.unidadDeTrabajo(async () => {
        await repo.variarStock({ productoId, puestoId, tipo: 'INGRESO', delta: 2, motivo: null, actorId }); // stock 7
        await reservar.ejecutar({ claveOperacion: clave('t002x'), items: [{ ...prod(productoId), cantidad: 9 }], expiraEn: manana() }); // > 7
      }),
    );
    expect(error.ok).toBe(false);
    expect(await estadoDe(productoId)).toEqual(antes);
  });

  it('y si todo sale bien, las escrituras de la unidad se confirman juntas', async () => {
    const { productoId, puestoId } = await fx.productoConStock(5);
    const actorId = (await prisma.puesto.findUniqueOrThrow({ where: { id: puestoId }, include: { comerciante: true } })).comerciante.usuarioId;
    const k = clave('t002ok');
    await servicio.unidadDeTrabajo(async () => {
      await repo.variarStock({ productoId, puestoId, tipo: 'INGRESO', delta: 2, motivo: null, actorId });
      await reservar.ejecutar({ claveOperacion: k, items: [{ ...prod(productoId), cantidad: 6 }], expiraEn: manana() });
    });
    expect(await estadoDe(productoId, k)).toMatchObject({ fisico: 7, reservado: 6, reservas: 1 });
  });
});

describe('error de falta de stock como contrato público', () => {
  it('`StockInsuficienteError` se exporta desde inventory/index.ts, trae el producto y no se reintenta', async () => {
    const { productoId } = await fx.productoConStock(1);
    let intentos = 0;
    const r = await intentar(() =>
      servicio.unidadDeTrabajo(async () => {
        intentos++;
        await reservar.ejecutar({ claveOperacion: clave('t002s'), items: [{ ...prod(productoId), cantidad: 2 }], expiraEn: manana() });
      }),
    );
    expect(r.ok).toBe(false);
    const e = (r as { ok: false; error: unknown }).error;
    expect(e).toBeInstanceOf(ErrorDelIndice);
    expect((e as ErrorDelIndice).productoId).toBe(productoId);
    expect(intentos).toBe(1);
  });
});

describe('concurrencia con unidades de trabajo (RF25 · AC07)', () => {
  it('10 unidades concurrentes por 1 unidad de stock: exactamente una reserva y nunca más reservado que físico', async () => {
    const { productoId } = await fx.productoConStock(1);
    const rs = await Promise.all(
      Array.from({ length: 10 }, () =>
        intentar(() =>
          servicio.unidadDeTrabajo(async () => {
            await reservar.ejecutar({ claveOperacion: clave('t002cc'), items: [{ ...prod(productoId), cantidad: 1 }], expiraEn: manana() });
          }),
        ),
      ),
    );
    expect(rs.filter((r) => r.ok)).toHaveLength(1);
    expect(rs.filter((r) => !r.ok).every((r) => (r as { error: unknown }).error instanceof ErrorDelIndice)).toBe(true);
    expect(await estadoDe(productoId)).toMatchObject({ fisico: 1, reservado: 1 });
  });
});

describe('límite conocido: las lecturas del repositorio aún usan el cliente base', () => {
  it('dentro de una unidad, una lectura del repositorio (obtener) es rechazada por el resguardo en lugar de abrir otra conexión', async () => {
    const { productoId } = await fx.productoConStock(3);
    await expect(servicio.unidadDeTrabajo(async () => { await repo.obtener(productoId); })).rejects.toBeInstanceOf(ClienteBaseEnUnidadError);
    // fuera de una unidad sigue funcionando
    expect((await repo.obtener(productoId))?.stockFisico).toBe(3);
  });
});
