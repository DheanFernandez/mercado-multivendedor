export const UNIDADES: Record<string, { nombre: string; corto: string }> = {
  UNIDAD: { nombre: "Unidad", corto: "unidad" },
  KILOGRAMO: { nombre: "Kilogramo", corto: "kg" },
  GRAMO: { nombre: "Gramo", corto: "g" },
  LITRO: { nombre: "Litro", corto: "L" },
  DOCENA: { nombre: "Docena", corto: "docena" },
  MANOJO: { nombre: "Manojo", corto: "manojo" },
  PAQUETE: { nombre: "Paquete", corto: "paquete" },
};

/** El precio llega del servidor como texto exacto ("12.50"): solo se antepone la moneda. */
export const precioTexto = (precio: string) => `S/ ${precio}`;
export const unidadCorta = (u: string) => UNIDADES[u]?.corto ?? u.toLowerCase();

/** Valida el importe tal como lo exige el backend: hasta 8 enteros y 2 decimales, mayor que cero. */
export const precioValido = (v: string) => /^\d{1,8}(\.\d{1,2})?$/.test(v.trim()) && Number(v) > 0;

export const ETIQUETA_ESTADO: Record<string, { texto: string; clases: string }> = {
  BORRADOR: { texto: "Borrador", clases: "bg-zinc-100 text-zinc-700" },
  PUBLICADO: { texto: "Publicado", clases: "bg-green-100 text-green-800" },
  DESACTIVADO: { texto: "Desactivado", clases: "bg-amber-100 text-amber-800" },
};
