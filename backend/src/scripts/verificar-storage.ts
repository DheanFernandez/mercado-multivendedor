/**
 * Prueba REAL de Supabase Storage (carga, lectura pública, eliminación y permisos).
 * Uso:  npm run build && npm run storage:verificar
 * Requiere en backend/.env: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY y un bucket PÚBLICO
 * (SUPABASE_STORAGE_BUCKET, por defecto "productos"). No imprime claves. Solo crea y borra un archivo de prueba.
 */
import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import type { ConfigService } from '@nestjs/config';
import { SupabaseAlmacenAdapter } from '../shared/infrastructure/storage/supabase-almacen.adapter.js';

const entorno = (k: string) => process.env[k];
const faltan = ['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY'].filter((k) => !entorno(k));
if (faltan.length) {
  console.error(`No se puede ejecutar la prueba: faltan en backend/.env -> ${faltan.join(', ')}.`);
  console.error('Obténgalas en Supabase > Project Settings > API Keys (la secreta es SOLO para el backend).');
  process.exit(2);
}

const almacen = new SupabaseAlmacenAdapter({ get: (k: string) => entorno(k) } as unknown as ConfigService);
const bucket = entorno('SUPABASE_STORAGE_BUCKET') || 'productos';
const base = entorno('SUPABASE_URL')!.replace(/\/+$/, '');
// PNG válido de 1x1 píxel.
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
const ruta = `_verificacion/${randomUUID()}.png`;

let fallos = 0;
const paso = (ok: boolean, texto: string, detalle = '') => {
  console.log(`${ok ? '✔' : '✘'} ${texto}${detalle ? ` — ${detalle}` : ''}`);
  if (!ok) fallos++;
};

try {
  console.log(`Bucket: ${bucket}`);
  await almacen.subir(ruta, PNG, 'image/png');
  paso(true, 'Carga con la clave de servicio');

  const url = almacen.urlPublica(ruta)!;
  const lectura = await fetch(url);
  const bytes = Buffer.from(await lectura.arrayBuffer());
  paso(lectura.ok && bytes.equals(PNG), 'Lectura pública del archivo (el bucket debe ser público)', `HTTP ${lectura.status}`);
  paso((lectura.headers.get('content-type') ?? '').startsWith('image/png'), 'Tipo de contenido image/png');

  let sobrescribio = true;
  try {
    await almacen.subir(ruta, PNG, 'image/png');
  } catch {
    sobrescribio = false;
  }
  paso(!sobrescribio, 'No se puede sobrescribir un archivo existente');

  // Permisos: la clave pública (anon) NO debe poder escribir.
  const anon = await fetch(`${base}/storage/v1/object/${bucket}/_verificacion/anon-${randomUUID()}.png`, {
    method: 'POST',
    headers: { apikey: entorno('SUPABASE_ANON_KEY')!, 'Content-Type': 'image/png' },
    body: new Uint8Array(PNG),
  });
  paso(!anon.ok, 'La clave pública (anon) no puede subir archivos', `HTTP ${anon.status}`);
  if (anon.ok) console.error('  ⚠ Revise las políticas del bucket: no debe existir una política de INSERT para anon/authenticated.');
} catch (e) {
  paso(false, 'Operación de Storage', e instanceof Error ? e.message : 'error desconocido');
} finally {
  await almacen.eliminar(ruta);
  const tras = await fetch(almacen.urlPublica(ruta)!).catch(() => null);
  paso(!!tras && !tras.ok, 'Eliminación del archivo de prueba', tras ? `HTTP ${tras.status}` : 'sin respuesta');
}

console.log(fallos === 0 ? '\nStorage verificado correctamente.' : `\n${fallos} verificación(es) fallaron.`);
process.exit(fallos === 0 ? 0 : 1);
