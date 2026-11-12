import type { ConfigService } from '@nestjs/config';
import { describe, expect, it } from 'vitest';
import { ClienteBaseEnUnidadError, ContextoFueraDeVigenciaError, ejecutarEnContexto, type ClienteTransaccional } from './contexto-transaccional.js';
import { PrismaService } from './prisma.service.js';

// Sin base de datos: el cliente de Prisma no se conecta hasta la primera consulta y el resguardo falla antes de consultar.
const config = (valores: Record<string, string>) => ({ get: (k: string) => valores[k] }) as unknown as ConfigService;
const crear = () => new PrismaService(config({ DATABASE_URL: 'postgresql://prueba:prueba@127.0.0.1:1/ninguna' }));
const txFalsa = { marca: 'tx-falsa' } as unknown as ClienteTransaccional;

describe('PrismaService · construcción', () => {
  it('sigue exigiendo DATABASE_URL (comportamiento existente)', () => {
    expect(() => new PrismaService(config({}))).toThrow(/DATABASE_URL/);
  });
  it('conserva los métodos de PrismaClient y los propios aunque esté resguardado', () => {
    // Nota: `instanceof` es false en cualquier subclase de PrismaClient (comportamiento previo de Prisma 7); no se prueba.
    const s = crear();
    expect(typeof s.atomico).toBe('function');
    expect(typeof s.unidadDeTrabajo).toBe('function');
    expect(typeof s.$queryRaw).toBe('function');
    expect(typeof s.$disconnect).toBe('function');
  });
});

describe('PrismaService · fuera de una unidad (comportamiento existente)', () => {
  it('los modelos y las consultas crudas son accesibles y `db` es el cliente base', () => {
    const s = crear();
    expect(typeof s.usuario.findMany).toBe('function');
    expect(typeof s.$transaction).toBe('function');
    expect(typeof s.db.$queryRaw).toBe('function');
  });
});

describe('PrismaService · resguardo dentro de una unidad', () => {
  it('rechaza el acceso a modelos, consultas crudas y $transaction del cliente base', async () => {
    const s = crear();
    await ejecutarEnContexto(txFalsa, async () => {
      expect(() => s.usuario).toThrow(ClienteBaseEnUnidadError);
      expect(() => s.movimientoInventario).toThrow(ClienteBaseEnUnidadError);
      for (const prop of ['$queryRaw', '$queryRawUnsafe', '$executeRaw', '$executeRawUnsafe', '$transaction'] as const) {
        expect(() => s[prop], prop).toThrow(ClienteBaseEnUnidadError);
      }
    });
  });

  it('el mensaje indica qué usar en su lugar', async () => {
    const s = crear();
    await ejecutarEnContexto(txFalsa, async () => {
      expect(() => s.usuario).toThrow(/db|atomico/);
    });
  });

  it('`db` y `atomico()` entregan la transacción de la unidad y no tocan el cliente base', async () => {
    const s = crear();
    await ejecutarEnContexto(txFalsa, async () => {
      expect(s.db).toBe(txFalsa);
      expect(await s.atomico(async (tx) => tx)).toBe(txFalsa);
      expect(await s.unidadDeTrabajo(async () => 'anidada')).toBe('anidada');
    });
  });

  it('lo no relacionado con consultas sigue accesible (ciclo de vida, métodos propios)', async () => {
    const s = crear();
    await ejecutarEnContexto(txFalsa, async () => {
      expect(typeof s.$disconnect).toBe('function');
      expect(typeof s.atomico).toBe('function');
    });
  });

  it('al terminar la unidad el cliente base vuelve a ser accesible desde quien llamó', async () => {
    const s = crear();
    await ejecutarEnContexto(txFalsa, async () => undefined);
    expect(typeof s.usuario.count).toBe('function');
  });

  it('una promesa que sobrevive a la unidad falla con ContextoFueraDeVigenciaError en lugar de usar el cliente base', async () => {
    const s = crear();
    let liberar!: () => void;
    const espera = new Promise<void>((r) => (liberar = r));
    let fugada!: Promise<unknown>;
    await ejecutarEnContexto(txFalsa, async () => {
      fugada = (async () => {
        await espera;
        return s.usuario;
      })();
      fugada.catch(() => undefined);
    });
    liberar();
    await expect(fugada).rejects.toBeInstanceOf(ContextoFueraDeVigenciaError);
  });
});
