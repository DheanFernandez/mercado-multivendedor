/**
 * Esquema DESECHABLE para pruebas de PostgreSQL cuyas filas no se pueden borrar respetando las reglas de producción
 * (p. ej. Pedidos: líneas e historial inmutables por trigger, claves foráneas RESTRICT).
 *
 * - Solo en la base local aislada (`exigirBaseAislada`) y con un nombre `pedidos_t<n>_<etiqueta>` validado.
 * - Se crea aplicando TODAS las migraciones del repositorio, en orden, dentro del esquema nuevo (no se toca `public`).
 * - Al terminar se elimina con `DROP SCHEMA … CASCADE`: no se desactivan triggers ni claves foráneas (sin
 *   `session_replication_role`) ni se borran filas una a una.
 *
 * Los clientes Prisma usan la opción `schema` del adaptador (Prisma 7 califica las consultas con el esquema) y la
 * conexión fija `search_path` para el SQL crudo de los repositorios.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import { exigirBaseAislada } from '../../scripts/base-aislada.mjs';
import { PrismaClient } from '../../src/generated/prisma/client.js';
import { protegerClienteBase } from '../../src/shared/infrastructure/prisma/resguardo-cliente-base.js';
import { etiqueta } from './inventario-db.js';

const MIGRACIONES = fileURLToPath(new URL('../../prisma/migrations', import.meta.url));
const NOMBRE_VALIDO = /^pedidos_t\d{3}_[a-z0-9]{6,20}$/;

export interface EsquemaDesechable {
  esquema: string;
  /** Cliente con el resguardo de unidad de trabajo (como `PrismaService`) para los repositorios bajo prueba. */
  cliente(max?: number): PrismaClient;
  /** Cliente sin resguardo, para preparar datos y observar desde OTRA conexión. */
  observador: PrismaClient;
  eliminar(): Promise<void>;
}

export async function crearEsquemaDesechable(tarea: string): Promise<EsquemaDesechable> {
  const url = exigirBaseAislada(process.env['DATABASE_URL']);
  const esquema = `pedidos_${tarea}_${etiqueta()}`.toLowerCase();
  if (!NOMBRE_VALIDO.test(esquema)) throw new Error(`Nombre de esquema desechable no válido: ${esquema}`);

  const admin = new pg.Client({ connectionString: url });
  await admin.connect();
  await admin.query(`CREATE SCHEMA "${esquema}"`);
  const carpetas = readdirSync(MIGRACIONES).filter((d) => /^\d{14}_/.test(d)).sort();
  for (const c of carpetas) {
    const sql = readFileSync(join(MIGRACIONES, c, 'migration.sql'), 'utf-8');
    await admin.query(`BEGIN; SET LOCAL search_path TO "${esquema}"; ${sql}\n; COMMIT;`);
  }

  const u = new URL(url);
  u.searchParams.set('options', `-c search_path="${esquema}"`);
  const conexion = u.toString();
  const creados: PrismaClient[] = [];
  const nuevo = (max: number) => {
    const c = new PrismaClient({ adapter: new PrismaPg({ connectionString: conexion, max }, { schema: esquema }) });
    creados.push(c);
    return c;
  };
  const observador = nuevo(4);

  return {
    esquema,
    cliente: (max = 10) => protegerClienteBase(nuevo(max)),
    observador,
    async eliminar() {
      for (const c of creados) await c.$disconnect();
      if (!NOMBRE_VALIDO.test(esquema)) throw new Error('Nombre de esquema inesperado: no se elimina.');
      await admin.query(`DROP SCHEMA "${esquema}" CASCADE`);
      await admin.end();
    },
  };
}
