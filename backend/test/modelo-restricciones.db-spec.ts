/**
 * Pruebas de las restricciones del modelo contra la base de desarrollo (npm run test:db).
 * Cada prueba corre dentro de una transacción que SIEMPRE se revierte: no deja datos.
 */
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { afterAll, describe, expect, it } from 'vitest';
import { Prisma, PrismaClient } from '../src/generated/prisma/client.js';

const url = process.env['DATABASE_URL'];
if (!url) throw new Error('DATABASE_URL no definida');
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url, max: 2 }) });
afterAll(() => prisma.$disconnect());

class Revertir extends Error {}
type Tx = Prisma.TransactionClient;

async function enTransaccionRevertida(fn: (tx: Tx) => Promise<void>) {
  try {
    await prisma.$transaction(async (tx) => {
      await fn(tx);
      throw new Revertir();
    });
  } catch (e) {
    if (!(e instanceof Revertir)) throw e;
  }
}

const codigoDe = (e: unknown) => (e instanceof Prisma.PrismaClientKnownRequestError ? e.code : (e as Error).message);
async function falla(op: Promise<unknown>) {
  try {
    await op;
  } catch (e) {
    return e;
  }
  return undefined;
}

const usuario = (n: string, extra: Partial<Prisma.UsuarioUncheckedCreateInput> = {}) => ({
  email: `${n}@prueba.test`,
  nombres: 'N',
  apellidos: 'A',
  ...extra,
});

describe('Restricciones del modelo (PostgreSQL)', () => {
  it('el rol por defecto es CLIENTE y el estado ACTIVO', () =>
    enTransaccionRevertida(async (tx) => {
      const u = await tx.usuario.create({ data: usuario('defecto') });
      expect(u.rol).toBe('CLIENTE');
      expect(u.estado).toBe('ACTIVO');
    }));

  it('el correo es único', () =>
    enTransaccionRevertida(async (tx) => {
      await tx.usuario.create({ data: usuario('dup') });
      expect(codigoDe(await falla(tx.usuario.create({ data: usuario('dup') })))).toBe('P2002');
    }));

  it('rechaza correos con mayúsculas (CHECK)', () =>
    enTransaccionRevertida(async (tx) => {
      expect(await falla(tx.usuario.create({ data: usuario('x', { email: 'Mayus@prueba.test' }) }))).toBeDefined();
    }));

  it('rechaza nombres vacíos (CHECK)', () =>
    enTransaccionRevertida(async (tx) => {
      expect(await falla(tx.usuario.create({ data: usuario('vacio', { nombres: '   ' }) }))).toBeDefined();
    }));

  it('authId es único', () =>
    enTransaccionRevertida(async (tx) => {
      await tx.usuario.create({ data: usuario('a1', { authId: 'ext-1' }) });
      expect(codigoDe(await falla(tx.usuario.create({ data: usuario('a2', { authId: 'ext-1' }) })))).toBe('P2002');
    }));

  it('un usuario solo puede tener un perfil de comerciante', () =>
    enTransaccionRevertida(async (tx) => {
      const u = await tx.usuario.create({ data: usuario('c1', { rol: 'COMERCIANTE' }) });
      await tx.comerciante.create({ data: { usuarioId: u.id, nombreComercial: 'A' } });
      expect(codigoDe(await falla(tx.comerciante.create({ data: { usuarioId: u.id, nombreComercial: 'B' } })))).toBe('P2002');
    }));

  it('el comerciante exige un usuario existente (FK) y un nombre no vacío (CHECK)', () =>
    enTransaccionRevertida(async (tx) => {
      const inexistente = '00000000-0000-4000-8000-0000000000ff';
      expect(codigoDe(await falla(tx.comerciante.create({ data: { usuarioId: inexistente, nombreComercial: 'A' } })))).toBe('P2003');
    }));

  it('el comerciante rechaza nombre comercial vacío (CHECK)', () =>
    enTransaccionRevertida(async (tx) => {
      const u = await tx.usuario.create({ data: usuario('c2', { rol: 'COMERCIANTE' }) });
      expect(await falla(tx.comerciante.create({ data: { usuarioId: u.id, nombreComercial: ' ' } }))).toBeDefined();
    }));

  it('el código de puesto es único en toda la plataforma', () =>
    enTransaccionRevertida(async (tx) => {
      const u1 = await tx.usuario.create({ data: usuario('p1', { rol: 'COMERCIANTE' }) });
      const u2 = await tx.usuario.create({ data: usuario('p2', { rol: 'COMERCIANTE' }) });
      const c1 = await tx.comerciante.create({ data: { usuarioId: u1.id, nombreComercial: 'A' } });
      const c2 = await tx.comerciante.create({ data: { usuarioId: u2.id, nombreComercial: 'B' } });
      await tx.puesto.create({ data: { comercianteId: c1.id, codigo: 'A-1', nombre: 'Uno' } });
      expect(codigoDe(await falla(tx.puesto.create({ data: { comercianteId: c2.id, codigo: 'A-1', nombre: 'Dos' } })))).toBe('P2002');
    }));

  it('un comerciante puede tener varios puestos', () =>
    enTransaccionRevertida(async (tx) => {
      const u = await tx.usuario.create({ data: usuario('p3', { rol: 'COMERCIANTE' }) });
      const c = await tx.comerciante.create({ data: { usuarioId: u.id, nombreComercial: 'A' } });
      await tx.puesto.create({ data: { comercianteId: c.id, codigo: 'M-1', nombre: 'Uno' } });
      await tx.puesto.create({ data: { comercianteId: c.id, codigo: 'M-2', nombre: 'Dos' } });
      expect(await tx.puesto.count({ where: { comercianteId: c.id } })).toBe(2);
    }));

  it('no se puede eliminar un comerciante con puestos ni un usuario con perfil de comerciante (RESTRICT)', () =>
    enTransaccionRevertida(async (tx) => {
      const u = await tx.usuario.create({ data: usuario('p4', { rol: 'COMERCIANTE' }) });
      const c = await tx.comerciante.create({ data: { usuarioId: u.id, nombreComercial: 'A' } });
      await tx.puesto.create({ data: { comercianteId: c.id, codigo: 'R-1', nombre: 'Uno' } });
      expect(codigoDe(await falla(tx.comerciante.delete({ where: { id: c.id } })))).toBe('P2003');
    }));

  it('el puesto rechaza código o nombre vacío (CHECK) y comerciante inexistente (FK)', () =>
    enTransaccionRevertida(async (tx) => {
      expect(codigoDe(await falla(tx.puesto.create({ data: { comercianteId: '00000000-0000-4000-8000-0000000000ff', codigo: 'Z-1', nombre: 'X' } })))).toBe('P2003');
    }));

  it('las tablas tienen RLS activado', async () => {
    const filas = await prisma.$queryRaw<{ relname: string; relrowsecurity: boolean }[]>`
      SELECT relname, relrowsecurity FROM pg_class
      WHERE relname IN ('usuarios', 'comerciantes', 'puestos') AND relkind = 'r'`;
    expect(filas).toHaveLength(3);
    expect(filas.every((f) => f.relrowsecurity)).toBe(true);
  });
});
