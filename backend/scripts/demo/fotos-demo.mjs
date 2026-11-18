/**
 * Fotografías locales de demostración (spec 004, E3; CA-IMG-07). Nombre, ruta y validación de cada archivo, sin dependencias.
 *
 * - Carpeta: `frontend/public/demo/productos/` (Next.js la sirve en `<origen del frontend>/demo/productos/<archivo>`).
 * - Nombre: `generarSlug(nombre del producto)` + `.webp`. Ruta guardada en `producto_imagenes.ruta`: `demo/productos/<archivo>`.
 * - Solo se asocia un archivo existente, con estructura WebP válida y de ≤ 2 MB (el mismo límite que las subidas).
 */
import { readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

export const CARPETA_FOTOS = join('frontend', 'public', 'demo', 'productos');
export const PREFIJO_RUTA = 'demo/productos';
export const MAX_BYTES_FOTO = 2 * 1024 * 1024;
const FRAGMENTOS_WEBP = new Set(['VP8 ', 'VP8L', 'VP8X']);

export const archivoFoto = (slug) => `${slug}.webp`;
export const rutaFoto = (archivo) => `${PREFIJO_RUTA}/${archivo}`;

/**
 * Estructura de un WebP: «RIFF» + tamaño (LE, = bytes − 8) + «WEBP» + primer fragmento («VP8 », «VP8L» o «VP8X») cuyo
 * tamaño cabe en el archivo. No decodifica la imagen: el navegador lo confirma en la verificación (CA-IMG-08).
 * @returns {string | null} motivo del rechazo, o null si es válido
 */
export function motivoNoWebp(datos) {
  if (!Buffer.isBuffer(datos) || datos.length < 20) return 'demasiado corto para ser WebP';
  if (datos.toString('ascii', 0, 4) !== 'RIFF' || datos.toString('ascii', 8, 12) !== 'WEBP') return 'no tiene la cabecera RIFF/WEBP';
  if (datos.readUInt32LE(4) + 8 !== datos.length) return 'el tamaño RIFF no coincide con el del archivo';
  if (!FRAGMENTOS_WEBP.has(datos.toString('ascii', 12, 16))) return 'el primer fragmento no es VP8, VP8L ni VP8X';
  if (datos.readUInt32LE(16) + 20 > datos.length) return 'el fragmento de imagen excede el archivo';
  return null;
}

/**
 * Evalúa el archivo de un producto en la carpeta indicada.
 * @returns {{ estado: 'valida' | 'falta' | 'no-es-archivo' | 'demasiado-grande' | 'no-webp', bytes?: number, detalle?: string }}
 */
export function evaluarFoto(carpeta, archivo) {
  let info;
  try {
    info = statSync(join(carpeta, archivo));
  } catch {
    return { estado: 'falta' };
  }
  if (!info.isFile()) return { estado: 'no-es-archivo' };
  if (info.size > MAX_BYTES_FOTO) return { estado: 'demasiado-grande', bytes: info.size, detalle: `${info.size} bytes (máximo ${MAX_BYTES_FOTO})` };
  const motivo = motivoNoWebp(readFileSync(join(carpeta, archivo)));
  return motivo ? { estado: 'no-webp', bytes: info.size, detalle: motivo } : { estado: 'valida', bytes: info.size };
}
