/**
 * Apoyo de las pruebas de PostgreSQL que necesitan un `PrismaService` REAL (con unidad de trabajo y resguardo).
 * SOLO la base local aislada (guarda `exigirBaseAislada`). Cada instancia lleva un `application_name` propio para poder
 * observar sus conexiones en `pg_stat_activity`.
 */
import type { ConfigService } from '@nestjs/config';
import { exigirBaseAislada } from '../../scripts/base-aislada.mjs';
import { PrismaService } from '../../src/shared/infrastructure/prisma/prisma.service.js';

export function crearPrismaService(sufijo: string, max = 10): PrismaService {
  const u = new URL(exigirBaseAislada(process.env['DATABASE_URL']));
  u.searchParams.set('application_name', `poc_uow_${sufijo}`);
  const valores: Record<string, string> = { DATABASE_URL: u.toString(), DATABASE_POOL_MAX: String(max) };
  return new PrismaService({ get: (clave: string) => valores[clave] } as unknown as ConfigService);
}
