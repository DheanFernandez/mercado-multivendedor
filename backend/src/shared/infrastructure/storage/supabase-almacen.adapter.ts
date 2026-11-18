import { Inject, Injectable, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ErrorDeValidacion, ErrorServicioNoDisponible } from '../../domain/errors.js';
import type { AlmacenArchivos } from '../../application/ports/almacen-archivos.port.js';

export const STORAGE_FETCH = Symbol('STORAGE_FETCH');

/**
 * Adaptador de Supabase Storage (API REST). Requiere SUPABASE_URL y, para escribir, SUPABASE_SERVICE_ROLE_KEY
 * (solo backend). El bucket (SUPABASE_STORAGE_BUCKET, por defecto "productos") debe existir y ser PÚBLICO de lectura.
 *
 * ALMACEN_URL_PUBLICA (opcional; spec 004, E3) cambia SOLO el origen de las URL públicas de LECTURA: `<origen>/<ruta>`,
 * p. ej. un frontend local que sirve `public/` en la demostración o una CDN. Subir y eliminar no cambian (Supabase con la
 * clave de servicio). Sin la variable, el comportamiento es exactamente el de siempre.
 */
@Injectable()
export class SupabaseAlmacenAdapter implements AlmacenArchivos {
  private readonly http: typeof fetch;

  constructor(
    @Inject(ConfigService) private readonly config: ConfigService,
    @Optional() @Inject(STORAGE_FETCH) http?: typeof fetch,
  ) {
    this.http = http ?? fetch;
  }

  private get base(): string | undefined {
    return this.config.get<string>('SUPABASE_URL')?.replace(/\/+$/, '');
  }
  private get bucket(): string {
    return this.config.get<string>('SUPABASE_STORAGE_BUCKET') || 'productos';
  }
  private cabeceras(extra: Record<string, string> = {}): Record<string, string> {
    const clave = this.config.get<string>('SUPABASE_SERVICE_ROLE_KEY');
    if (!this.base || !clave) throw new ErrorServicioNoDisponible('El almacenamiento de imágenes no está configurado.');
    const h: Record<string, string> = { apikey: clave, ...extra };
    if (clave.startsWith('eyJ')) h['Authorization'] = `Bearer ${clave}`; // claves JWT legacy
    return h;
  }
  /** Las rutas las genera el servidor (`<productoId>/<uuid>.<ext>`); se rechaza cualquier otra forma por defensa. */
  private ruta(ruta: string): string {
    if (!/^[A-Za-z0-9][A-Za-z0-9._/-]{0,200}$/.test(ruta) || ruta.includes('..') || ruta.includes('//')) {
      throw new ErrorDeValidacion('Ruta de archivo no válida.');
    }
    return ruta.split('/').map(encodeURIComponent).join('/');
  }

  async subir(ruta: string, contenido: Buffer, tipoMime: string): Promise<void> {
    const cabeceras = this.cabeceras({ 'Content-Type': tipoMime, 'x-upsert': 'false' });
    const destino = this.ruta(ruta);
    let res: Response;
    try {
      res = await this.http(`${this.base}/storage/v1/object/${this.bucket}/${destino}`, {
        method: 'POST',
        headers: cabeceras,
        body: new Uint8Array(contenido),
        signal: AbortSignal.timeout(20_000),
      });
    } catch {
      throw new ErrorServicioNoDisponible('No se pudo contactar al almacenamiento de imágenes.');
    }
    if (!res.ok) throw new ErrorServicioNoDisponible('El almacenamiento de imágenes rechazó la operación.');
  }

  async eliminar(ruta: string): Promise<void> {
    try {
      await this.http(`${this.base}/storage/v1/object/${this.bucket}`, {
        method: 'DELETE',
        headers: this.cabeceras({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ prefixes: [ruta] }),
        signal: AbortSignal.timeout(10_000),
      });
    } catch {
      /* mejor esfuerzo */
    }
  }

  /**
   * Origen público opcional para leer archivos. Solo `http:`/`https:`, sin credenciales, consulta ni fragmento; puede
   * llevar una ruta base. Un valor no válido es un error de configuración (503): nunca se construye una URL arbitraria.
   */
  private get origenPublico(): string | undefined {
    const valor = this.config.get<string>('ALMACEN_URL_PUBLICA')?.trim();
    if (!valor) return undefined;
    const invalido = () => new ErrorServicioNoDisponible('La URL pública del almacenamiento no es válida.');
    let u: URL;
    try {
      u = new URL(valor);
    } catch {
      throw invalido();
    }
    if ((u.protocol !== 'http:' && u.protocol !== 'https:') || u.username || u.password || valor.includes('?') || valor.includes('#')) throw invalido();
    return `${u.origin}${u.pathname.replace(/\/+$/, '')}`;
  }

  urlPublica(ruta: string): string | null {
    const origen = this.origenPublico;
    // La ruta almacenada se valida igual en ambos casos (sin `..`, `//`, URL absolutas ni rutas que empiecen por `/`).
    if (origen) return `${origen}/${this.ruta(ruta)}`;
    return this.base ? `${this.base}/storage/v1/object/public/${this.bucket}/${this.ruta(ruta)}` : null;
  }
}
