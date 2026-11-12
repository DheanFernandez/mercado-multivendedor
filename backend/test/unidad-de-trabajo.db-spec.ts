/**
 * T001 · Unidad de trabajo integrada en `PrismaService` (spec 003-pedidos-subpedidos; antes POC-001).
 * La suite V1–V8 de la POC se ejecuta ahora contra `PrismaService` y se añaden las pruebas del resguardo contra el uso
 * accidental del cliente base y de la conservación de la causa original al agotar los reintentos.
 *
 * Seguridad: solo el PostgreSQL local aislado (guarda `exigirBaseAislada`). Crea y elimina ÚNICAMENTE sus tablas
 * `poc_uow_a` y `poc_uow_b`; no usa privilegios especiales (ni `session_replication_role`). Cada prueba usa etiquetas
 * únicas, por lo que no depende del orden de ejecución.
 */
import { EventEmitter } from 'node:events';
import { randomUUID } from 'node:crypto';
import { PrismaPg } from '@prisma/adapter-pg';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { exigirBaseAislada } from '../scripts/base-aislada.mjs';
import { PrismaClient } from '../src/generated/prisma/client.js';
import { ErrorDeConflicto, ErrorServicioNoDisponible } from '../src/shared/domain/errors.js';
import { ClienteBaseEnUnidadError, ContextoFueraDeVigenciaError, identidadContexto, transaccionVigente } from '../src/shared/infrastructure/prisma/contexto-transaccional.js';
import { codigosDelError, esTransitorio } from '../src/shared/infrastructure/prisma/errores-transitorios.js';
import { PrismaService } from '../src/shared/infrastructure/prisma/prisma.service.js';
import { crearPrismaService } from './helpers/prisma-service-db.js';

const URL_BASE = exigirBaseAislada(process.env['DATABASE_URL']);
const APP = 'poc_uow';

function crearCliente(sufijo: string, max: number): PrismaClient {
  const u = new URL(URL_BASE);
  u.searchParams.set('application_name', `${APP}_${sufijo}`);
  return new PrismaClient({ adapter: new PrismaPg({ connectionString: u.toString(), max }) });
}

const principal = crearPrismaService('main', 10); // el servicio REAL (unidad de trabajo + resguardo)
const externo = crearCliente('ext', 2); // otra conexión: observa lo que otros no han confirmado
const uow = principal;

const etiqueta = (p: string) => `${p}-${randomUUID()}`;
const dormir = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const alAzar = () => dormir(Math.floor(Math.random() * 12));
const transitorioSimulado = () => Object.assign(new Error('fallo de serialización simulado'), { code: '40001' });

function crearBarrera(n: number) {
  let llegaron = 0;
  let liberar!: () => void;
  const paso = new Promise<void>((r) => (liberar = r));
  return {
    llegar: () => {
      if (++llegaron >= n) liberar();
      return paso;
    },
  };
}

// ───── repositorios de prueba: imitan los patrones reales (db directo, atomico() y lecturas) ─────
type Db = PrismaService['db'];
const infoTx = async (db: Db) => {
  const [f] = await db.$queryRaw<{ txid: string; pid: number }[]>`SELECT txid_current()::text AS txid, pg_backend_pid()::int AS pid`;
  return f!;
};

class RepoA {
  insertar(tag: string, valor = 1) {
    return uow.db.$executeRaw`INSERT INTO poc_uow_a (etiqueta, txid, valor) VALUES (${tag}, txid_current(), ${valor}::int)`;
  }
  async contar(tag: string) {
    const [f] = await uow.db.$queryRaw<{ n: number }[]>`SELECT count(*)::int AS n FROM poc_uow_a WHERE etiqueta = ${tag}`;
    return f!.n;
  }
}
class RepoB {
  insertar(tag: string, clave: string, valor = 1) {
    return uow.atomico((tx) => tx.$executeRaw`INSERT INTO poc_uow_b (etiqueta, clave, txid, valor) VALUES (${tag}, ${clave}, txid_current(), ${valor}::int)`);
  }
}
class RepoC {
  async contarAB(tag: string) {
    const [f] = await uow.db.$queryRaw<{ a: number; b: number }[]>`
      SELECT (SELECT count(*)::int FROM poc_uow_a WHERE etiqueta = ${tag}) AS a, (SELECT count(*)::int FROM poc_uow_b WHERE etiqueta = ${tag}) AS b`;
    return f!;
  }
}
const A = new RepoA();
const B = new RepoB();
const C = new RepoC();

/** Cuenta desde OTRA conexión (solo ve lo confirmado). */
async function externoAB(tag: string) {
  const [f] = await externo.$queryRaw<{ a: number; b: number }[]>`
    SELECT (SELECT count(*)::int FROM poc_uow_a WHERE etiqueta = ${tag}) AS a, (SELECT count(*)::int FROM poc_uow_b WHERE etiqueta = ${tag}) AS b`;
  return f!;
}

