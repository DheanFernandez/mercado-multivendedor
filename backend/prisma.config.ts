import 'dotenv/config';
import { defineConfig } from 'prisma/config';
import { resolverUrlMigraciones } from './prisma/url-migraciones';

// La CLI de Prisma (migrate, db pull, studio) necesita conexión DIRECTA a PostgreSQL.
// En Supabase el pooler transaccional (puerto 6543) no soporta migraciones: se usa DIRECT_URL
// (Session pooler, 5432). Si falta y DATABASE_URL apunta al pooler, se lanza un error claro.
// `generate`, `validate` y `format` no se conectan, por lo que no exigen DIRECT_URL.
const sinConexion = process.argv.some((arg) => ['generate', 'validate', 'format', '--version', '-v', '--help', '-h'].includes(arg));

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: resolverUrlMigraciones(process.env, { requiereConexion: !sinConexion }),
  },
});
