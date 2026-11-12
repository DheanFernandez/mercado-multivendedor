/**
 * T012 · `PrismaPedidoRepository` contra PostgreSQL (spec 003-pedidos-subpedidos; RF26–RF29, RF31 · CA-O2, O3).
 *
 * Se ejecuta en un ESQUEMA DESECHABLE de la base aislada (helpers/esquema-desechable.ts): las líneas y el historial son
 * inmutables y las claves foráneas RESTRICT, de modo que las filas no se borran; se elimina el esquema completo al final.
 *
 * Alcance: el repositorio (y, para la concurrencia sobre el carrito, el repositorio REAL del carrito de T003). El caso de
 * uso completo `CrearPedido` con PostgreSQL necesita los adaptadores de T013 y el cableado de T014; sus pruebas de
 * integridad y atomicidad son T016 y las de concurrencia T017.
 */
import { randomInt } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaCarritoRepository } from '../src/modules/cart/infrastructure/prisma-carrito.repository.js';
import { ClaveIdempotenciaEnUsoError, CodigoPedidoNoGenerableError } from '../src/modules/orders/application/ports/pedido.repository.js';
import { generarCodigoPedido } from '../src/modules/orders/domain/codigo-pedido.js';
import { ReconstitucionInvalidaError } from '../src/modules/orders/domain/errors.js';
import { huellaCarrito } from '../src/modules/orders/domain/huella-carrito.js';
import { Pedido, type LineaNueva } from '../src/modules/orders/domain/pedido.entity.js';
import { PrismaPedidoRepository } from '../src/modules/orders/infrastructure/prisma-pedido.repository.js';
import type { PrismaClient } from '../src/generated/prisma/client.js';
import { UnidadDeTrabajoRequeridaError } from '../src/shared/domain/unidad-de-trabajo.error.js';
import type { PrismaService } from '../src/shared/infrastructure/prisma/prisma.service.js';
import { unidadDeTrabajo } from '../src/shared/infrastructure/prisma/unidad-de-trabajo.js';
import { DatosCarrito } from './helpers/carrito-db.js';
import { crearEsquemaDesechable, type EsquemaDesechable } from './helpers/esquema-desechable.js';
import { etiqueta, Fixtures } from './helpers/inventario-db.js';

let E: EsquemaDesechable;
let cliente: PrismaClient; // con resguardo, como PrismaService
let obs: PrismaClient; // otra conexión, sin resguardo
let datos: DatosCarrito;
const tag = etiqueta();

const azar = { generar: () => generarCodigoPedido((m) => randomInt(m)) };
/** Generador que devuelve primero los códigos dados y luego aleatorios; cuenta las llamadas. */
const generadorCon = (primeros: string[]) => {
  const g = { llamadas: 0, generar: () => { g.llamadas++; return primeros.shift() ?? azar.generar(); } };
  return g;
};
const repoCon = (c: PrismaClient, generador: { generar(): string } = azar) => new PrismaPedidoRepository(c as unknown as PrismaService, generador);
const uow = <T>(c: PrismaClient, trabajo: () => Promise<T>) => unidadDeTrabajo(c, trabajo);
const dormir = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

type Prod = { productoId: string; puestoId: string; codigo: string; nombre: string };
const BASE = new Date('2026-11-06T10:00:00.000Z');