async function sinResiduos() {
  const [t] = await externo.$queryRaw<{ n: number }[]>`SELECT count(*)::int AS n FROM pg_stat_activity WHERE application_name LIKE 'poc_uow%' AND state LIKE 'idle in transaction%'`;
  const [l] = await externo.$queryRaw<{ n: number }[]>`SELECT count(*)::int AS n FROM pg_locks l JOIN pg_stat_activity a ON a.pid = l.pid WHERE l.locktype = 'advisory' AND a.application_name LIKE 'poc_uow%'`;
  return { transaccionesAbiertas: t!.n, bloqueosConsultivos: l!.n };
}

beforeAll(async () => {
  await externo.$connect();
  await externo.$executeRawUnsafe('DROP TABLE IF EXISTS poc_uow_a, poc_uow_b');
  await externo.$executeRawUnsafe(`CREATE TABLE poc_uow_a (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(), etiqueta TEXT NOT NULL, txid BIGINT NOT NULL,
    valor INTEGER NOT NULL DEFAULT 1 CHECK (valor >= 0))`);
  await externo.$executeRawUnsafe(`CREATE TABLE poc_uow_b (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(), etiqueta TEXT NOT NULL, clave TEXT NOT NULL UNIQUE, txid BIGINT NOT NULL,
    valor INTEGER NOT NULL DEFAULT 1 CHECK (valor >= 0))`);
});

afterEach(async () => {
  // Después de cada prueba: ninguna transacción abierta ni bloqueo consultivo retenido por la POC.
  expect(await sinResiduos()).toEqual({ transaccionesAbiertas: 0, bloqueosConsultivos: 0 });
});

afterAll(async () => {
  await externo.$executeRawUnsafe('DROP TABLE IF EXISTS poc_uow_a, poc_uow_b');
  await principal.$disconnect();
  await externo.$disconnect();
  // Tras desconectar no debe quedar ninguna conexión de la POC.
  const verificador = crearCliente('verif', 1);
  try {
    let n = -1;
    for (let i = 0; i < 30 && n !== 0; i++) {
      const [f] = await verificador.$queryRaw<{ n: number }[]>`SELECT count(*)::int AS n FROM pg_stat_activity WHERE application_name LIKE 'poc_uow%' AND application_name <> 'poc_uow_verif'`;
      n = f!.n;
      if (n !== 0) await dormir(100);
    }
    expect(n).toBe(0);
  } finally {
    await verificador.$disconnect();
  }
});

describe('V1 · propagación transaccional', () => {
  it('los repositorios comparten UNA transacción y una conexión; solo se ve lo confirmado desde fuera', async () => {
    const tag = etiqueta('v1');
    const fuera = await infoTx(externo);
    const dentro = await uow.unidadDeTrabajo(async () => {
      await A.insertar(tag);
      await B.insertar(tag, `${tag}-b`);
      const a = await infoTx(uow.db);
      const b = await uow.atomico((tx) => infoTx(tx));
      const c = await uow.db.$queryRaw<{ txid: string; pid: number }[]>`SELECT txid_current()::text AS txid, pg_backend_pid()::int AS pid`;
      // El repositorio C lee lo que A y B escribieron SIN confirmar (lectura de lo propio).
      expect(await C.contarAB(tag)).toEqual({ a: 1, b: 1 });
      // Otra conexión NO ve nada antes del COMMIT.
      expect(await externoAB(tag)).toEqual({ a: 0, b: 0 });
      return { a, b, c: c[0]! };
    });
    expect(dentro.b).toEqual(dentro.a);
    expect(dentro.c).toEqual(dentro.a);
    expect(dentro.a.txid).not.toBe(fuera.txid);
    expect(dentro.a.pid).not.toBe(fuera.pid);
    // Tras el COMMIT, ahora sí.
    expect(await externoAB(tag)).toEqual({ a: 1, b: 1 });
    // y las filas llevan el txid de la unidad
    const filas = await externo.$queryRaw<{ txid: string }[]>`SELECT txid::text AS txid FROM poc_uow_a WHERE etiqueta = ${tag}`;
    expect(filas.map((f) => f.txid)).toEqual([dentro.a.txid]);
  });

  it('fuera de una unidad no hay contexto y `db` es el cliente base', async () => {
    expect(transaccionVigente()).toBeUndefined();
    expect(identidadContexto()).toBeUndefined();
    const a = await infoTx(uow.db);
    const b = await infoTx(uow.db);
    expect(a.txid).not.toBe(b.txid); // autocommit: cada sentencia es su propia transacción
  });
});

