import { ErrorApi } from "@/lib/api";
import type { GrupoPuesto, LineaCarrito } from "@/lib/tipos";

/** Mismo máximo que el servidor (spec 002-carrito, R3). */
export const MAX_CANTIDAD = 10_000;

export type ResultadoCantidad = { ok: true; valor: number } | { ok: false; mensaje: string };

/** CA-F4: entero de 1 a 10 000. El servidor repite la validación; esta evita enviar entradas absurdas. */
export function validarCantidad(texto: string): ResultadoCantidad {
  const t = texto.trim();
  if (!/^\d+$/.test(t)) return { ok: false, mensaje: "Ingrese una cantidad entera, sin decimales ni signos." };
  const n = Number(t);
  if (n < 1) return { ok: false, mensaje: "La cantidad debe ser mayor que cero." };
  if (n > MAX_CANTIDAD) return { ok: false, mensaje: `La cantidad no puede superar ${MAX_CANTIDAD}.` };
  return { ok: true, valor: n };
}

export const esSesionCaducada = (e: unknown) => e instanceof ErrorApi && e.estado === 401;

/** CA-F7: se muestra el mensaje del servidor (ya en español); solo 401 se reescribe. */
export function mensajeErrorCarrito(e: unknown): string {
  if (!(e instanceof ErrorApi)) return "No se pudo completar la operación.";
  if (e.estado === 401) return "Su sesión expiró. Ingrese de nuevo.";
  return e.message;
}

export const rotuloPuesto = (p: GrupoPuesto["puesto"]) => (p.codigo && p.nombre ? `${p.codigo} · ${p.nombre}` : "Puesto no disponible");

/** CA-F6: aviso de disponibilidad de una línea; null si está vigente. */
export function textoEstadoLinea(l: LineaCarrito): string | null {
  if (l.estado === "NO_DISPONIBLE") return "Este producto ya no está disponible";
  if (l.estado === "STOCK_INSUFICIENTE") return l.disponible > 0 ? `Quedan ${l.disponible}` : "Agotado";
  return null;
}