async function producto(): Promise<Prod> {
  const p = await datos.producto(true);
  const pu = await obs.puesto.findUniqueOrThrow({ where: { id: p.puestoId } });
  return { ...p, codigo: pu.codigo, nombre: pu.nombre };
}
const linea = (p: Prod, cantidad: number, precio: number, extra: Partial<LineaNueva> = {}): LineaNueva => ({
  productoId: p.productoId, puesto: { id: p.puestoId, codigo: p.codigo, nombre: p.nombre }, nombre: `Nombre ${p.productoId.slice(-4)}`,
  unidadVenta: 'KILOGRAMO', presentacion: null, cantidad, precioUnitarioCentimos: precio, ...extra,
});
function nuevoPedido(clienteId: string, clave: string, lineas: LineaNueva[], creadoEn = BASE) {
  return Pedido.crear({
    id: crypto.randomUUID(), clienteId, claveIdempotencia: clave, carritoId: crypto.randomUUID(), huellaCarrito: huellaCarrito(lineas),
    lineas, reservaVenceEn: new Date(creadoEn.getTime() + 30 * 60_000), creadoEn, generarId: () => crypto.randomUUID(),
  });
}
/** Inserta raíz y detalle en UNA unidad (lo que hará CrearPedido en los pasos e). */
const persistir = (repo: PrismaPedidoRepository, c: PrismaClient, p: Pedido) =>
  uow(c, async () => { const conCodigo = await repo.insertar(p); await repo.guardarDetalle(conCodigo); return conCodigo; });
const contarPedidos = async (clienteId: string) => obs.pedido.count({ where: { clienteId } });

let P: Prod[] = [];
beforeAll(async () => {
  E = await crearEsquemaDesechable('t012');
  cliente = E.cliente(10);
  obs = E.observador;
  datos = new DatosCarrito(obs, new Fixtures(obs, tag), tag);
  P = [await producto(), await producto(), await producto()];
});
afterAll(async () => { await E?.eliminar(); });

describe('esquema desechable (soporte de la prueba)', () => {
  it('las consultas de modelo y el SQL crudo trabajan en el esquema desechable, no en public', async () => {
    const [r] = await cliente.$queryRaw<{ s: string }[]>`SELECT current_schema() AS s`;
    expect(r!.s).toBe(E.esquema);
    expect(await obs.usuario.count()).toBeGreaterThan(0);
  });
});

