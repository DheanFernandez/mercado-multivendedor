export const HOST_PERMITIDOS: string[];
export const PUERTO_PRUEBAS: string;
export const BASE_PRUEBAS: string;
export const URL_PRUEBAS_POR_DEFECTO: string;
export function evaluarBaseAislada(url: unknown): { ok: true } | { ok: false; motivo: string };
export function exigirBaseAislada(url: unknown): string;
export function urlDePruebas(env?: Record<string, string | undefined>): string;