describe('V2 · atomicidad: todo se revierte', () => {
  const casos: [string, (tag: string) => Promise<unknown>][] = [
    ['error de aplicación tras escribir en A y B', async (tag) => {
      await A.insertar(tag);
      await B.insertar(tag, `${tag}-b`);
      throw new Error('fallo de aplicación');
    }],
    ['error de dominio tras escribir en A', async (tag) => {
      await A.insertar(tag);
      throw new ErrorDeConflicto('sin stock');
    }],
    ['restricción CHECK en B tras escribir en A', async (tag) => {
      await A.insertar(tag);
      await B.insertar(tag, `${tag}-b`, -1);
    }],
    ['restricción UNIQUE (23505) en B tras escribir en A', async (tag) => {
      await A.insertar(tag);
      await B.insertar(tag, `${tag}-dup`);
      await B.insertar(tag, `${tag}-dup`);
    }],
    ['restricción CHECK en A tras escribir en B', async (tag) => {
      await B.insertar(tag, `${tag}-b`);
      await A.insertar(tag, -5);
    }],
  ];
  it.each(casos)('revierte A y B: %s', async (_n, bloque) => {
    const tag = etiqueta('v2');
    await expect(uow.unidadDeTrabajo(() => bloque(tag))).rejects.toBeDefined();
    expect(await externoAB(tag)).toEqual({ a: 0, b: 0 });
  });

  it('una unidad que termina bien no se ve afectada por otra que falló', async () => {
    const bueno = etiqueta('v2ok');
    const malo = etiqueta('v2ko');
    await Promise.allSettled([
      uow.unidadDeTrabajo(async () => { await A.insertar(bueno); await alAzar(); await B.insertar(bueno, `${bueno}-b`); }),
      uow.unidadDeTrabajo(async () => { await A.insertar(malo); await alAzar(); throw new Error('fallo'); }),
    ]);
    expect(await externoAB(bueno)).toEqual({ a: 1, b: 1 });
    expect(await externoAB(malo)).toEqual({ a: 0, b: 0 });
  });
});

describe('V3 · anidación controlada', () => {
  it('una unidad y un atomico() anidados participan en la transacción externa (mismo txid y conexión)', async () => {
    const tag = etiqueta('v3');
    const r = await uow.unidadDeTrabajo(async () => {
      const externa = await infoTx(uow.db);
      await A.insertar(tag);
      const interna = await uow.unidadDeTrabajo(async () => {
        await B.insertar(tag, `${tag}-b`);
        return infoTx(uow.db);
      });
      const viaAtomico = await uow.atomico((tx) => infoTx(tx));
      const ctxExterno = identidadContexto();
      const ctxInterno = await uow.unidadDeTrabajo(async () => identidadContexto());
      return { externa, interna, viaAtomico, mismoContexto: ctxExterno === ctxInterno };
    });
    expect(r.interna).toEqual(r.externa);
    expect(r.viaAtomico).toEqual(r.externa);
    expect(r.mismoContexto).toBe(true);
    expect(await externoAB(tag)).toEqual({ a: 1, b: 1 });
  });

  it('un error en la unidad interior revierte la exterior', async () => {
    const tag = etiqueta('v3e');
    await expect(
      uow.unidadDeTrabajo(async () => {
        await A.insertar(tag);
        await uow.unidadDeTrabajo(async () => {
          await B.insertar(tag, `${tag}-b`);
          throw new ErrorDeConflicto('falla interior');
        });
      }),
    ).rejects.toBeInstanceOf(ErrorDeConflicto);
    expect(await externoAB(tag)).toEqual({ a: 0, b: 0 });
  });

  it('la unidad interior NO reintenta: un error transitorio interior lo reintenta la exterior COMPLETA, una vez por intento', async () => {
    const tag = etiqueta('v3r');
    let exteriores = 0;
    let interiores = 0;
    await uow.unidadDeTrabajo(async () => {
      exteriores++;
      await A.insertar(tag);
      await uow.unidadDeTrabajo(async () => {
        interiores++;
        if (interiores === 1) throw transitorioSimulado();
        await B.insertar(tag, `${tag}-b`);
      });
    });
    expect({ exteriores, interiores }).toEqual({ exteriores: 2, interiores: 2 });
    // El A del primer intento se revirtió: una sola fila de cada tabla.
    expect(await externoAB(tag)).toEqual({ a: 1, b: 1 });
  });

  it('atomico() anidado tampoco reintenta por su cuenta', async () => {
    let interiores = 0;
    let exteriores = 0;
    await uow.unidadDeTrabajo(async () => {
      exteriores++;
      await uow.atomico(async () => {
        interiores++;
        if (interiores === 1) throw transitorioSimulado();
      });
    });
    expect({ exteriores, interiores }).toEqual({ exteriores: 2, interiores: 2 });
  });
});