describe('persistencia exacta (CA-O3, CA-O5, RF31)', () => {
  it('raíz, subpedidos con instantánea del puesto, líneas con precio histórico e historial inicial', async () => {
    const c = await datos.cliente();
    const repo = repoCon(cliente);
    const p = nuevoPedido(c, 'persistir-1', [linea(P[0]!, 3, 10), linea(P[1]!, 3, 1999), linea(P[2]!, 2, 650, { unidadVenta: 'UNIDAD', presentacion: 'Bolsa 1 kg' })]);
    const guardado = await persistir(repo, cliente, p);
    expect(guardado.codigo).toMatch(/^PED-[0-9A-HJKMNP-TV-Z]{8}$/);

    const [raiz] = await obs.$queryRaw<{ codigo: string; cliente_id: string; clave: string; carrito_id: string; huella: string; total: string; vence: Date; creado: Date }[]>`
      SELECT codigo, cliente_id::text, clave_idempotencia AS clave, carrito_id::text, huella_carrito AS huella, total::text, reserva_vence_en AS vence, creado_en AS creado
        FROM pedidos WHERE id = ${p.id}::uuid`;
    expect(raiz).toEqual({ codigo: guardado.codigo, cliente_id: c, clave: 'persistir-1', carrito_id: p.carritoId, huella: p.huellaCarrito, total: '73.27' /* 0.30 + 59.97 + 13.00 */, vence: p.reservaVenceEn, creado: BASE });

    const subs = await obs.$queryRaw<{ puesto_id: string; puesto_codigo: string; puesto_nombre: string; estado: string; subtotal: string; creado: Date }[]>`
      SELECT puesto_id::text, puesto_codigo, puesto_nombre, estado::text, subtotal::text, creado_en AS creado FROM subpedidos WHERE pedido_id = ${p.id}::uuid ORDER BY puesto_id`;
    expect(subs).toEqual(p.subpedidos.map((s) => ({ puesto_id: s.puestoId, puesto_codigo: s.puesto.codigo, puesto_nombre: s.puesto.nombre, estado: 'ESPERANDO_PAGO', subtotal: (s.subtotalCentimos / 100).toFixed(2), creado: BASE })));

    const lineas = await obs.$queryRaw<{ producto_id: string; nombre: string; unidad: string; presentacion: string | null; cantidad: number; precio: string; subtotal: string }[]>`
      SELECT l.producto_id::text, l.nombre_producto AS nombre, l.unidad_venta::text AS unidad, l.presentacion, l.cantidad, l.precio_unitario::text AS precio, l.subtotal::text
        FROM lineas_pedido l JOIN subpedidos s ON s.id = l.subpedido_id WHERE s.pedido_id = ${p.id}::uuid ORDER BY l.producto_id`;
    const esperado = new Map([[P[0]!.productoId, ['0.10', '0.30', 3]], [P[1]!.productoId, ['19.99', '59.97', 3]], [P[2]!.productoId, ['6.50', '13.00', 2]]]);
    for (const l of lineas) expect([l.precio, l.subtotal, l.cantidad]).toEqual(esperado.get(l.producto_id));
    expect(lineas.find((l) => l.producto_id === P[2]!.productoId)).toMatchObject({ unidad: 'UNIDAD', presentacion: 'Bolsa 1 kg' });

    const hist = await obs.$queryRaw<{ anterior: string | null; nuevo: string; origen: string; actor: string | null; creado: Date }[]>`
      SELECT h.estado_anterior::text AS anterior, h.estado_nuevo::text AS nuevo, h.origen, h.actor_id::text AS actor, h.creado_en AS creado
        FROM historial_estados_subpedido h JOIN subpedidos s ON s.id = h.subpedido_id WHERE s.pedido_id = ${p.id}::uuid`;
    expect(hist).toEqual(Array(3).fill({ anterior: null, nuevo: 'ESPERANDO_PAGO', origen: 'CREAR_PEDIDO', actor: c, creado: BASE }));
  });

  it('importes máximos sin pérdida: 99 999 999.99 × 10 000 en 5 líneas, ida y vuelta exactos en céntimos', async () => {
    const c = await datos.cliente();
    const repo = repoCon(cliente);
    // cinco productos del MISMO puesto: un único subpedido con el subtotal máximo
    const fx = new Fixtures(obs, `${tag}m`);
    const mismos = [P[0]!];
    for (let i = 0; i < 4; i++) mismos.push({ ...P[0]!, productoId: await fx.producto(P[0]!.puestoId) });
    const p = nuevoPedido(c, 'maximos', mismos.map((x) => linea(x, 10_000, 9_999_999_999)));
    await persistir(repo, cliente, p);
    const [r] = await obs.$queryRaw<{ total: string; sub: string; lin: string }[]>`
      SELECT p.total::text AS total, s.subtotal::text AS sub, min(l.subtotal)::text AS lin FROM pedidos p JOIN subpedidos s ON s.pedido_id = p.id JOIN lineas_pedido l ON l.subpedido_id = s.id
       WHERE p.id = ${p.id}::uuid GROUP BY p.total, s.subtotal`;
    expect(r).toEqual({ total: '4999999999500.00', sub: '4999999999500.00', lin: '999999999900.00' });
    const leido = await repo.buscarPorId(c, p.id);
    expect(leido!.totalCentimos).toBe(499_999_999_950_000);
    expect(Number.isSafeInteger(leido!.totalCentimos)).toBe(true);
  });
});

