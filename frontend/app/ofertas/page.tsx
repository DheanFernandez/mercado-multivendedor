import type { Metadata } from "next";
import { OfertasVista } from "@/components/ofertas/OfertasVista";

export const metadata: Metadata = { title: "Ofertas" };

/** Ofertas (spec 004, E4; CA-UI-08): sin modelo de promociones, informa y muestra los precios más bajos reales. */
export default function PaginaOfertas() {
  return <OfertasVista />;
}