describe('V4 · concurrencia y aislamiento de contexto', () => {
  it('100 unidades concurrentes: cada una ve solo su transacción y su contexto', async () => {
    const N = 100;
    const prefijo = etiqueta('v4');
    const r = await Promise.all(
      Array.from({ length: N }, (_, i) =>
        uow.unidadDeTrabajo(async () => {
          const tag = `${prefijo}-${i}`;
          const inicio = await infoTx(uow.db);
          const ctx = identidadContexto();
          await alAzar();
          await Promise.all([A.insertar(tag), B.insertar(tag, `${tag}-b`)]);
          await new Promise((res) => setImmediate(res));
          const fin = await infoTx(uow.db);
          expect(identidadContexto()).toBe(ctx); // el contexto sigue siendo el propio tras esperas entrelazadas
          expect(fin.txid).toBe(inicio.txid);
          return { tag, txid: inicio.txid, ctx };
        }),
      ),
    );
    expect(new Set(r.map((x) => x.txid)).size).toBe(N);
    expect(new Set(r.map((x) => x.ctx)).size).toBe(N);
    // Ninguna fila lleva el txid de otra solicitud.
    const filasA = await externo.$queryRaw<{ etiqueta: string; txid: string }[]>`SELECT etiqueta, txid::text AS txid FROM poc_uow_a WHERE etiqueta LIKE ${prefijo + '-%'}`;
    const filasB = await externo.$queryRaw<{ etiqueta: string; txid: string }[]>`SELECT etiqueta, txid::text AS txid FROM poc_uow_b WHERE etiqueta LIKE ${prefijo + '-%'}`;
    const esperado = new Map(r.map((x) => [x.tag, x.txid]));
    expect(filasA).toHaveLength(N);
    expect(filasB).toHaveLength(N);
    for (const f of [...filasA, ...filasB]) expect(f.txid).toBe(esperado.get(f.etiqueta));
  });

  it('fuera de las unidades no queda contexto; un temporizador creado antes no hereda ninguno', async () => {
    const antes = new Promise<number | undefined>((r) => setTimeout(() => r(identidadContexto()), 25));
    await uow.unidadDeTrabajo(async () => {
      await dormir(40);
      expect(identidadContexto()).toBeDefined();
    });
    expect(await antes).toBeUndefined();
    expect(identidadContexto()).toBeUndefined();
    expect(transaccionVigente()).toBeUndefined();
  });

  it('el contexto no se usa después de terminar: una promesa que sobrevive al commit FALLA y no usa el pool', async () => {
    const tag = etiqueta('v4f');
    let liberar!: () => void;
    const espera = new Promise<void>((r) => (liberar = r));
    let fugada!: Promise<unknown>;
    await uow.unidadDeTrabajo(async () => {
      await A.insertar(tag);
      fugada = (async () => {
        await espera;
        return A.insertar(`${tag}-fugada`); // se ejecuta DESPUÉS del commit, heredando el contexto
      })();
      fugada.catch(() => undefined); // evita «unhandled rejection» mientras se espera
    });
    liberar();
    await expect(fugada).rejects.toBeInstanceOf(ContextoFueraDeVigenciaError);
    expect(await externoAB(`${tag}-fugada`)).toEqual({ a: 0, b: 0 }); // no se escribió por el pool
    expect(await externoAB(tag)).toEqual({ a: 1, b: 0 });
  });

  it('un error dentro de la unidad también deja el contexto fuera de vigencia', async () => {
    let fugada!: Promise<unknown>;
    let liberar!: () => void;
    const espera = new Promise<void>((r) => (liberar = r));
    await expect(
      uow.unidadDeTrabajo(async () => {
        fugada = (async () => {
          await espera;
          return infoTx(uow.db);
        })();
        fugada.catch(() => undefined);
        throw new ErrorDeConflicto('falla');
      }),
    ).rejects.toBeInstanceOf(ErrorDeConflicto);
    liberar();
    await expect(fugada).rejects.toBeInstanceOf(ContextoFueraDeVigenciaError);
  });
});