describe('lecturas: ida y vuelta, clave y aislamiento entre clientes', () => {
  it('buscarPorClave y buscarPorId devuelven el MISMO pedido (con código) que se guardó', async () => {
    const c = await datos.cliente();
    const repo = repoCon(cliente);
    const guardado = await persistir(repo, cliente, nuevoPedido(c, 'ida-vuelta', [linea(P[0]!, 2, 333), linea(P[1]!, 1, 1)]));
    expect(await repo.buscarPorClave(c, 'ida-vuelta')).toEqual(guardado);
    expect(await repo.buscarPorId(c, guardado.id)).toEqual(guardado);
  });

  it('la clave y el identificador pertenecen al cliente: otro cliente no lo encuentra; inexistente o id no UUID ⇒ null', async () => {
    const [a, b] = [await datos.cliente(), await datos.cliente()];
    const repo = repoCon(cliente);
    const g = await persistir(repo, cliente, nuevoPedido(a, 'mia', [linea(P[0]!, 1, 100)]));
    expect(await repo.buscarPorClave(b, 'mia')).toBeNull();
    expect(await repo.buscarPorId(b, g.id)).toBeNull();
    expect(await repo.buscarPorClave(a, 'otra')).toBeNull();
    expect(await repo.buscarPorId(a, crypto.randomUUID())).toBeNull();
    expect(await repo.buscarPorId(a, 'no-es-uuid')).toBeNull();
  });

  it('listar: solo los del cliente, del más reciente al más antiguo, paginado, con resumen exacto', async () => {
    const [a, b] = [await datos.cliente(), await datos.cliente()];
    const repo = repoCon(cliente);
    const t = (m: number) => new Date(BASE.getTime() + m * 60_000);
    const p1 = await persistir(repo, cliente, nuevoPedido(a, 'l1', [linea(P[0]!, 1, 100)], t(1)));
    const p2 = await persistir(repo, cliente, nuevoPedido(a, 'l2', [linea(P[0]!, 1, 100), linea(P[1]!, 2, 250)], t(2)));
    const p3 = await persistir(repo, cliente, nuevoPedido(a, 'l3', [linea(P[2]!, 3, 10)], t(3)));
    await persistir(repo, cliente, nuevoPedido(b, 'l1', [linea(P[0]!, 1, 100)], t(4)));
    const pag1 = await repo.listar(a, { limite: 2, desplazamiento: 0 });
    expect(pag1.total).toBe(3);
    expect(pag1.items.map((r) => r.id)).toEqual([p3.id, p2.id]);
    expect(pag1.items[1]).toEqual({ id: p2.id, codigo: p2.codigo, creadoEn: t(2), estadoGeneral: 'ESPERANDO_PAGO', totalCentimos: 600, cantidadSubpedidos: 2 });
    expect((await repo.listar(a, { limite: 2, desplazamiento: 2 })).items.map((r) => r.id)).toEqual([p1.id]);
    expect((await repo.listar(b, { limite: 10, desplazamiento: 0 })).total).toBe(1);
  });

  it('historial: entradas del pedido en orden cronológico con la instantánea del puesto; ajeno o inexistente ⇒ null', async () => {
    const [a, b] = [await datos.cliente(), await datos.cliente()];
    const repo = repoCon(cliente);
    const g = await persistir(repo, cliente, nuevoPedido(a, 'hist', [linea(P[0]!, 1, 100), linea(P[1]!, 1, 100)]));
    const h = await repo.historial(a, g.id, { limite: 10, desplazamiento: 0 });
    expect(h!.total).toBe(2);
    expect(h!.items).toEqual(g.subpedidos.map((s) => ({ subpedidoId: s.id, puesto: s.puesto, estadoAnterior: null, estadoNuevo: 'ESPERANDO_PAGO', origen: 'CREAR_PEDIDO', creadoEn: BASE })));
    expect((await repo.historial(a, g.id, { limite: 1, desplazamiento: 1 }))!.items).toHaveLength(1);
    expect(await repo.historial(b, g.id, { limite: 10, desplazamiento: 0 })).toBeNull();
    expect(await repo.historial(a, 'no-es-uuid', { limite: 10, desplazamiento: 0 })).toBeNull();
  });
});

