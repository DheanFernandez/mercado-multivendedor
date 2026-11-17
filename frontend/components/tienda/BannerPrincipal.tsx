"use client";

import Link from "next/link";
import { useState } from "react";
import { IconoFlechaDerecha } from "@/components/iconos";
import { IlustracionMercado } from "@/components/tienda/IlustracionMercado";

export interface MensajeBanner {
  etiqueta: string;
  titulo: string;
  texto: string;
  accion: { href: string; texto: string };
}

/**
 * Banner promocional principal (spec 004, E4; CA-UI-04 c, CA-UI-05). Mensajes editoriales sin precios, porcentajes ni
 * contadores. Selector accesible y sin avance automático (WCAG 2.2.2): cambia solo cuando el usuario lo pide.
 */
export function BannerPrincipal({ mensajes }: { mensajes: MensajeBanner[] }) {
  const [actual, setActual] = useState(0);
  const m = mensajes[actual] ?? mensajes[0];
  if (!m) return null;
  return (
    <section
      aria-roledescription="carrusel"
      aria-label="Mensajes del mercado"
      className="relative isolate overflow-hidden rounded-[2rem] bg-[radial-gradient(120%_140%_at_0%_0%,var(--color-marca-600)_0%,var(--color-marca-700)_45%,var(--color-marca-900)_100%)] text-white shadow-tarjeta"
    >
      <div aria-hidden="true" className="pointer-events-none absolute -right-24 -top-24 -z-10 h-80 w-80 rounded-full bg-white/10 blur-2xl" />
      <div aria-hidden="true" className="pointer-events-none absolute -bottom-32 left-1/3 -z-10 h-72 w-72 rounded-full bg-[#b5c36f]/20 blur-3xl" />
      <div className="grid items-center gap-2 px-6 pb-12 pt-7 sm:px-10 sm:pt-10 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] md:pb-10 lg:px-14">
        <div role="group" aria-roledescription="diapositiva" aria-label={`${actual + 1} de ${mensajes.length}`} className="min-w-0">
          {/* Contraste ≥ 4,5:1 en todo el degradado (el punto más claro es marca-600: 5,5:1 con blanco). */}
          <p className="inline-flex rounded-full bg-black/20 px-3 py-1 text-xs font-bold uppercase tracking-[0.14em] text-white ring-1 ring-white/25">{m.etiqueta}</p>
          <h2 className="mt-4 text-balance text-3xl font-extrabold leading-[1.05] tracking-tight sm:text-4xl lg:text-5xl">{m.titulo}</h2>
          <p className="mt-3 max-w-md text-[0.95rem] leading-relaxed text-white sm:text-base">{m.texto}</p>
          <Link
            href={m.accion.href}
            className="mt-6 inline-flex items-center gap-2.5 rounded-full bg-promo py-2 pl-5 pr-2 text-sm font-extrabold text-tinta shadow-md transition hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-marca-700"
          >
            {m.accion.texto}
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-marca-700 text-white">
              <IconoFlechaDerecha className="h-4 w-4" />
            </span>
          </Link>
        </div>
        <IlustracionMercado className="mx-auto -mb-4 mt-2 h-44 w-auto max-w-full sm:h-56 md:mt-0 lg:h-72" />
      </div>
      {mensajes.length > 1 && (
        <div className="absolute inset-x-0 bottom-1.5 flex justify-center">
          {mensajes.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setActual(i)}
              aria-label={`Mostrar mensaje ${i + 1} de ${mensajes.length}`}
              aria-current={i === actual ? "true" : undefined}
              className="group rounded-full p-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              <span aria-hidden="true" className={`block h-2.5 rounded-full transition-all ${i === actual ? "w-7 bg-promo" : "w-2.5 bg-white/45 group-hover:bg-white/70"}`} />
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