describe('V5 · reintentos de la unidad completa', () => {
  const K1 = 970201;
  const K2 = 970202;

  it('interbloqueo REAL (40P01): se reintenta el bloque entero y ambas unidades terminan con una sola fila', async () => {
    const t1 = etiqueta('v5a');
    const t2 = etiqueta('v5b');
    const barrera = crearBarrera(2);
    const ejecuciones = { [t1]: 0, [t2]: 0 };
    const bloque = (tag: string, primero: number, segundo: number) => async () => {
      const n = ++ejecuciones[tag]!;
      await uow.db.$executeRaw`SELECT pg_advisory_xact_lock(${primero}::bigint)`;
      if (n === 1) await barrera.llegar(); // ambas sostienen su primer bloqueo antes de pedir el segundo → interbloqueo
      await uow.db.$executeRaw`SELECT pg_advisory_xact_lock(${segundo}::bigint)`;
      await A.insertar(tag);
    };
    await Promise.all([uow.unidadDeTrabajo(bloque(t1, K1, K2)), uow.unidadDeTrabajo(bloque(t2, K2, K1))]);
    // PostgreSQL abortó exactamente una: se ejecutó 1 + 2 = 3 veces en total.
    expect(ejecuciones[t1]! + ejecuciones[t2]!).toBe(3);
    expect(await externoAB(t1)).toEqual({ a: 1, b: 0 });
    expect(await externoAB(t2)).toEqual({ a: 1, b: 0 });
  });

  it('clasificación de errores REALES: 40P01 es transitorio; 23505, 23514 y 23503 no', async () => {
    // 40P01 real fuera de la unidad, con transacciones crudas
    const barrera = crearBarrera(2);
    const cruce = (p: number, s: number) =>
      principal.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(${p}::bigint)`;
        await barrera.llegar();
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(${s}::bigint)`;
      });
    const resultado = await Promise.allSettled([cruce(970211, 970212), cruce(970212, 970211)]);
    const rechazadas = resultado.filter((x): x is PromiseRejectedResult => x.status === 'rejected');
    expect(rechazadas).toHaveLength(1);
    const codigosInterbloqueo = codigosDelError(rechazadas[0]!.reason);
    console.info('T001 · forma real del error de interbloqueo:', { nombre: (rechazadas[0]!.reason as Error).name, codigos: codigosInterbloqueo });
    expect(esTransitorio(rechazadas[0]!.reason)).toBe(true);

    const tag = etiqueta('v5c');
    const real = async (f: () => Promise<unknown>) => f().then(() => undefined, (e: unknown) => e);
    const unica = await real(() => principal.$transaction(async (tx) => {
      await tx.$executeRaw`INSERT INTO poc_uow_b (etiqueta, clave, txid) VALUES (${tag}, ${tag}, 1)`;
      await tx.$executeRaw`INSERT INTO poc_uow_b (etiqueta, clave, txid) VALUES (${tag}, ${tag}, 1)`;
    }));
    const check = await real(() => principal.$transaction((tx) => tx.$executeRaw`INSERT INTO poc_uow_a (etiqueta, txid, valor) VALUES (${tag}, 1, -1)`));
    const fk = await real(() => principal.$transaction((tx) => tx.$executeRaw`INSERT INTO poc_uow_a (etiqueta, txid) VALUES (${tag}, NULL)`));
    console.info('T001 · códigos reales:', { unica: codigosDelError(unica), check: codigosDelError(check), notNull: codigosDelError(fk) });
    expect(unica).toBeDefined();
    expect(check).toBeDefined();
    expect(esTransitorio(unica)).toBe(false);
    expect(esTransitorio(check)).toBe(false);
    expect(esTransitorio(fk)).toBe(false);
  });

  it('error transitorio siempre: exactamente 5 intentos y luego ErrorServicioNoDisponible', async () => {
    const tag = etiqueta('v5t');
    let intentos = 0;
    await expect(
      uow.unidadDeTrabajo(async () => {
        intentos++;
        await A.insertar(tag);
        throw transitorioSimulado();
      }),
    ).rejects.toBeInstanceOf(ErrorServicioNoDisponible);
    expect(intentos).toBe(5);
    expect(await externoAB(tag)).toEqual({ a: 0, b: 0 });
  });

  it('se recupera al tercer intento: 3 ejecuciones y sin filas duplicadas', async () => {
    const tag = etiqueta('v5r');
    let intentos = 0;
    await uow.unidadDeTrabajo(async () => {
      intentos++;
      await A.insertar(tag);
      await B.insertar(tag, `${tag}-b`);
      if (intentos < 3) throw transitorioSimulado();
    });
    expect(intentos).toBe(3);
    expect(await externoAB(tag)).toEqual({ a: 1, b: 1 });
  });

  it('un error de dominio no se reintenta: 1 intento y el error original', async () => {
    let intentos = 0;
    const error = new ErrorDeConflicto('sin stock');
    await expect(uow.unidadDeTrabajo(async () => { intentos++; throw error; })).rejects.toBe(error);
    expect(intentos).toBe(1);
  });

  it('una violación única (23505) no se reintenta: 1 intento', async () => {
    const tag = etiqueta('v5u');
    let intentos = 0;
    await expect(
      uow.unidadDeTrabajo(async () => {
        intentos++;
        await B.insertar(tag, tag);
        await B.insertar(tag, tag);
      }),
    ).rejects.toBeDefined();
    expect(intentos).toBe(1);
    expect(await externoAB(tag)).toEqual({ a: 0, b: 0 });
  });
});