describe('código único: colisión controlada frente a conflicto de clave (CA-O2, CA-O26)', () => {
  it('un código ya usado se sustituye DENTRO de la misma transacción (que sigue utilizable)', async () => {
    const c = await datos.cliente();
    const previo = await persistir(repoCon(cliente), cliente, nuevoPedido(c, 'previo', [linea(P[0]!, 1, 100)]));
    const g = generadorCon([previo.codigo!, 'PED-0000ZZZ1']);
    const repo = repoCon(cliente, g);
    const nuevo = await persistir(repo, cliente, nuevoPedido(c, 'colision', [linea(P[1]!, 1, 100)]));
    expect(nuevo.codigo).toBe('PED-0000ZZZ1');
    expect(g.llamadas).toBe(2);
    expect(await repo.buscarPorClave(c, 'colision')).toEqual(nuevo); // guardarDetalle se ejecutó en la misma transacción
  });

  it('5 colisiones seguidas ⇒ CodigoPedidoNoGenerableError y la unidad no deja nada', async () => {
    const c = await datos.cliente();
    const previo = await persistir(repoCon(cliente), cliente, nuevoPedido(c, 'previo', [linea(P[0]!, 1, 100)]));
    const g = generadorCon(Array(5).fill(previo.codigo!));
    await expect(persistir(repoCon(cliente, g), cliente, nuevoPedido(c, 'agotado', [linea(P[0]!, 1, 100)]))).rejects.toBeInstanceOf(CodigoPedidoNoGenerableError);
    expect(g.llamadas).toBe(5);
    expect(await contarPedidos(c)).toBe(1);
  });

  it('la misma (cliente, clave) otra vez ⇒ ClaveIdempotenciaEnUsoError con la causa, SIN gastar intentos de código', async () => {
    const c = await datos.cliente();
    await persistir(repoCon(cliente), cliente, nuevoPedido(c, 'repetida', [linea(P[0]!, 1, 100)]));
    const g = generadorCon([]);
    const e = await persistir(repoCon(cliente, g), cliente, nuevoPedido(c, 'repetida', [linea(P[1]!, 1, 100)])).catch((x: unknown) => x);
    expect(e).toBeInstanceOf(ClaveIdempotenciaEnUsoError);
    expect((e as Error).cause).toBeDefined();
    expect(g.llamadas).toBe(1);
    expect(await contarPedidos(c)).toBe(1);
  });

  it('en insertar, otra violación (cliente inexistente: clave foránea) NO se confunde con el conflicto de clave ni con una colisión', async () => {
    const fantasma = crypto.randomUUID();
    const g = generadorCon([]);
    const e = await persistir(repoCon(cliente, g), cliente, nuevoPedido(fantasma, 'fk-cliente', [linea(P[0]!, 1, 100)])).catch((x: unknown) => x);
    expect(e).not.toBeInstanceOf(ClaveIdempotenciaEnUsoError);
    expect(e).not.toBeInstanceOf(CodigoPedidoNoGenerableError);
    expect(JSON.stringify((e as { meta?: unknown }).meta ?? {})).toMatch(/23503|pedidos_cliente_id_fkey/);
    expect(g.llamadas).toBe(1);
  });

  it('un fallo inesperado (clave foránea compuesta: producto de otro puesto) se propaga tal cual y revierte la unidad', async () => {
    const c = await datos.cliente();
    const intruso = linea({ ...P[0]!, puestoId: P[1]!.puestoId, codigo: P[1]!.codigo, nombre: P[1]!.nombre }, 1, 100);
    const e = await persistir(repoCon(cliente), cliente, nuevoPedido(c, 'fk', [intruso])).catch((x: unknown) => x);
    expect(e).toBeInstanceOf(Error);
    expect(e).not.toBeInstanceOf(ClaveIdempotenciaEnUsoError);
    expect(e).not.toBeInstanceOf(CodigoPedidoNoGenerableError);
    expect(JSON.stringify((e as { meta?: unknown }).meta ?? {}) + String(e)).toMatch(/foreign|23503|P2003|lineas_pedido_producto_id_puesto_id_fkey/i);
    expect(await contarPedidos(c)).toBe(0);
  });
});

