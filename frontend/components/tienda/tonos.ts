import type { ClaveCategoria } from "@/lib/catalogo";

/**
 * Tono decorativo de cada tipo de categoría (spec 004, E4): fondo suave e icono de un color afín. Solo decoración; el
 * nombre de la categoría siempre aparece como texto. Los iconos no son texto: basta un contraste ≥ 3:1 con su fondo.
 */
export const TONOS: Record<ClaveCategoria | "todas", { fondo: string; icono: string }> = {
  todas: { fondo: "bg-crema-200", icono: "text-tinta" },
  frutas: { fondo: "bg-[#fde8dc]", icono: "text-[#b4532a]" },
  verduras: { fondo: "bg-marca-100", icono: "text-marca-700" },
  hortalizas: { fondo: "bg-[#fcebd7]", icono: "text-[#a65611]" },
  tuberculos: { fondo: "bg-[#f3e7d6]", icono: "text-[#8a5a2b]" },
  abarrotes: { fondo: "bg-[#efeae0]", icono: "text-[#6b5a3e]" },
  lacteos: { fondo: "bg-[#eaf1f6]", icono: "text-[#3e6a8a]" },
  carnes: { fondo: "bg-[#f9e1e1]", icono: "text-[#a23b3b]" },
  pescados: { fondo: "bg-[#e1eef3]", icono: "text-[#2f6e86]" },
  panaderia: { fondo: "bg-[#f6e8d3]", icono: "text-[#9a6324]" },
  huevos: { fondo: "bg-[#fbf0d9]", icono: "text-[#97691b]" },
  granos: { fondo: "bg-[#f1ebd8]", icono: "text-[#7d6a2e]" },
  otra: { fondo: "bg-crema-200", icono: "text-tinta-suave" },
};