describe('V6 · una conexión por unidad (pool de 3)', () => {
  it('30 unidades concurrentes con un pool de 3 terminan, sin conexiones extra ni retenidas', async () => {
    const uow3 = crearPrismaService('v6', 3);
    const prefijo = etiqueta('v6');
    let maximo = 0;
    let seguir = true;
    const monitor = (async () => {
      while (seguir) {
        const [f] = await externo.$queryRaw<{ n: number }[]>`SELECT count(*)::int AS n FROM pg_stat_activity WHERE application_name = 'poc_uow_v6'`;
        maximo = Math.max(maximo, f!.n);
        await dormir(4);
      }
    })();
    try {
      await Promise.all(
        Array.from({ length: 30 }, (_, i) =>
          uow3.unidadDeTrabajo(async () => {
            const tag = `${prefijo}-${i}`;
            const info = await Promise.all([infoTx(uow3.db), infoTx(uow3.db), infoTx(uow3.db)]);
            expect(new Set(info.map((x) => x.txid)).size).toBe(1);
            expect(new Set(info.map((x) => x.pid)).size).toBe(1);
            await uow3.db.$executeRaw`INSERT INTO poc_uow_a (etiqueta, txid) VALUES (${tag}, txid_current())`;
            await uow3.atomico((tx) => tx.$executeRaw`INSERT INTO poc_uow_b (etiqueta, clave, txid) VALUES (${tag}, ${tag}, txid_current())`);
            await dormir(2);
          }),
        ),
      );
      const [ociosas] = await externo.$queryRaw<{ n: number }[]>`SELECT count(*)::int AS n FROM pg_stat_activity WHERE application_name = 'poc_uow_v6' AND state LIKE 'idle in transaction%'`;
      expect(ociosas!.n).toBe(0);
    } finally {
      seguir = false;
      await monitor;
    }
    expect(maximo).toBeGreaterThan(0);
    expect(maximo).toBeLessThanOrEqual(3);
    const filas = await externo.$queryRaw<{ n: number }[]>`SELECT count(*)::int AS n FROM poc_uow_a WHERE etiqueta LIKE ${prefijo + '-%'}`;
    expect(filas[0]!.n).toBe(30);
    await uow3.$disconnect();
    let restantes = -1;
    for (let i = 0; i < 30 && restantes !== 0; i++) {
      const [f] = await externo.$queryRaw<{ n: number }[]>`SELECT count(*)::int AS n FROM pg_stat_activity WHERE application_name = 'poc_uow_v6'`;
      restantes = f!.n;
      if (restantes !== 0) await dormir(100);
    }
    expect(restantes).toBe(0);
  });
});

describe('V7 · atomico() fuera de una unidad conserva el comportamiento actual', () => {
  // Referencia: copia del comportamiento vigente de Inventario y Carrito (5 intentos, 10 ms × n, relanza el error original).
  const reintentable = (e: unknown) => /deadlock|could not serialize|40P01|40001|P2034/i.test(`${(e as { code?: string })?.code ?? ''} ${(e as Error)?.message ?? ''} ${JSON.stringify((e as { meta?: unknown })?.meta ?? '')}`);
  async function referencia<T>(op: () => Promise<T>): Promise<T> {
    for (let intento = 0; ; intento++) {
      try {
        return await op();
      } catch (e) {
        if (intento >= 4 || !reintentable(e)) throw e;
        await dormir(10 * (intento + 1));
      }
    }
  }

  it('abre su propia transacción corta (mismo txid en sus sentencias, distinto del exterior) y confirma', async () => {
    const tag = etiqueta('v7');
    const r = await uow.atomico(async (tx) => {
      await tx.$executeRaw`INSERT INTO poc_uow_a (etiqueta, txid) VALUES (${tag}, txid_current())`;
      return [await infoTx(tx), await infoTx(tx)];
    });
    expect(r[1]).toEqual(r[0]);
    expect(identidadContexto()).toBeUndefined(); // atomico() fuera de una unidad NO crea contexto
    expect(await externoAB(tag)).toEqual({ a: 1, b: 0 });
  });

  it('revierte ante un error', async () => {
    const tag = etiqueta('v7e');
    await expect(uow.atomico(async (tx) => {
      await tx.$executeRaw`INSERT INTO poc_uow_a (etiqueta, txid) VALUES (${tag}, txid_current())`;
      throw new Error('fallo');
    })).rejects.toThrow('fallo');
    expect(await externoAB(tag)).toEqual({ a: 0, b: 0 });
  });

  it.each([
    ['transitorio siempre', () => transitorioSimulado()],
    ['no transitorio', () => new Error('otro')],
    ['dominio', () => new ErrorDeConflicto('x')],
  ])('mismas ejecuciones y mismo error que el comportamiento actual: %s', async (_n, fabricar) => {
    const error = fabricar();
    let nuevas = 0;
    let viejas = 0;
    const r1 = await uow.atomico(async () => { nuevas++; throw error; }).then(() => undefined, (e: unknown) => e);
    const r2 = await referencia(async () => { viejas++; throw error; }).then(() => undefined, (e: unknown) => e);
    expect(nuevas).toBe(viejas);
    expect(r1).toBe(error); // relanza el error ORIGINAL (no lo convierte en servicio no disponible)
    expect(r2).toBe(error);
  });

  it('20 llamadas concurrentes confirman sus escrituras', async () => {
    const prefijo = etiqueta('v7c');
    await Promise.all(Array.from({ length: 20 }, (_, i) => uow.atomico((tx) => tx.$executeRaw`INSERT INTO poc_uow_a (etiqueta, txid) VALUES (${prefijo + '-' + i}, txid_current())`)));
    const [f] = await externo.$queryRaw<{ n: number }[]>`SELECT count(*)::int AS n FROM poc_uow_a WHERE etiqueta LIKE ${prefijo + '-%'}`;
    expect(f!.n).toBe(20);
  });
});

