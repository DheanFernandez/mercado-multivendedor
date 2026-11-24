export interface OpcionesUrlMigraciones {
  /** Si es false (generate, validate, format) no se exige conexión y no se lanza error por el pooler. */
  requiereConexion?: boolean;
}

type Entorno = Record<string, string | undefined>;

function apuntaAlPooler(url: string): boolean {
  if (/[?&]pgbouncer=true(?:&|$)/i.test(url)) return true;
  try {
    return new URL(url).port === '6543';
  } catch {
    return /:6543(?:[/?]|$)/.test(url);
  }
}

/**
 * Devuelve la URL que debe usar la CLI de Prisma (migrate, db pull, studio).
 * Usa DIRECT_URL si está definida; si no, cae a DATABASE_URL, salvo que esta
 * apunte al Transaction pooler de Supabase (puerto 6543 o pgbouncer=true), donde
 * las migraciones fallan: en ese caso lanza un error claro.
 */
export function resolverUrlMigraciones(
  env: Entorno,
  { requiereConexion = true }: OpcionesUrlMigraciones = {},
): string | undefined {
  const directa = env['DIRECT_URL']?.trim();
  if (directa) return directa;

  const base = env['DATABASE_URL']?.trim();
  if (requiereConexion && base && apuntaAlPooler(base)) {
    throw new Error(
      'Falta DIRECT_URL y DATABASE_URL apunta al Transaction pooler (puerto 6543 o pgbouncer=true), ' +
        'donde las migraciones de Prisma fallan. Defina DIRECT_URL en backend/.env con la cadena del ' +
        'Session pooler de Supabase (puerto 5432).',
    );
  }
  return base || undefined;
}