describe('transacción: misma conexión, sin escapar de la unidad', () => {
  it('bloquearCliente, insertar y guardarDetalle exigen una unidad de trabajo', async () => {
    const c = await datos.cliente();
    const repo = repoCon(cliente);
    const p = nuevoPedido(c, 'fuera', [linea(P[0]!, 1, 100)]);
    await expect(repo.bloquearCliente(c)).rejects.toBeInstanceOf(UnidadDeTrabajoRequeridaError);
    await expect(repo.insertar(p)).rejects.toBeInstanceOf(UnidadDeTrabajoRequeridaError);
    await expect(repo.guardarDetalle(p.conCodigo('PED-00000001'))).rejects.toBeInstanceOf(UnidadDeTrabajoRequeridaError);
    expect(await contarPedidos(c)).toBe(0);
  });

  it('dentro de la unidad las lecturas ven lo escrito sin confirmar (misma transacción); otra conexión no, hasta el COMMIT', async () => {
    const c = await datos.cliente();
    const repo = repoCon(cliente);
    const p = nuevoPedido(c, 'visible', [linea(P[0]!, 1, 100)]);
    await uow(cliente, async () => {
      const g = await repo.insertar(p);
      await repo.guardarDetalle(g);
      expect(await repo.buscarPorClave(c, 'visible')).toEqual(g);
      expect((await repo.listar(c, { limite: 5, desplazamiento: 0 })).total).toBe(1);
      expect(await obs.pedido.count({ where: { clienteId: c } })).toBe(0);
    });
    expect(await contarPedidos(c)).toBe(1);
  });

  it('si la unidad falla después de insertar y guardar el detalle, no queda nada', async () => {
    const c = await datos.cliente();
    const repo = repoCon(cliente);
    await expect(uow(cliente, async () => { await repo.guardarDetalle(await repo.insertar(nuevoPedido(c, 'revertir', [linea(P[0]!, 1, 100), linea(P[1]!, 1, 100)]))); throw new Error('fallo'); })).rejects.toThrow('fallo');
    expect(await contarPedidos(c)).toBe(0);
    const [r] = await obs.$queryRaw<{ n: number }[]>`SELECT count(*)::int AS n FROM historial_estados_subpedido h WHERE h.actor_id = ${c}::uuid`;
    expect(r!.n).toBe(0);
  });

  it('todo ocurre por UNA conexión: con un pool de 1 la unidad completa termina (no abre otra)', async () => {
    const uno = E.cliente(1);
    const repo = repoCon(uno);
    const c = await datos.cliente();
    const r = await Promise.race([
      uow(uno, async () => {
        await repo.bloquearCliente(c);
        expect(await repo.buscarPorClave(c, 'pool1')).toBeNull();
        const g = await repo.insertar(nuevoPedido(c, 'pool1', [linea(P[0]!, 1, 100)]));
        await repo.guardarDetalle(g);
        await repo.listar(c, { limite: 1, desplazamiento: 0 });
        await repo.historial(c, g.id, { limite: 1, desplazamiento: 0 });
        return 'ok';
      }),
      dormir(10_000).then(() => 'bloqueado'),
    ]);
    expect(r).toBe('ok');
  });
});

