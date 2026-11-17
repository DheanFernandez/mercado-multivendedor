"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { type FormEvent, type ReactNode, useEffect, useId, useMemo, useRef } from "react";
import { CatalogoVacio, EsqueletoCatalogo, ErrorDelCatalogo, SinResultados, claseCuadricula } from "@/components/catalogo/EstadosCatalogo";
import { PanelCategorias } from "@/components/catalogo/PanelCategorias";
import { TarjetaProducto } from "@/components/catalogo/TarjetaProducto";
import { Paginacion } from "@/components/comun";
import { IconoCerrar, IconoFiltros, IconoLupa } from "@/components/iconos";
import { AvisoFlotanteCarrito, BotonAgregar, useAgregarAlCarrito } from "@/components/tienda/AgregarAlCarrito";
import { claseBotonBusqueda, claseCampoBusqueda } from "@/components/tienda/Bloques";
import { CategoriasVisuales } from "@/components/tienda/CategoriasVisuales";
import { listarCategorias, puestosPublicos } from "@/lib/api";
import {
  FILTROS_VACIOS,
  type FiltrosCatalogo,
  ORDENES,
  type Orden,
  cambiarFiltros,
  clasificarError,
  escribirFiltros,
  etiquetasFiltros,
  hayFiltros,
  leerFiltros,
  useCatalogo,
} from "@/lib/catalogo";
import { useCarga } from "@/lib/hooks";
import { ID_PANEL_LATERAL, ID_PANEL_MOVIL, abrirPanelMovil, cerrarPanelMovil, usePanelCategorias, useRegistrarPanel } from "@/lib/panelCategorias";

const DESARROLLO = process.env.NODE_ENV === "development";

/**
 * Catálogo público (spec 004 y enmiendas E1 y E4; RF16–RF18, HU01–HU02). Al entrar consulta la primera página sin filtros.
 * Las categorías de la API están en un panel lateral que el logotipo del encabezado oculta o muestra (en móvil, un diálogo
 * superpuesto y, además, una fila de categorías visuales); elegir una filtra al instante. La URL es la única fuente del
 * estado de filtros: se actualiza con `history.replaceState`, que Next.js integra con `useSearchParams`, de modo que «Atrás»
 * desde el detalle restaura la vista. Las tarjetas permiten agregar al carrito (CA-UI-07).
 */