describe('V8 · contexto en consultas perezosas, promesas y operaciones paralelas', () => {
  it('una consulta de Prisma creada antes y esperada después usa la transacción de la unidad', async () => {
    const r = await uow.unidadDeTrabajo(async () => {
      const referencia = await infoTx(uow.db);
      const perezosa = uow.db.$queryRaw<{ txid: string }[]>`SELECT txid_current()::text AS txid`; // aún no se ejecuta
      await dormir(15);
      const despues = await perezosa;
      return { referencia: referencia.txid, perezosa: despues[0]!.txid };
    });
    expect(r.perezosa).toBe(r.referencia);
  });

  it('10 operaciones paralelas dentro de la unidad comparten la transacción y se revierten juntas', async () => {
    const tag = etiqueta('v8p');
    const r = await uow.unidadDeTrabajo(async () => {
      const tx = await Promise.all(Array.from({ length: 10 }, async (_, i) => {
        await A.insertar(`${tag}-${i}`);
        return (await infoTx(uow.db)).txid;
      }));
      const [n] = await uow.db.$queryRaw<{ n: number }[]>`SELECT count(*)::int AS n FROM poc_uow_a WHERE etiqueta LIKE ${tag + '-%'}`;
      return { tx: new Set(tx).size, visibles: n!.n };
    });
    expect(r).toEqual({ tx: 1, visibles: 10 });
    await expect(uow.unidadDeTrabajo(async () => {
      await Promise.all(Array.from({ length: 10 }, (_, i) => A.insertar(`${tag}-x${i}`)));
      throw new Error('fallo');
    })).rejects.toThrow('fallo');
    const [n] = await externo.$queryRaw<{ n: number }[]>`SELECT count(*)::int AS n FROM poc_uow_a WHERE etiqueta LIKE ${tag + '-x%'}`;
    expect(n!.n).toBe(0);
  });

  it('el contexto sobrevive a microtareas, nextTick, setImmediate, temporizadores, Promise.race, generadores asíncronos y emisores síncronos', async () => {
    const ids = await uow.unidadDeTrabajo(async () => {
      const base = identidadContexto();
      const lectura = <T>(f: (cb: (v: number | undefined) => void) => T) => new Promise<number | undefined>((r) => f(r));
      async function* generador() { await dormir(1); yield identidadContexto(); }
      const emisor = new EventEmitter();
      let desdeEmisor: number | undefined;
      emisor.on('x', () => { desdeEmisor = identidadContexto(); });
      emisor.emit('x');
      const g = await generador().next();
      return {
        base,
        microtarea: await lectura((r) => queueMicrotask(() => r(identidadContexto()))),
        nextTick: await lectura((r) => process.nextTick(() => r(identidadContexto()))),
        inmediato: await lectura((r) => setImmediate(() => r(identidadContexto()))),
        temporizador: await lectura((r) => setTimeout(() => r(identidadContexto()), 3)),
        carrera: await Promise.race([dormir(2).then(() => identidadContexto()), dormir(30).then(() => -1)]),
        generador: g.value as number | undefined,
        emisor: desdeEmisor,
      };
    });
    for (const [clave, valor] of Object.entries(ids)) expect(valor, clave).toBe(ids.base);
    expect(ids.base).toBeDefined();
  });

  it('`pg_advisory_xact_lock` (devuelve void) funciona con $executeRaw; el comportamiento con $queryRaw queda registrado (riesgo M6)', async () => {
    await uow.unidadDeTrabajo(async () => {
      await uow.db.$executeRaw`SELECT pg_advisory_xact_lock(${970301}::bigint)`;
    });
    const viaQuery = await uow.unidadDeTrabajo(async () => {
      try {
        await uow.db.$queryRaw`SELECT pg_advisory_xact_lock(${970302}::bigint)`;
        return 'acepta void';
      } catch (e) {
        return `falla: ${(e as Error).message.split('\n')[0]}`;
      }
    });
    console.info('T001 · riesgo M6 ($queryRaw con tipo void):', viaQuery);
    expect(viaQuery).toMatch(/^(acepta void|falla)/);
  });
});

