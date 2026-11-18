export const HOST_PERMITIDOS: string[];
export const PUERTO_DESARROLLO: string;
export const BASE_DESARROLLO: string;
export const URL_DESARROLLO_POR_DEFECTO: string;
export function ocultarClave(url: unknown): string;
export function evaluarBaseDesarrollo(url: unknown): { ok: true } | { ok: false; motivo: string };
export function exigirBaseDesarrollo(url: unknown): string;
export function urlDeDesarrollo(env?: Record<string, string | undefined>): string;