export function CatalogoVista() {
  const pathname = usePathname();
  const parametros = useSearchParams();
  const consulta = parametros.toString();
  const filtros = useMemo(() => leerFiltros(new URLSearchParams(consulta)), [consulta]);

  const productos = useCatalogo(filtros);
  const categorias = useCarga("categorias", listarCategorias);
  const puestos = useCarga("puestos", puestosPublicos);
  const carrito = useAgregarAlCarrito();

  useRegistrarPanel();
  const panel = usePanelCategorias();
  const lateralVisible = panel.visibleEscritorio;
  // Al pasar a escritorio, el diálogo móvil no debe quedar abierto (bloquearía la página).
  useEffect(() => {
    if (panel.escritorio) cerrarPanelMovil();
  }, [panel.escritorio]);

  const resultados = useRef<HTMLElement>(null);
  const idResultados = useId();
  const idBusqueda = useId();
  const idOrden = useId();
  const idTituloLateral = useId();
  const idTituloMovil = useId();

  function navegar(nuevos: FiltrosCatalogo) {
    const qs = escribirFiltros(nuevos);
    window.history.replaceState(null, "", qs ? `${pathname}?${qs}` : pathname);
  }
  const aplicar = (cambios: Partial<FiltrosCatalogo>) => navegar(cambiarFiltros(filtros, cambios));
  const limpiar = () => navegar({ ...FILTROS_VACIOS, orden: filtros.orden });

  function elegirCategoria(categoriaId: string | undefined) {
    aplicar({ categoriaId });
    cerrarPanelMovil(); // en móvil, se ve el resultado de inmediato (CA-CAT-17)
  }

  function buscar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const q = String(new FormData(e.currentTarget).get("q") ?? "").trim().slice(0, 100);
    aplicar({ q: q || undefined });
  }

  function irAPagina(pagina: number) {
    aplicar({ pagina });
    resultados.current?.scrollIntoView?.({ behavior: "smooth", block: "start" });
  }

  const etiquetas = etiquetasFiltros(filtros, categorias.datos, puestos.datos);
  const conFiltros = hayFiltros(filtros);
  const pagina = productos.datos;
  const error = productos.error ? clasificarError(productos.error, DESARROLLO) : null;
  const categoriaActual = categorias.datos?.find((c) => c.id === filtros.categoriaId);
  const titulo = categoriaActual?.nombre ?? (filtros.categoriaId ? "Categoría" : filtros.q ? `Resultados para «${filtros.q}»` : "Todos los productos");

  const propsPanel = {
    categorias,
    categoriaId: filtros.categoriaId,
    alElegirCategoria: elegirCategoria,
    puestos,
    puestoId: filtros.puestoId,
    alElegirPuesto: (puestoId: string | undefined) => aplicar({ puestoId }),
  };

  let contenido;
  if (error) contenido = <ErrorDelCatalogo error={error} alReintentar={productos.reintentar} />;
  else if (!pagina) contenido = <EsqueletoCatalogo />;
  else if (pagina.total === 0 && !productos.cargando) contenido = conFiltros ? <SinResultados alLimpiar={limpiar} /> : <CatalogoVacio />;
  else if (pagina.datos.length === 0 && productos.cargando) contenido = <EsqueletoCatalogo />;
  else {
    contenido = (
      <>
        <ul className={`${claseCuadricula} transition-opacity ${productos.cargando ? "opacity-50" : ""}`}>
          {pagina.datos.map((p) => (
            <li key={p.id} className="min-w-0">
              <TarjetaProducto producto={p} accion={<BotonAgregar producto={p} sesion={carrito.sesion} enviando={carrito.enviando} alAgregar={carrito.agregar} />} />
            </li>
          ))}
        </ul>
        <Paginacion pagina={pagina.pagina} totalPaginas={pagina.totalPaginas} alCambiar={irAPagina} />
      </>
    );
  }

  return (
    <main className="flex-1 bg-crema-100 font-sans text-tinta">
      {/* Cabecera con fondo suave y buscador, siempre arriba (CA-UI-09) */}
      <div className="relative isolate overflow-hidden bg-[linear-gradient(180deg,var(--color-crema-50)_0%,#f1f4e7_45%,var(--color-crema-100)_100%)]">
        <div aria-hidden="true" className="pointer-events-none absolute -left-24 -top-28 -z-10 h-72 w-72 rounded-full bg-marca-100/80 blur-3xl" />
        <div aria-hidden="true" className="pointer-events-none absolute -right-16 -top-16 -z-10 h-64 w-64 rounded-full bg-promo-rosa/80 blur-3xl" />
        <div className="mx-auto w-full max-w-7xl px-4 pb-3 pt-4 sm:px-6 sm:pb-8 sm:pt-9">
          <div className="flex flex-col gap-3 sm:gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h1 className="text-2xl font-extrabold tracking-tight sm:text-4xl">Catálogo de productos</h1>
              <p className="mt-1.5 hidden text-[0.95rem] text-tinta-suave sm:block">Productos frescos de los puestos del mercado, en un solo lugar.</p>
            </div>
            <form key={filtros.q ?? ""} role="search" onSubmit={buscar} className="relative w-full lg:max-w-xl">
              <label htmlFor={idBusqueda} className="sr-only">
                Buscar productos
              </label>
              <IconoLupa className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-tinta-suave" />
              <input id={idBusqueda} name="q" type="search" defaultValue={filtros.q} maxLength={100} autoComplete="off" placeholder="Busca papa, tomate, limón, queso…" className={claseCampoBusqueda} />
              <button type="submit" className={claseBotonBusqueda}>
                Buscar
              </button>
            </form>
          </div>
          {/* Categorías visuales en móvil: filtran al instante (en escritorio están en la barra lateral) */}
          <CategoriasVisuales
            etiqueta="Filtrar por categoría"
            categorias={categorias}
            modo={{ tipo: "boton", activa: filtros.categoriaId, alElegir: (id) => aplicar({ categoriaId: id }) }}
            className="mt-3 lg:hidden"
          />
        </div>
      </div>

      {/*
       * Rejilla [panel | resultados] (CA-CAT-15, CA-CAT-16). En escritorio la columna del panel pasa de 17 rem a 0 con una
       * transición de grid-template-columns (solo si el usuario no pidió reducir el movimiento); el contenido oculto queda
       * inerte. En móvil el panel no ocupa espacio.
       */}
      <div className="mx-auto w-full max-w-7xl px-4 pb-16 pt-2 sm:px-6 sm:pt-4">
        <div
          data-panel={lateralVisible ? "visible" : "oculto"}
          className={`lg:grid lg:motion-safe:transition-[grid-template-columns] lg:motion-safe:duration-300 lg:motion-safe:ease-out ${
            lateralVisible ? "lg:grid-cols-[17rem_minmax(0,1fr)]" : "lg:grid-cols-[0rem_minmax(0,1fr)]"
          }`}
        >
          <aside id={ID_PANEL_LATERAL} aria-labelledby={idTituloLateral} inert={!lateralVisible} className="hidden overflow-clip lg:block">
            <div
              className={`sticky top-24 max-h-[calc(100dvh-7rem)] w-[15rem] overflow-y-auto rounded-[1.75rem] bg-white p-3 pb-4 shadow-tarjeta ring-1 ring-crema-300/70 transition-[opacity,translate,visibility] duration-300 ease-out [scrollbar-width:thin] motion-reduce:transition-none ${
                lateralVisible ? "" : "invisible -translate-x-4 opacity-0"
              }`}
            >
              <div className="pt-2">
                <PanelCategorias idTitulo={idTituloLateral} {...propsPanel} />
              </div>
            </div>
          </aside>

          {/* Resultados */}
          <section ref={resultados} aria-labelledby={idResultados} aria-busy={productos.cargando} className="min-w-0 scroll-mt-24">
            <div className="mb-4 flex items-center justify-between gap-3 sm:mb-5 sm:items-end">
              <div className="min-w-0 flex-1">
                <h2 id={idResultados} className="line-clamp-2 text-base font-extrabold leading-tight tracking-tight sm:line-clamp-1 sm:text-2xl">
                  {titulo}
                </h2>
                <p className="mt-0.5 text-sm text-tinta-suave" aria-live="polite">
                  {pagina && !error ? `${pagina.total} ${pagina.total === 1 ? "producto" : "productos"}` : " "}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  onClick={abrirPanelMovil}
                  aria-haspopup="dialog"
                  aria-controls={ID_PANEL_MOVIL}
                  aria-expanded={panel.abiertoMovil}
                  title="Categorías y puesto"
                  className="inline-flex h-11 w-11 shrink-0 items-center justify-center gap-2 rounded-full bg-white text-sm font-bold text-tinta shadow-tarjeta ring-1 ring-crema-300 transition-colors hover:bg-crema-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-marca-600 sm:w-auto sm:px-4 lg:hidden"
                >
                  <IconoFiltros className="h-[1.1rem] w-[1.1rem] text-marca-700" />
                  <span className="sr-only sm:not-sr-only">Categorías</span>
                </button>
                <label htmlFor={idOrden} className="sr-only whitespace-nowrap text-sm font-medium text-tinta-suave sm:not-sr-only">
                  Ordenar por
                </label>
                <select
                  id={idOrden}
                  value={filtros.orden}
                  onChange={(e) => aplicar({ orden: e.target.value as Orden })}
                  className="h-11 w-[8.75rem] rounded-full border-0 bg-white pl-4 pr-8 text-sm font-bold text-tinta shadow-tarjeta ring-1 ring-crema-300 transition hover:ring-crema-400 focus:outline-none focus:ring-2 focus:ring-marca-600 sm:w-auto sm:pr-9"
                >
                  {ORDENES.map((o) => (
                    <option key={o.valor} value={o.valor}>
                      {o.texto}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {etiquetas.length > 0 && (
              <div className="mb-5 flex flex-wrap items-center gap-2">
                <ul aria-label="Filtros activos" className="flex flex-wrap gap-2">
                  {etiquetas.map((e) => (
                    <li key={e.clave}>
                      <span className="inline-flex items-center gap-1 rounded-full bg-marca-100 py-1 pl-3 pr-1 text-sm font-semibold text-marca-800">
                        {e.texto}
                        <button
                          type="button"
                          onClick={() => aplicar(e.quitar)}
                          aria-label={`Quitar filtro: ${e.texto}`}
                          className="rounded-full p-1 transition-colors hover:bg-marca-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-marca-600"
                        >
                          <IconoCerrar className="h-3.5 w-3.5" />
                        </button>
                      </span>
                    </li>
                  ))}
                </ul>
                <button type="button" onClick={limpiar} className="px-2 text-sm font-semibold text-tinta-suave underline-offset-4 hover:text-tinta hover:underline">
                  Limpiar todo
                </button>
              </div>
            )}

            {contenido}
          </section>
        </div>
      </div>

      <PanelMovil abierto={panel.abiertoMovil} idTitulo={idTituloMovil}>
        <PanelCategorias mostrarTitulo={false} {...propsPanel} />
      </PanelMovil>
      <AvisoFlotanteCarrito aviso={carrito.aviso} alCerrar={carrito.cerrarAviso} />
    </main>
  );
}

/**
 * Panel de categorías en móvil (CA-CAT-17): `<dialog>` modal nativo que entra desde la izquierda. Atrapa el foco, se cierra
 * con Esc, «Cerrar», el fondo o al elegir una categoría, y el navegador devuelve el foco al control que lo abrió. El contenido
 * permanece montado para que también la salida sea animada; cerrado, el diálogo no se muestra ni es accesible.
 */
function PanelMovil({ abierto, idTitulo, children }: { abierto: boolean; idTitulo: string; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (abierto && !d.open) d.showModal?.();
    if (!abierto && d.open) d.close();
  }, [abierto]);
  // El diálogo modal no impide desplazar la página de fondo: se bloquea mientras está abierto.
  useEffect(() => {
    if (!abierto) return;
    const raiz = document.documentElement;
    const previo = raiz.style.overflow;
    raiz.style.overflow = "hidden";
    return () => {
      raiz.style.overflow = previo;
    };
  }, [abierto]);

  return (
    <dialog
      ref={ref}
      id={ID_PANEL_MOVIL}
      aria-labelledby={idTitulo}
      onClose={cerrarPanelMovil}
      onClick={(e) => e.target === ref.current && cerrarPanelMovil()}
      className="fixed inset-y-0 left-0 right-auto m-0 h-dvh max-h-none w-[min(20rem,86vw)] max-w-none -translate-x-full rounded-r-[1.75rem] bg-white p-0 font-sans text-tinta shadow-2xl transition-[translate,display,overlay] transition-discrete duration-300 ease-out backdrop:bg-tinta/0 backdrop:transition-[background-color,display,overlay] backdrop:transition-discrete backdrop:duration-300 open:translate-x-0 open:backdrop:bg-tinta/40 motion-reduce:transition-none motion-reduce:backdrop:transition-none starting:open:-translate-x-full starting:open:backdrop:bg-tinta/0"
    >
      <div className="flex h-full flex-col">
        <div className="flex items-center justify-between border-b border-crema-300 px-5 py-4">
          <h2 id={idTitulo} className="text-xl font-extrabold tracking-tight">
            Categorías
          </h2>
          <button
            type="button"
            onClick={cerrarPanelMovil}
            aria-label="Cerrar"
            className="rounded-full p-2 text-tinta-suave transition-colors hover:bg-crema-100 hover:text-tinta focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-marca-600"
          >
            <IconoCerrar className="h-5 w-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-2 py-4">{children}</div>
        <div className="border-t border-crema-300 px-5 py-4">
          <button
            type="button"
            onClick={cerrarPanelMovil}
            className="w-full rounded-full bg-marca-600 px-4 py-3 text-sm font-bold text-white transition-colors hover:bg-marca-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-marca-600 focus-visible:ring-offset-2"
          >
            Ver productos
          </button>
        </div>
      </div>
    </dialog>
  );
}