describe('T001 · integración en PrismaService', () => {
  it('compatibilidad fuera de una unidad: modelos, consultas crudas, $transaction y `db` funcionan como antes', async () => {
    // (no se pasa el cliente a expect(): su Proxy hace recursar al inspector; `instanceof` es false en toda subclase de PrismaClient)
    expect(typeof principal.unidadDeTrabajo).toBe('function');
    const [crudo] = await principal.$queryRaw<{ n: number }[]>`SELECT 1::int AS n`;
    expect(crudo!.n).toBe(1);
    expect(typeof (await principal.usuario.count())).toBe('number');
    const dentro = await principal.$transaction(async (tx) => (await tx.$queryRaw<{ n: number }[]>`SELECT 2::int AS n`)[0]!.n);
    expect(dentro).toBe(2);
    const [viaDb] = await principal.db.$queryRaw<{ n: number }[]>`SELECT 3::int AS n`;
    expect(viaDb!.n).toBe(3);
    expect(transaccionVigente()).toBeUndefined();
  });

  describe('resguardo: dentro de una unidad no se puede usar el cliente base', () => {
    const usos: [string, () => unknown][] = [
      ['un modelo (principal.usuario)', () => principal.usuario.count()],
      ['$queryRaw', () => principal.$queryRaw`SELECT 1`],
      ['$executeRaw', () => principal.$executeRaw`SELECT 1`],
      ['$transaction (abriría una transacción independiente)', () => principal.$transaction(async () => 1)],
    ];
    it.each(usos)('falla de inmediato y revierte toda la unidad: %s', async (_n, usar) => {
      const tag = etiqueta('t001g');
      let intentos = 0;
      await expect(
        uow.unidadDeTrabajo(async () => {
          intentos++;
          await A.insertar(tag);
          await usar();
        }),
      ).rejects.toBeInstanceOf(ClienteBaseEnUnidadError);
      expect(intentos).toBe(1); // no es un error transitorio: no se reintenta
      expect(await externoAB(tag)).toEqual({ a: 0, b: 0 });
    });

    it('`db` y `atomico()` siguen funcionando dentro de la unidad, y al terminar el cliente base vuelve a poder usarse', async () => {
      const tag = etiqueta('t001ok');
      await uow.unidadDeTrabajo(async () => {
        await A.insertar(tag);
        await B.insertar(tag, `${tag}-b`);
        expect((await C.contarAB(tag))).toEqual({ a: 1, b: 1 });
      });
      expect(await externoAB(tag)).toEqual({ a: 1, b: 1 });
      expect((await principal.$queryRaw<{ n: number }[]>`SELECT 1::int AS n`)[0]!.n).toBe(1);
    });

    it('una promesa que sobrevive a la unidad y usa el cliente base falla (no se usa el pool en silencio)', async () => {
      let liberar!: () => void;
      const espera = new Promise<void>((r) => (liberar = r));
      let fugada!: Promise<unknown>;
      await uow.unidadDeTrabajo(async () => {
        fugada = (async () => {
          await espera;
          return principal.$queryRaw`SELECT 1`;
        })();
        fugada.catch(() => undefined);
      });
      liberar();
      await expect(fugada).rejects.toBeInstanceOf(ContextoFueraDeVigenciaError);
    });
  });

  it('al agotar los 5 intentos conserva la causa original en `cause`', async () => {
    const original = transitorioSimulado();
    let intentos = 0;
    const error = await uow.unidadDeTrabajo(async () => { intentos++; throw original; }).then(() => undefined, (e: unknown) => e);
    expect(intentos).toBe(5);
    expect(error).toBeInstanceOf(ErrorServicioNoDisponible);
    expect((error as Error).cause).toBe(original);
  });

  it('un error de dominio no se convierte en reintentable ni pierde su identidad', async () => {
    const dominio = new ErrorDeConflicto('sin stock');
    let intentos = 0;
    await expect(uow.unidadDeTrabajo(async () => { intentos++; throw dominio; })).rejects.toBe(dominio);
    expect(intentos).toBe(1);
  });
});
