import type { ReactNode } from "react";
import { IconoAlerta, IconoCanasta, IconoLupa, IconoRecargar, IconoSinConexion } from "@/components/iconos";
import type { ErrorCatalogo } from "@/lib/catalogo";

/** Estados del catálogo (spec 004, CA-CAT-05 a CA-CAT-08; diseño de E4). */

/**
 * Cuadrícula de productos (CA-CAT-16, CA-UI-10): 2 columnas en móvil y, desde `sm`, tantas columnas de al menos 13,5 rem
 * como quepan. Al ocultar el panel lateral, la cuadrícula gana ancho y añade columnas sin desbordarse.
 */
export const claseCuadricula = "grid grid-cols-2 gap-3 sm:grid-cols-[repeat(auto-fill,minmax(13.5rem,1fr))] sm:gap-5";

export function EsqueletoCatalogo({ cantidad = 6 }: { cantidad?: number }) {
  return (
    <div role="status" aria-live="polite">
      <span className="sr-only">Cargando productos…</span>
      <ul aria-hidden="true" className={claseCuadricula}>
        {Array.from({ length: cantidad }, (_, i) => (
          <li key={i} className="animate-pulse rounded-[1.6rem] bg-white p-2 shadow-tarjeta ring-1 ring-crema-300/70">
            <div className="aspect-[4/3] rounded-[1.2rem] bg-crema-200" />
            <div className="px-2 pb-2 pt-3">
              <div className="h-4 w-3/4 rounded bg-crema-200" />
              <div className="mt-2 h-3 w-1/2 rounded bg-crema-100" />
              <div className="mt-5 h-5 w-1/3 rounded bg-crema-200" />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Esqueleto de la página completa: lo muestra el límite de Suspense mientras se lee la URL (prerenderizado, panel visible). */
export function EsqueletoCatalogoPagina() {
  return (
    <main className="flex-1 bg-crema-100 font-sans text-tinta">
      <div className="bg-[linear-gradient(180deg,var(--color-crema-50)_0%,#f1f4e7_45%,var(--color-crema-100)_100%)]">
        <div className="mx-auto w-full max-w-7xl px-4 pb-6 pt-5 sm:px-6 sm:pb-8 sm:pt-9">
          <h1 className="text-2xl font-extrabold tracking-tight sm:text-4xl">Catálogo de productos</h1>
          <div className="mt-5 h-14 rounded-2xl bg-white shadow-tarjeta ring-1 ring-crema-300 lg:max-w-xl" />
        </div>
      </div>
      <div className="mx-auto w-full max-w-7xl px-4 pb-16 sm:px-6 lg:grid lg:grid-cols-[17rem_minmax(0,1fr)]">
        <div aria-hidden="true" className="hidden space-y-2 lg:block lg:w-[15rem]">
          {Array.from({ length: 7 }, (_, i) => (
            <div key={i} className="flex animate-pulse items-center gap-3 px-3 py-2">
              <span className="h-9 w-9 rounded-full bg-crema-200" />
              <span className="h-3 w-24 rounded bg-crema-200" />
            </div>
          ))}
        </div>
        <EsqueletoCatalogo />
      </div>
    </main>
  );
}

function Panel({ icono, titulo, children, rol }: { icono: ReactNode; titulo: string; children?: ReactNode; rol?: "alert" }) {
  return (
    <div role={rol} className="flex flex-col items-center rounded-[1.75rem] bg-white px-6 py-14 text-center shadow-tarjeta ring-1 ring-crema-300/70 sm:py-16">
      <div className={`mb-5 flex h-16 w-16 items-center justify-center rounded-full ${rol ? "bg-red-50 text-red-700 ring-1 ring-red-100" : "bg-marca-100 text-marca-700"}`}>
        {icono}
      </div>
      <h2 className="text-xl font-extrabold tracking-tight text-tinta">{titulo}</h2>
      {children}
    </div>
  );
}

const claseTexto = "mt-2 max-w-md text-sm leading-relaxed text-tinta-suave";
const claseAccion =
  "mt-6 inline-flex items-center gap-2 rounded-full bg-marca-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition-colors hover:bg-marca-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-marca-600 focus-visible:ring-offset-2";

export function CatalogoVacio() {
  return (
    <Panel icono={<IconoCanasta className="h-8 w-8" />} titulo="Todavía no hay productos publicados">
      <p className={claseTexto}>Cuando los puestos del mercado publiquen sus productos, aparecerán aquí.</p>
    </Panel>
  );
}

export function SinResultados({ alLimpiar }: { alLimpiar: () => void }) {
  return (
    <Panel icono={<IconoLupa className="h-8 w-8" />} titulo="No encontramos productos con esos filtros">
      <p className={claseTexto}>Pruebe con otra búsqueda, elija «Todos» o quite alguno de los filtros.</p>
      <button type="button" onClick={alLimpiar} className={claseAccion}>
        Limpiar filtros
      </button>
    </Panel>
  );
}

export function ErrorDelCatalogo({ error, alReintentar }: { error: ErrorCatalogo; alReintentar: () => void }) {
  const icono = error.tipo === "conexion" ? <IconoSinConexion className="h-8 w-8" /> : <IconoAlerta className="h-8 w-8" />;
  return (
    <Panel rol="alert" icono={icono} titulo={error.titulo}>
      <p className={claseTexto}>{error.mensaje}</p>
      {error.pista && (
        <p className="mt-4 max-w-lg rounded-xl bg-amber-50 px-3 py-2 text-left text-xs text-amber-900 ring-1 ring-inset ring-amber-100">
          <strong className="font-semibold">Pista para desarrollo:</strong> {error.pista}
        </p>
      )}
      <button type="button" onClick={alReintentar} className={claseAccion}>
        <IconoRecargar className="h-4 w-4" />
        Reintentar
      </button>
    </Panel>
  );
}
