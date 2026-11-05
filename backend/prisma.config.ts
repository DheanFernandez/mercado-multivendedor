import 'dotenv/config';
import { defineConfig } from 'prisma/config';

// La CLI de Prisma (migrate, db pull, studio) necesita conexión DIRECTA a PostgreSQL.
// En Supabase el pooler (pgbouncer, puerto 6543) no soporta migraciones: usar DIRECT_URL.
// `prisma validate` y `prisma generate` no requieren conexión, por eso no se exige la variable aquí.
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: process.env['DIRECT_URL'] ?? process.env['DATABASE_URL'],
  },
});