describe('bloqueo consultivo por cliente (pg_advisory_xact_lock)', () => {
  const intentarTomar = (c: string) =>
    obs.$transaction((tx) => tx.$queryRaw<{ ok: boolean }[]>`SELECT pg_try_advisory_xact_lock(hashtextextended(${'pedidos:crear:' + c}, 0)) AS ok`).then((r) => r[0]!.ok);

  it('serializa las unidades del MISMO cliente; otro cliente no espera; se libera al COMMIT y al ROLLBACK', async () => {
    const [c, d] = [await datos.cliente(), await datos.cliente()];
    const repo = repoCon(cliente);
    let tomado!: () => void;
    const listo = new Promise<void>((r) => (tomado = r));
    const marcas: Record<string, number> = {};
    const a = uow(cliente, async () => { await repo.bloquearCliente(c); tomado(); await dormir(400); marcas['finA'] = Date.now(); });
    await listo;
    expect(await intentarTomar(c)).toBe(false); // retenido por la unidad A
    expect(await intentarTomar(d)).toBe(true); // otro cliente: libre
    const [, , otro] = await Promise.all([
      a,
      uow(cliente, async () => { await repo.bloquearCliente(c); marcas['B'] = Date.now(); }),
      uow(cliente, async () => { await repo.bloquearCliente(d); return Date.now(); }),
    ]);
    expect(marcas['B']!).toBeGreaterThanOrEqual(marcas['finA']!); // B esperó a que A terminara
    expect(otro).toBeLessThan(marcas['finA']!); // D no esperó
    expect(await intentarTomar(c)).toBe(true); // liberado al COMMIT

    await expect(uow(cliente, async () => { await repo.bloquearCliente(c); throw new Error('x'); })).rejects.toThrow('x');
    expect(await intentarTomar(c)).toBe(true); // liberado al ROLLBACK
  });
});

describe('idempotencia y concurrencia en la persistencia (sin CrearPedido: necesita T013/T014)', () => {
  /** Lo que hará CrearPedido con este repositorio: bloqueo → repetición → inserción. */
  const crearUnaVez = (repo: PrismaPedidoRepository, c: string, clave: string, conBloqueo = true) =>
    uow(cliente, async () => {
      if (conBloqueo) await repo.bloquearCliente(c);
      const previo = await repo.buscarPorClave(c, clave);
      if (previo) return { pedido: previo, creado: false };
      return { pedido: await (async () => { const g = await repo.insertar(nuevoPedido(c, clave, [linea(P[0]!, 1, 100)])); await repo.guardarDetalle(g); return g; })(), creado: true };
    });

  it('20 operaciones simultáneas con la misma clave y el bloqueo ⇒ 1 pedido; las otras 19 recuperan ESE pedido', async () => {
    const c = await datos.cliente();
    const repo = repoCon(cliente);
    const r = await Promise.all(Array.from({ length: 20 }, () => crearUnaVez(repo, c, 'misma')));
    expect(r.filter((x) => x.creado)).toHaveLength(1);
    expect(new Set(r.map((x) => x.pedido.id)).size).toBe(1);
    expect(new Set(r.map((x) => x.pedido.codigo)).size).toBe(1);
    expect(await contarPedidos(c)).toBe(1);
  });

  it('sin el bloqueo, la restricción única (cliente, clave) sigue impidiendo el duplicado y se traduce a ClaveIdempotenciaEnUsoError', async () => {
    const c = await datos.cliente();
    const repo = repoCon(cliente);
    const r = await Promise.allSettled(Array.from({ length: 10 }, () => crearUnaVez(repo, c, 'sin-bloqueo', false)));
    const creados = r.filter((x) => x.status === 'fulfilled' && x.value.creado);
    const rechazos = r.filter((x): x is PromiseRejectedResult => x.status === 'rejected');
    expect(creados).toHaveLength(1);
    for (const x of rechazos) expect(x.reason).toBeInstanceOf(ClaveIdempotenciaEnUsoError);
    expect(await contarPedidos(c)).toBe(1);
  });

  it('dos claves distintas del mismo cliente sobre UN carrito (×20): exactamente una lo convierte y la otra lo ve vacío', async () => {
    const repo = repoCon(cliente);
    const carrito = new PrismaCarritoRepository(cliente as unknown as PrismaService);
    const convertir = (c: string, clave: string) =>
      uow(cliente, async () => {
        await repo.bloquearCliente(c);
        if (await repo.buscarPorClave(c, clave)) return 'REPETIDA';
        const { items } = await carrito.bloquearYListar(c);
        if (items.length === 0) return 'VACIO';
        const lineas = items.map((i) => linea(P.find((x) => x.productoId === i.productoId)!, i.cantidad, 100));
        await repo.guardarDetalle(await repo.insertar(nuevoPedido(c, clave, lineas)));
        await carrito.vaciarItems(c);
        return 'CONVERTIDO';
      });
    for (let i = 0; i < 20; i++) {
      const c = await datos.cliente();
      for (const p of P.slice(0, 2)) await carrito.agregar({ usuarioId: c, productoId: p.productoId, puestoId: p.puestoId, cantidad: 2, tope: 100, maxItems: 50 });
      const r = await Promise.all([convertir(c, `a-${i}`), convertir(c, `b-${i}`)]);
      expect(r.sort()).toEqual(['CONVERTIDO', 'VACIO']);
      expect(await contarPedidos(c)).toBe(1);
      expect(await datos.items(c)).toEqual([]);
    }
  });
});

