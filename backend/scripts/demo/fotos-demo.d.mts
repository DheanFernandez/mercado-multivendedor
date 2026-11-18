export const CARPETA_FOTOS: string;
export const PREFIJO_RUTA: string;
export const MAX_BYTES_FOTO: number;
export function archivoFoto(slug: string): string;
export function rutaFoto(archivo: string): string;
export function motivoNoWebp(datos: unknown): string | null;
export function evaluarFoto(
  carpeta: string,
  archivo: string,
): { estado: 'valida' | 'falta' | 'no-es-archivo' | 'demasiado-grande' | 'no-webp'; bytes?: number; detalle?: string };
