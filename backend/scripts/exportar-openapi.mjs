#!/usr/bin/env node
/**
 * Exporta el contrato OpenAPI a `backend/openapi/openapi.json` (spec 005, CA-OAS-09).
 * No crea la aplicación, no usa base de datos, Supabase ni variables de entorno: solo ejecuta la función pura
 * `construirDocumentoOpenApi()` de la compilación (`npm run build` antes, o use `npm run openapi:exportar`).
 *
 *   node scripts/exportar-openapi.mjs             escribe openapi/openapi.json
 *   node scripts/exportar-openapi.mjs --comprobar no escribe; termina con error si el archivo versionado difiere
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const backend = join(dirname(fileURLToPath(import.meta.url)), '..');
const modulo = join(backend, 'dist', 'shared', 'http', 'openapi', 'documento.js');
const destino = join(backend, 'openapi', 'openapi.json');

if (!existsSync(modulo)) {
  console.error('No existe dist/shared/http/openapi/documento.js: ejecute «npm run build» (o «npm run openapi:exportar»).');
  process.exit(1);
}
const { construirDocumentoOpenApi } = await import(pathToFileURL(modulo).href);
const texto = `${JSON.stringify(construirDocumentoOpenApi(), null, 2)}\n`;

if (process.argv.includes('--comprobar')) {
  const actual = existsSync(destino) ? readFileSync(destino, 'utf8').replace(/\r\n/g, '\n') : null;
  if (actual !== texto) {
    console.error('openapi/openapi.json no coincide con el contrato generado: ejecute «npm run openapi:exportar» y revise el cambio.');
    process.exit(1);
  }
  console.log('openapi/openapi.json coincide con el contrato generado.');
} else {
  mkdirSync(dirname(destino), { recursive: true });
  writeFileSync(destino, texto, 'utf8');
  console.log(`OpenAPI escrito en ${destino} (${texto.length} bytes).`);
}
