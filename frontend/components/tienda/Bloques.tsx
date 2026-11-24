import Form from "next/form";
import Link from "next/link";
import type { ReactNode } from "react";
import { IconoFlechaDerecha, IconoLupa } from "@/components/iconos";
import { IlustracionMercado } from "@/components/tienda/IlustracionMercado";

/** Bloques visuales reutilizables de la tienda (spec 004, E4; CA-UI-04, CA-UI-08). Solo presentación. */

/**
 * Fondo superior suave (referencia secundaria): degradado cálido que se funde con el fondo crema, con dos halos difusos
 * (verde hoja y durazno) para una sensación fresca. Decorativo.
 */
export function FondoSuave({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`relative isolate overflow-hidden bg-[linear-gradient(180deg,var(--color-crema-50)_0%,#f1f4e7_38%,var(--color-crema-100)_100%)] ${className}`}>
      <div aria-hidden="true" className="pointer-events-none absolute -left-24 -top-24 -z-10 h-80 w-80 rounded-full bg-marca-100/80 blur-3xl" />
      <div aria-hidden="true" className="pointer-events-none absolute -right-20 -top-10 -z-10 h-72 w-72 rounded-full bg-promo-rosa/80 blur-3xl" />
      <div aria-hidden="true" className="pointer-events-none absolute right-1/3 top-40 -z-10 h-56 w-56 rounded-full bg-promo/60 blur-3xl" />
      {children}
    </div>
  );
}

export const claseContenedor = "mx-auto w-full max-w-7xl px-4 sm:px-6";

export function EncabezadoSeccion({ id, titulo, subtitulo, enlace }: { id?: string; titulo: string; subtitulo?: string; enlace?: { href: string; texto: string } }) {
  return (
    <div className="mb-4 flex items-end justify-between gap-4 sm:mb-5">
      <div className="min-w-0">
        <h2 id={id} className="text-xl font-extrabold tracking-tight text-tinta sm:text-2xl">
          {titulo}
        </h2>
        {subtitulo && <p className="mt-0.5 text-sm text-tinta-suave">{subtitulo}</p>}
      </div>
      {enlace && (
        <Link href={enlace.href} className="inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-1 text-sm font-bold text-marca-700 transition hover:text-marca-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-marca-600">
          {enlace.texto}
          <IconoFlechaDerecha className="h-4 w-4" />
        </Link>
      )}
    </div>
  );
}

export const claseCampoBusqueda =
  "h-12 w-full rounded-2xl sm:h-14 border border-crema-300 bg-white pl-12 pr-28 text-[0.95rem] text-tinta shadow-tarjeta transition placeholder:text-tinta-suave hover:border-crema-400 focus:border-marca-600 focus:outline-none focus:ring-4 focus:ring-marca-600/15";
export const claseBotonBusqueda =
  "absolute right-1.5 top-1/2 -translate-y-1/2 rounded-xl bg-marca-600 px-4 py-2 text-sm font-bold sm:right-2 sm:px-5 sm:py-2.5 text-white transition hover:bg-marca-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-marca-600 focus-visible:ring-offset-2";

/**
 * Buscador principal: `GET /catalogo?q=…` con `next/form` (navegación en el cliente y, sin JavaScript, un formulario normal).
 */
export function BuscadorPrincipal({ id = "buscador-principal", className = "" }: { id?: string; className?: string }) {
  return (
    <Form action="/catalogo" role="search" className={`relative ${className}`}>
      <label htmlFor={id} className="sr-only">
        Buscar productos
      </label>
      <IconoLupa className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-tinta-suave" />
      <input id={id} name="q" type="search" maxLength={100} autoComplete="off" placeholder="Busca papa, tomate, limón, queso…" className={claseCampoBusqueda} />
      <button type="submit" className={claseBotonBusqueda}>
        Buscar
      </button>
    </Form>
  );
}

/**
 * Franja promocional secundaria (CA-UI-04 g): mensaje editorial sobre la compra multivendedor (RF20). El sello muestra el
 * número REAL de puestos; si no se conoce, no se muestra (CA-UI-05).
 */
export function PromoSecundaria({ puestos }: { puestos?: number }) {
  return (
    <section aria-labelledby="promo-secundaria" className="relative isolate overflow-hidden rounded-[1.75rem] bg-[linear-gradient(110deg,var(--color-promo)_0%,var(--color-promo-rosa)_100%)] px-5 py-6 ring-1 ring-black/5 sm:px-8 sm:py-7">
      <div className="flex items-center gap-4">
        <div className="min-w-0 flex-1">
          <p className="text-[0.7rem] font-extrabold uppercase tracking-[0.16em] text-terracota">Compra multivendedor</p>
          <h2 id="promo-secundaria" className="mt-1.5 text-xl font-extrabold tracking-tight text-tinta sm:text-2xl">
            Un solo carrito, varios puestos
          </h2>
          <p className="mt-1 max-w-md text-sm text-tinta-media">Agrega productos de distintos puestos y revisa el subtotal de cada uno antes de comprar.</p>
          <Link
            href="/catalogo"
            className="mt-4 inline-flex items-center gap-2 rounded-full bg-marca-700 py-2 pl-4 pr-2 text-sm font-bold text-white shadow-sm transition hover:bg-marca-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-marca-700 focus-visible:ring-offset-2"
          >
            Empezar a comprar
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white text-marca-700">
              <IconoFlechaDerecha className="h-4 w-4" />
            </span>
          </Link>
        </div>
        <IlustracionMercado className="hidden h-36 w-auto shrink-0 sm:block lg:h-40" />
        {puestos !== undefined && puestos > 0 && (
          <div className="flex h-24 w-24 shrink-0 flex-col items-center justify-center rounded-full bg-marca-700 text-white shadow-lg ring-4 ring-white/60 sm:h-28 sm:w-28">
            <span className="text-3xl font-extrabold leading-none sm:text-4xl">{puestos}</span>
            <span className="mt-1 text-xs font-semibold">{puestos === 1 ? "puesto" : "puestos"}</span>
          </div>
        )}
      </div>
    </section>
  );
}
