/** Puerto de almacenamiento de archivos (Supabase Storage hoy; sustituible por Cloudflare R2). */
export interface AlmacenArchivos {
  /** Guarda el archivo en `ruta` (sin sobrescribir). @throws ErrorServicioNoDisponible si no está configurado o falla. */
  subir(ruta: string, contenido: Buffer, tipoMime: string): Promise<void>;
  /** Elimina el archivo (mejor esfuerzo: no falla si no existe). */
  eliminar(ruta: string): Promise<void>;
  /** URL pública de lectura de un archivo ya almacenado. Devuelve null si el almacenamiento no está configurado. */
  urlPublica(ruta: string): string | null;
}

export const ALMACEN_ARCHIVOS = Symbol('ALMACEN_ARCHIVOS');