describe('integridad en la lectura: importes persistidos = importes recuperados', () => {
  it('si el total guardado no cuadra con los subtotales, la lectura falla con ReconstitucionInvalidaError (no se oculta)', async () => {
    const c = await datos.cliente();
    const repo = repoCon(cliente);
    const g = await persistir(repo, cliente, nuevoPedido(c, 'cuadra', [linea(P[0]!, 1, 100)]));
    // pedido gemelo con un total alterado (inserción directa: ningún trigger impide insertar)
    const idMalo = crypto.randomUUID();
    await obs.$executeRaw`INSERT INTO pedidos (id, codigo, cliente_id, clave_idempotencia, carrito_id, huella_carrito, total, reserva_vence_en, creado_en)
      SELECT ${idMalo}::uuid, 'PED-ZZZZZZZ9', cliente_id, 'no-cuadra', carrito_id, huella_carrito, total + 0.01, reserva_vence_en, creado_en FROM pedidos WHERE id = ${g.id}::uuid`;
    await obs.$executeRaw`INSERT INTO subpedidos (id, pedido_id, puesto_id, puesto_codigo, puesto_nombre, estado, subtotal, creado_en, actualizado_en)
      SELECT gen_random_uuid(), ${idMalo}::uuid, puesto_id, puesto_codigo, puesto_nombre, estado, subtotal, creado_en, actualizado_en FROM subpedidos WHERE pedido_id = ${g.id}::uuid`;
    await obs.$executeRaw`INSERT INTO historial_estados_subpedido (id, subpedido_id, estado_anterior, estado_nuevo, origen, actor_id, creado_en)
      SELECT gen_random_uuid(), s.id, NULL, 'ESPERANDO_PAGO', 'CREAR_PEDIDO', ${c}::uuid, s.creado_en FROM subpedidos s WHERE s.pedido_id = ${idMalo}::uuid`;
    await obs.$executeRaw`INSERT INTO lineas_pedido (id, subpedido_id, puesto_id, producto_id, nombre_producto, unidad_venta, presentacion, cantidad, precio_unitario, subtotal)
      SELECT gen_random_uuid(), s.id, l.puesto_id, l.producto_id, l.nombre_producto, l.unidad_venta, l.presentacion, l.cantidad, l.precio_unitario, l.subtotal
        FROM lineas_pedido l JOIN subpedidos s0 ON s0.id = l.subpedido_id JOIN subpedidos s ON s.pedido_id = ${idMalo}::uuid AND s.puesto_id = s0.puesto_id WHERE s0.pedido_id = ${g.id}::uuid`;
    await expect(repo.buscarPorId(c, idMalo)).rejects.toBeInstanceOf(ReconstitucionInvalidaError);
    await expect(repo.buscarPorClave(c, 'no-cuadra')).rejects.toBeInstanceOf(ReconstitucionInvalidaError);
    expect(await repo.buscarPorId(c, g.id)).toEqual(g);
  });
});
