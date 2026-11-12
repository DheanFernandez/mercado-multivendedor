/**
 * Conversión EXACTA entre NUMERIC (Prisma `Decimal` o texto) y céntimos enteros, sin pasar por coma flotante.
 * Se usa aritmética de enteros (`BigInt`) y se rechaza cualquier valor que no sea un importe exacto en céntimos:
 * nunca se redondea en silencio.
 */
const IMPORTE = /^(\d{1,16})(?:\.(\d{1,2}))?$/;
const MAXIMO = BigInt(Number.MAX_SAFE_INTEGER);

/** NUMERIC → céntimos. Acepta `Decimal` (se lee con `toFixed()` sin redondeo, en notación normal) o texto. */
export function centimosDesdeDecimal(valor: { toFixed(): string } | string): number {
  const texto = typeof valor === 'string' ? valor : valor.toFixed();
  const m = IMPORTE.exec(texto);
  if (!m) throw new Error(`Importe no representable en céntimos exactos: «${texto}».`);
  const centimos = BigInt(m[1]!) * 100n + BigInt((m[2] ?? '').padEnd(2, '0'));
  if (centimos > MAXIMO) throw new Error(`Importe fuera del rango exacto: «${texto}».`);
  return Number(centimos);
}

/** Céntimos → texto NUMERIC con dos decimales («12.50»). */
export function decimalDesdeCentimos(centimos: number): string {
  if (!Number.isSafeInteger(centimos) || centimos < 0) throw new Error(`Céntimos inválidos: ${centimos}.`);
  const b = BigInt(centimos);
  return `${b / 100n}.${(b % 100n).toString().padStart(2, '0')}`;
}
