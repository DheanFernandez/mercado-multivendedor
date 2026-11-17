import type { Metadata } from "next";
import { Suspense } from "react";
import { CatalogoVista } from "@/components/catalogo/CatalogoVista";
import { EsqueletoCatalogoPagina } from "@/components/catalogo/EstadosCatalogo";

export const metadata: Metadata = { title: "Catálogo" };

/**
 * Catálogo público (spec 004-catalogo-publico). La vista lee los filtros de la URL con `useSearchParams`, por lo que va dentro
 * de un límite de Suspense (Next.js 16): el esqueleto se prerenderiza y la vista se completa en el navegador.
 */
export default function PaginaCatalogo() {
  return (
    <Suspense fallback={<EsqueletoCatalogoPagina />}>
      <CatalogoVista />
    </Suspense>
  );
}
