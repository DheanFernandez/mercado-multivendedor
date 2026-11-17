"use client";

import Link from "next/link";
import { IconoCategoria, IconoRecargar } from "@/components/iconos";
import { TONOS } from "@/components/tienda/tonos";
import { type ClaveCategoria, claveCategoria } from "@/lib/catalogo";
import type { Categoria } from "@/lib/tipos";

interface Carga {
  datos?: Categoria[];
  error?: string;
  recargar: () => void;
}

type Modo = { tipo: "enlace" } | { tipo: "boton"; activa?: string; alElegir: (categoriaId: string | undefined) => void };

/**
 * Categorías visuales (spec 004, E4; CA-UI-04, CA-UI-09): «Todos» y las categorías de la API, con icono en un círculo.
 * Desplazables en horizontal en móvil. Modo «enlace» (inicio: llevan al catálogo filtrado) o «botón» (catálogo: filtran al
 * instante, con `aria-pressed`). Nunca usa una lista fija de categorías.
 */
export function CategoriasVisuales({ categorias, modo, etiqueta, className = "" }: { categorias: Carga; modo: Modo; etiqueta: string; className?: string }) {
  const lista = categorias.datos;
  const items: { id?: string; nombre: string; clave: ClaveCategoria | "todas" }[] = [
    { id: undefined, nombre: "Todos", clave: "todas" },
    ...(lista ?? []).map((c) => ({ id: c.id, nombre: c.nombre, clave: claveCategoria(c.slug, c.nombre) })),
  ];

  const contenido = (
    <>
      <ul className="sin-barra -mx-4 flex snap-x gap-2 overflow-x-auto px-4 pb-1 pt-1 sm:mx-0 sm:gap-4 sm:px-0 lg:justify-between">
        {items.map((c) => {
          const activa = modo.tipo === "boton" && modo.activa === c.id;
          const tono = TONOS[c.clave];
          const circulo = `flex h-14 w-14 items-center justify-center rounded-full ring-1 transition duration-200 sm:h-[4.5rem] sm:w-[4.5rem] ${
            activa ? "bg-marca-600 text-white shadow-md ring-marca-600" : `${tono.fondo} ${tono.icono} ring-black/5 group-hover:-translate-y-0.5 group-hover:shadow-md`
          }`;
          const contenido = (
            <>
              <span className={circulo}>
                <IconoCategoria clave={c.clave} className="h-6 w-6 sm:h-8 sm:w-8" />
              </span>
              <span className={`line-clamp-2 text-center text-xs leading-tight sm:text-[0.8rem] ${activa ? "font-bold text-marca-800" : "font-semibold text-tinta"}`}>{c.nombre}</span>
            </>
          );
          const clase = "group flex w-[4.5rem] flex-col items-center gap-1.5 rounded-2xl p-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-marca-600 sm:w-[5.5rem]";
          return (
            <li key={c.id ?? "todas"} className="shrink-0 snap-start">
              {modo.tipo === "enlace" ? (
                <Link href={c.id ? `/catalogo?categoriaId=${c.id}` : "/catalogo"} className={clase}>
                  {contenido}
                </Link>
              ) : (
                <button type="button" aria-pressed={activa} onClick={() => modo.alElegir(c.id)} className={clase}>
                  {contenido}
                </button>
              )}
            </li>
          );
        })}
        {!lista && !categorias.error &&
          Array.from({ length: 6 }, (_, i) => (
            <li key={`e${i}`} aria-hidden="true" className="flex w-[4.5rem] shrink-0 animate-pulse flex-col items-center gap-1.5 p-1 sm:w-[5.5rem]">
              <span className="h-14 w-14 rounded-full bg-crema-200 sm:h-[4.5rem] sm:w-[4.5rem]" />
              <span className="h-2.5 w-12 rounded bg-crema-200" />
            </li>
          ))}
      </ul>
      {!lista && !categorias.error && (
        <p role="status" className="sr-only">
          Cargando categorías…
        </p>
      )}
      {categorias.error && (
        <p role="alert" className="mt-1 flex items-center gap-2 text-sm text-tinta-suave">
          No se pudieron cargar las categorías.
          <button type="button" onClick={categorias.recargar} className="inline-flex items-center gap-1 font-semibold text-marca-700 underline-offset-4 hover:underline">
            <IconoRecargar className="h-3.5 w-3.5" />
            Reintentar
          </button>
        </p>
      )}
    </>
  );
  return modo.tipo === "enlace" ? (
    <nav aria-label={etiqueta} className={className}>
      {contenido}
    </nav>
  ) : (
    <div role="group" aria-label={etiqueta} className={className}>
      {contenido}
    </div>
  );
}
