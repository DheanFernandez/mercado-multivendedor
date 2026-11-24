import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { ConfigService } from '@nestjs/config';
import { afterAll, describe, expect, it } from 'vitest';
import { SupabaseAlmacenAdapter } from '../../src/shared/infrastructure/storage/supabase-almacen.adapter.js';
import { PRODUCTOS, generarSlug } from './datos-demo.mjs';
import { MAX_BYTES_FOTO, evaluarFoto, motivoNoWebp } from './fotos-demo.mjs';

/** Fotografías locales de demostración (spec 004, E3; CA-IMG-02, CA-IMG-07, CA-IMG-10). */

const u32 = (n: number) => {
  const b = Buffer.alloc(4);
  b.writeUInt32LE(n);
  return b;
};
/** Contenedor WebP mínimo y coherente (solo estructura: el navegador decodifica las fotografías reales). */
function webp(fragmento = 'VP8L', datos = Buffer.from([0x2f, 0, 0, 0, 0])) {
  const relleno = datos.length % 2 ? Buffer.from([0]) : Buffer.alloc(0);
  const chunk = Buffer.concat([Buffer.from(fragmento, 'ascii'), u32(datos.length), datos, relleno]);
  return Buffer.concat([Buffer.from('RIFF', 'ascii'), u32(4 + chunk.length), Buffer.from('WEBP', 'ascii'), chunk]);
}
const PNG = Buffer.concat([Buffer.from('89504e470d0a1a0a0000000d49484452', 'hex'), Buffer.alloc(32)]); // firma PNG + cabecera

describe('nombres y rutas de las fotografías', () => {
  it('un archivo distinto por producto: <slug del nombre>.webp, en demo/productos/', () => {
    const archivos = PRODUCTOS.map((p) => p.archivoFoto);
    expect(new Set(archivos).size).toBe(20);
    for (const p of PRODUCTOS) {
      expect(p.archivoFoto).toBe(`${generarSlug(p.nombre)}.webp`);
      expect(p.rutaFoto).toBe(`demo/productos/${p.archivoFoto}`);
    }
    expect(archivos).toContain('palta-fuerte.webp');
    expect(archivos).toContain('carne-de-res-para-guiso.webp');
  });

  it('el adaptador real acepta cada ruta y, con el origen local, la resuelve en /demo/productos/ (CA-IMG-02)', () => {
    const config = { get: (k: string) => ({ SUPABASE_URL: 'https://proyecto.supabase.co', ALMACEN_URL_PUBLICA: 'http://localhost:3000' })[k] } as unknown as ConfigService;
    const almacen = new SupabaseAlmacenAdapter(config, (async () => new Response()) as unknown as typeof fetch);
    for (const p of PRODUCTOS) {
      const url = almacen.urlPublica(p.rutaFoto);
      expect(url).toBe(`http://localhost:3000/demo/productos/${p.archivoFoto}`);
      expect(url).not.toContain('/storage/v1/object/public/productos/');
    }
  });
});

describe('motivoNoWebp: estructura del contenedor WebP', () => {
  it.each(['VP8 ', 'VP8L', 'VP8X'])('acepta un WebP coherente con el fragmento %j', (f) => {
    expect(motivoNoWebp(webp(f))).toBeNull();
    expect(motivoNoWebp(webp(f, Buffer.alloc(7, 1)))).toBeNull(); // datos impares con relleno
  });

  it.each([
    ['un PNG renombrado', PNG, /RIFF\/WEBP/],
    ['un RIFF de audio', Buffer.concat([webp().subarray(0, 8), Buffer.from('WAVE'), webp().subarray(12)]), /RIFF\/WEBP/],
    ['un tamaño RIFF incoherente (archivo truncado)', webp().subarray(0, webp().length - 1), /tamaño RIFF/],
    ['un fragmento desconocido', webp('ABCD'), /VP8/],
    ['un fragmento que excede el archivo', (() => { const b = webp(); b.writeUInt32LE(9999, 16); return b; })(), /excede/],
    ['un archivo vacío', Buffer.alloc(0), /corto/],
    ['algo que no es un Buffer', 'RIFF', /corto/],
  ])('rechaza %s', (_caso, datos, motivo) => {
    expect(motivoNoWebp(datos)).toMatch(motivo);
  });
});

describe('evaluarFoto (CA-IMG-07)', () => {
  const carpeta = mkdtempSync(join(tmpdir(), 'fotos-demo-'));
  afterAll(() => rmSync(carpeta, { recursive: true, force: true }));
  writeFileSync(join(carpeta, 'valida.webp'), webp());
  writeFileSync(join(carpeta, 'disfrazada.webp'), PNG);
  writeFileSync(join(carpeta, 'enorme.webp'), Buffer.alloc(MAX_BYTES_FOTO + 1));
  mkdirSync(join(carpeta, 'carpeta.webp'));

  it('solo «valida» para un archivo existente, WebP y de hasta 2 MB', () => {
    expect(evaluarFoto(carpeta, 'valida.webp')).toEqual({ estado: 'valida', bytes: webp().length });
    expect(evaluarFoto(carpeta, 'no-existe.webp')).toEqual({ estado: 'falta' });
    expect(evaluarFoto(carpeta, 'disfrazada.webp')).toMatchObject({ estado: 'no-webp' });
    expect(evaluarFoto(carpeta, 'enorme.webp')).toMatchObject({ estado: 'demasiado-grande', bytes: MAX_BYTES_FOTO + 1 });
    expect(evaluarFoto(carpeta, 'carpeta.webp')).toEqual({ estado: 'no-es-archivo' });
  });
});
