/**
 * Invariantes del inventario bajo una mezcla ALEATORIA y concurrente de todas las operaciones (semilla fija, reproducible):
 * reservar (incluidos reintentos y claves reutilizadas con otros datos), liberar, confirmar venta, expirar, ingresos y ajustes.
 * Al final, para cada producto:
 *   · 0 ≤ reservado ≤ físico
 *   · reservado = Σ cantidades de reservas en estado RESERVADA = Σ variación reservada del libro
 *   · físico = Σ variación física del libro (ningún doble descuento, ningún cambio sin movimiento)
 *   · todas las reservas de una misma clave y producto comparten un estado coherente
 * Los únicos errores admitidos son los de negocio controlados (nada de errores del controlador de base de datos).
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ErrorDeDominio } from '../src/shared/domain/errors.js';
import { abrirBase, etiqueta, Fixtures, intentar, manana } from './helpers/inventario-db.js';

const { prisma, repo, reservar } = abrirBase();
const fx = new Fixtures(prisma, etiqueta());
const ACTOR = '00000000-0000-4000-8000-000000000001';

/** Generador pseudoaleatorio determinista (mulberry32). */
function prng(semilla: number) {
  let a = semilla;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

let productos: string[] = [];
let puestoId = '';
beforeAll(async () => {
  await prisma.$connect();
  ({ puestoId } = await fx.puesto());
  // El stock inicial entra por el libro de movimientos para poder cuadrarlo al final.
  for (let i = 0; i < 3; i++) productos.push(await fx.producto(puestoId));
  for (const p of productos) await repo.variarStock({ productoId: p, puestoId, tipo: 'INGRESO', delta: 12, motivo: null, actorId: ACTOR });
});
afterAll(async () => { await fx.limpiar(); await prisma.$disconnect(); });

describe('invariantes con operaciones aleatorias concurrentes', () => {
  for (const semilla of [20261105, 7, 99991]) {
    it(`semilla ${semilla}: 25 oleadas × 40 operaciones simultáneas`, async () => {
      const rnd = prng(semilla);
      const pick = <T,>(a: T[]) => a[Math.floor(rnd() * a.length)]!;
      const claves = Array.from({ length: 14 }, (_, i) => `inv-${semilla}-${i}`);
      // Cada clave tiene una solicitud fija (1 o 2 productos), como un pedido real.
      const solicitud = new Map(claves.map((k) => {
        const n = rnd() < 0.4 ? 2 : 1;
        const elegidos = [...new Set(Array.from({ length: n }, () => pick(productos)))];
        return [k, elegidos.map((productoId) => ({ productoId, cantidad: 1 + Math.floor(rnd() * 4) }))];
      }));
      const inesperados: unknown[] = [];

      for (let ola = 0; ola < 25; ola++) {
        const ops = Array.from({ length: 40 }, () => {
          const k = pick(claves);
          const r = rnd();
          if (r < 0.34) return () => reservar.ejecutar({ claveOperacion: k, items: solicitud.get(k)!, expiraEn: manana() });
          if (r < 0.40) return () => reservar.ejecutar({ claveOperacion: k, items: solicitud.get(k)!.map((i) => ({ ...i, cantidad: i.cantidad + 1 })), expiraEn: manana() }); // clave reutilizada
          if (r < 0.54) return () => repo.liberar({ claveOperacion: k, motivo: 'CANCELACION' });
          if (r < 0.68) return () => repo.confirmarVenta({ claveOperacion: k });
          if (r < 0.76) return async () => { // vence la reserva y se intenta expirar
            await prisma.$executeRaw`UPDATE reservas_inventario SET expira_en = now() - interval '1 minute' WHERE clave_operacion = ${k} AND estado = 'RESERVADA'`;
            return repo.liberar({ claveOperacion: k, soloVencidasAl: new Date(), motivo: 'EXPIRACION' });
          };
          if (r < 0.88) return () => repo.variarStock({ productoId: pick(productos), puestoId, tipo: 'INGRESO', delta: 1 + Math.floor(rnd() * 3), motivo: null, actorId: ACTOR });
          return () => repo.variarStock({ productoId: pick(productos), puestoId, tipo: 'AJUSTE', delta: -(1 + Math.floor(rnd() * 3)), motivo: 'merma', actorId: ACTOR });
        });
        const res = await Promise.all(ops.map((o) => intentar(o)));
        for (const r of res) if (!r.ok && !(r.error instanceof ErrorDeDominio)) inesperados.push(r.error);
      }
      expect(inesperados).toEqual([]); // ni interbloqueos ni errores del controlador de base de datos

      for (const productoId of productos) {
        const [f] = await prisma.$queryRaw<{ fisico: number; reservado: number; activas: bigint; vf: bigint; vr: bigint }[]>`
          SELECT i.stock_fisico AS fisico, i.stock_reservado AS reservado,
                 (SELECT coalesce(sum(r.cantidad), 0) FROM reservas_inventario r WHERE r.inventario_id = i.id AND r.estado = 'RESERVADA') AS activas,
                 (SELECT coalesce(sum(m.variacion_fisica), 0) FROM movimientos_inventario m WHERE m.inventario_id = i.id) AS vf,
                 (SELECT coalesce(sum(m.variacion_reservada), 0) FROM movimientos_inventario m WHERE m.inventario_id = i.id) AS vr
          FROM inventarios i WHERE i.producto_id = ${productoId}::uuid`;
        expect(f!.reservado).toBeGreaterThanOrEqual(0);
        expect(f!.reservado).toBeLessThanOrEqual(f!.fisico);
        expect(f!.reservado).toBe(Number(f!.activas));
        expect(f!.reservado).toBe(Number(f!.vr));
        expect(f!.fisico).toBe(Number(f!.vf));
      }
      // Estado coherente por clave: una clave con varios productos nunca queda mezclada entre LIBERADA y CONFIRMADA.
      const mezcladas = await prisma.$queryRaw<{ clave_operacion: string }[]>`
        SELECT clave_operacion FROM reservas_inventario WHERE clave_operacion LIKE ${`inv-${semilla}-%`}
        GROUP BY clave_operacion HAVING bool_or(estado = 'LIBERADA') AND bool_or(estado = 'CONFIRMADA')`;
      expect(mezcladas).toEqual([]);
      // El libro cuadra con las transiciones: cada reserva confirmada/liberada tiene exactamente su movimiento.
      const descuadres = await prisma.$queryRaw<{ clave_operacion: string }[]>`
        SELECT r.clave_operacion FROM reservas_inventario r
        WHERE r.clave_operacion LIKE ${`inv-${semilla}-%`} AND (
          (SELECT count(*) FROM movimientos_inventario m WHERE m.referencia = r.clave_operacion AND m.inventario_id = r.inventario_id AND m.tipo = 'RESERVA') <> 1
          OR (SELECT count(*) FROM movimientos_inventario m WHERE m.referencia = r.clave_operacion AND m.inventario_id = r.inventario_id AND m.tipo = 'LIBERACION') <> (CASE WHEN r.estado = 'LIBERADA' THEN 1 ELSE 0 END)
          OR (SELECT count(*) FROM movimientos_inventario m WHERE m.referencia = r.clave_operacion AND m.inventario_id = r.inventario_id AND m.tipo = 'VENTA') <> (CASE WHEN r.estado = 'CONFIRMADA' THEN 1 ELSE 0 END))`;
      expect(descuadres).toEqual([]);
    }, 240_000);
  }
});
