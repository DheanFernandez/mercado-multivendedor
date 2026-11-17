"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { EsqueletoCatalogo } from "@/components/catalogo/EstadosCatalogo";
import { TarjetaProducto } from "@/components/catalogo/TarjetaProducto";
import { IconoCanasta, IconoCuadricula, IconoFlechaDerecha, IconoRecargar, IconoTienda } from "@/components/iconos";
import { AvisoFlotanteCarrito, BotonAgregar, useAgregarAlCarrito } from "@/components/tienda/AgregarAlCarrito";
import { BannerPrincipal, type MensajeBanner } from "@/components/tienda/BannerPrincipal";
import { BuscadorPrincipal, EncabezadoSeccion, FondoSuave, PromoSecundaria, claseContenedor } from "@/components/tienda/Bloques";
import { CategoriasVisuales } from "@/components/tienda/CategoriasVisuales";
import { buscarCatalogo, listarCategorias, puestosPublicos } from "@/lib/api";
import { claveCategoria } from "@/lib/catalogo";
import { useCarga } from "@/lib/hooks";
import type { Pagina, ProductoCatalogo } from "@/lib/tipos";

/** Grilla de productos del inicio: 2 columnas en móvil, 3 en tableta y 4 en escritorio (CA-UI-10). */
export const claseGrillaInicio = "grid grid-cols-2 gap-3 sm:gap-5 md:grid-cols-3 lg:grid-cols-4";

/**
 * Inicio comercial del mercado (spec 004, E4; CA-UI-04, CA-UI-05). Todo lo que se muestra sale de la API real: categorías,
 * novedades (`orden=recientes`), precios más bajos (`orden=precio_asc`), puestos públicos y sus recuentos. Los banners son
 * mensajes editoriales: sin precios, porcentajes ni contadores inventados.
 */
export function InicioVista() {
  const categorias = useCarga("inicio:categorias", listarCategorias);
  const novedades = useCarga("inicio:novedades", () => buscarCatalogo({ pagina: 1, limite: 8, orden: "recientes" }));
  const economicos = useCarga("inicio:economicos", () => buscarCatalogo({ pagina: 1, limite: 4, orden: "precio_asc" }));
  const puestos = useCarga("inicio:puestos", puestosPublicos);
  const carrito = useAgregarAlCarrito();

  const frutas = categorias.datos?.find((c) => claveCategoria(c.slug, c.nombre) === "frutas");
  const mensajes: MensajeBanner[] = [
    {
      etiqueta: "Del mercado a tu mesa",
      titulo: "Productos frescos del día",
      texto: "Frutas, verduras, carnes y más, directo de los puestos del mercado.",
      accion: { href: "/catalogo", texto: "Comprar ahora" },
    },
    {
      etiqueta: "Compra directo",
      titulo: "Compra directo de los puestos",
      texto: "Conoce cada puesto y arma un solo carrito con productos de varios de ellos.",
      accion: { href: "#puestos", texto: "Ver puestos" },
    },
    frutas
      ? { etiqueta: "Categorías", titulo: "Fruta fresca para tu semana", texto: "Elige por categoría y encuentra rápido lo que buscas.", accion: { href: `/catalogo?categoriaId=${frutas.id}`, texto: "Ver frutas" } }
      : { etiqueta: "Categorías", titulo: "Todo el mercado en un solo lugar", texto: "Elige por categoría y encuentra rápido lo que buscas.", accion: { href: "/catalogo", texto: "Explorar el catálogo" } },
  ];

  const tarjetas = (pagina: Pagina<ProductoCatalogo>) =>
    pagina.datos.map((p) => (
      <li key={p.id} className="min-w-0">
        <TarjetaProducto producto={p} accion={<BotonAgregar producto={p} sesion={carrito.sesion} enviando={carrito.enviando} alAgregar={carrito.agregar} />} />
      </li>
    ));

  return (
    <main className="flex-1 bg-crema-100 font-sans text-tinta">
      {/* Hero con fondo suave (referencia secundaria) */}
      <FondoSuave>
        <div className={`${claseContenedor} pb-8 pt-6 sm:pb-12 sm:pt-12`}>
          <div className="grid items-center gap-8 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
            <div className="min-w-0">
              <p className="inline-flex items-center gap-2 rounded-full bg-white/80 px-3 py-1 text-xs font-bold text-marca-700 shadow-sm ring-1 ring-crema-300">
                <span aria-hidden="true" className="h-2 w-2 rounded-full bg-marca-500" />
                ¡Hola! Bienvenido al mercado
              </p>
              <h1 className="mt-4 text-balance text-[2rem] font-extrabold leading-[1.08] tracking-tight sm:text-5xl xl:text-[3.25rem]">
                Compra productos frescos del mercado, <span className="text-marca-600">en un solo lugar</span>
              </h1>
              <p className="mt-4 max-w-xl text-base text-tinta-suave sm:text-lg">Encuentra frutas, verduras, carnes y más, directo de los puestos del mercado.</p>
              <BuscadorPrincipal className="mt-6 max-w-xl" />
              <div className="mt-5 flex flex-wrap items-center gap-3">
                <Link
                  href="/catalogo"
                  className="inline-flex items-center gap-2 rounded-full bg-marca-600 py-2.5 pl-5 pr-2.5 text-sm font-bold text-white shadow-md transition hover:bg-marca-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-marca-600 focus-visible:ring-offset-2"
                >
                  Ver catálogo
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/20">
                    <IconoFlechaDerecha className="h-4 w-4" />
                  </span>
                </Link>
                <Link href="/ofertas" className="rounded-full px-4 py-2.5 text-sm font-bold text-tinta transition hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-marca-600">
                  Ver ofertas
                </Link>
              </div>
            </div>
            <ResumenMercado productos={novedades.datos?.total} puestos={puestos.datos?.length} categorias={categorias.datos?.length} />
          </div>
        </div>
      </FondoSuave>

      <div className={`${claseContenedor} space-y-10 pb-16 sm:space-y-14`}>
        <section aria-labelledby="titulo-categorias">
          <EncabezadoSeccion id="titulo-categorias" titulo="Categorías" enlace={{ href: "/catalogo", texto: "Ver todo" }} />
          <CategoriasVisuales etiqueta="Categorías del mercado" categorias={categorias} modo={{ tipo: "enlace" }} />
        </section>

        <BannerPrincipal mensajes={mensajes} />

        <section aria-labelledby="novedades">
          <EncabezadoSeccion id="novedades" titulo="Novedades del mercado" subtitulo="Lo último que publicaron los puestos" enlace={{ href: "/catalogo", texto: "Ver todo" }} />
          <Productos carga={novedades} cantidad={8} vacio="Todavía no hay productos publicados.">
            {(p) => <ul className={claseGrillaInicio}>{tarjetas(p)}</ul>}
          </Productos>
        </section>

        <section aria-labelledby="economicos">
          <EncabezadoSeccion id="economicos" titulo="Precios más bajos" subtitulo="Ordenados de menor a mayor precio" enlace={{ href: "/catalogo?orden=precio_asc", texto: "Ver todos" }} />
          <Productos carga={economicos} cantidad={4} vacio="Todavía no hay productos publicados.">
            {(p) => <ul className={claseGrillaInicio}>{tarjetas(p)}</ul>}
          </Productos>
        </section>

        <section id="puestos" aria-labelledby="titulo-puestos" className="scroll-mt-24">
          <EncabezadoSeccion id="titulo-puestos" titulo="Compra por puesto" subtitulo="Los puestos del mercado que venden en la plataforma" />
          <Puestos carga={puestos} />
        </section>

        <PromoSecundaria puestos={puestos.datos?.length} />
      </div>
      <AvisoFlotanteCarrito aviso={carrito.aviso} alCerrar={carrito.cerrarAviso} />
    </main>
  );
}

interface Carga<T> {
  datos?: T;
  error?: string;
  recargar: () => void;
}

/** Sección de productos con sus estados: cargando, error (con «Reintentar») y vacía. */
export function Productos({ carga, cantidad, vacio, children }: { carga: Carga<Pagina<ProductoCatalogo>>; cantidad: number; vacio: string; children: (p: Pagina<ProductoCatalogo>) => ReactNode }) {
  if (carga.error) return <AvisoSeccion texto="No se pudieron cargar los productos." alReintentar={carga.recargar} />;
  if (!carga.datos) return <EsqueletoCatalogo cantidad={cantidad} />;
  if (carga.datos.datos.length === 0) return <AvisoSeccion texto={vacio} />;
  return <>{children(carga.datos)}</>;
}

export function AvisoSeccion({ texto, alReintentar }: { texto: string; alReintentar?: () => void }) {
  return (
    <div role={alReintentar ? "alert" : undefined} className="flex flex-wrap items-center gap-3 rounded-[1.5rem] bg-white px-5 py-6 text-sm text-tinta-suave shadow-tarjeta ring-1 ring-crema-300/70">
      <IconoCanasta className="h-6 w-6 text-marca-600" />
      <span className="flex-1">{texto}</span>
      {alReintentar && (
        <button type="button" onClick={alReintentar} className="inline-flex items-center gap-1.5 rounded-full bg-marca-600 px-4 py-2 font-bold text-white transition hover:bg-marca-700">
          <IconoRecargar className="h-4 w-4" />
          Reintentar
        </button>
      )}
    </div>
  );
}

/** Recuentos reales del mercado (CA-UI-05): mientras cargan, un esqueleto; nunca cifras inventadas. */
function ResumenMercado({ productos, puestos, categorias }: { productos?: number; puestos?: number; categorias?: number }) {
  const fila = (icono: ReactNode, n: number | undefined, singular: string, plural: string, fondo: string) => (
    <li className="flex items-center gap-4 rounded-2xl bg-white/70 p-3 ring-1 ring-crema-300/60">
      <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${fondo}`}>{icono}</span>
      {n === undefined ? (
        <span aria-hidden="true" className="h-5 w-32 animate-pulse rounded bg-crema-200" />
      ) : (
        <p className="text-sm text-tinta-suave">
          <span className="block text-2xl font-extrabold leading-none text-tinta">{n}</span>
          {n === 1 ? singular : plural}
        </p>
      )}
    </li>
  );
  return (
    <aside aria-label="El mercado hoy" className="hidden rounded-[2rem] bg-white/60 p-5 shadow-tarjeta ring-1 ring-white backdrop-blur lg:block">
      <p className="px-1 text-xs font-extrabold uppercase tracking-[0.16em] text-tinta-suave">El mercado hoy</p>
      <ul className="mt-3 space-y-3">
        {fila(<IconoCanasta className="h-6 w-6 text-marca-700" />, productos, "producto publicado", "productos publicados", "bg-marca-100")}
        {fila(<IconoTienda className="h-6 w-6 text-terracota" />, puestos, "puesto vendiendo", "puestos vendiendo", "bg-promo")}
        {fila(<IconoCuadricula className="h-6 w-6 text-[#3e6a8a]" />, categorias, "categoría", "categorías", "bg-[#eaf1f6]")}
      </ul>
    </aside>
  );
}

function Puestos({ carga }: { carga: Carga<{ id: string; codigo: string; nombre: string }[]> }) {
  if (carga.error) return <AvisoSeccion texto="No se pudieron cargar los puestos." alReintentar={carga.recargar} />;
  if (!carga.datos)
    return (
      <div role="status" className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <span className="sr-only">Cargando puestos…</span>
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} aria-hidden="true" className="h-[5.5rem] animate-pulse rounded-[1.5rem] bg-white ring-1 ring-crema-300/70" />
        ))}
      </div>
    );
  if (carga.datos.length === 0) return <AvisoSeccion texto="Aún no hay puestos vendiendo en la plataforma." />;
  return (
    <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-5 lg:grid-cols-4">
      {carga.datos.map((p) => (
        <li key={p.id}>
          <Link
            href={`/catalogo?puestoId=${p.id}`}
            className="group flex items-center gap-4 rounded-[1.5rem] bg-white p-4 shadow-tarjeta ring-1 ring-crema-300/70 transition hover:-translate-y-0.5 hover:shadow-flotante focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-marca-600 motion-reduce:transition-none motion-reduce:hover:translate-y-0"
          >
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-marca-100 text-marca-700 transition group-hover:bg-marca-600 group-hover:text-white">
              <IconoTienda className="h-7 w-7" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-xs font-bold uppercase tracking-wide text-tinta-suave">Puesto {p.codigo}</span>
              <span className="block truncate font-extrabold text-tinta">{p.nombre}</span>
              <span className="mt-0.5 inline-flex items-center gap-1 text-xs font-bold text-marca-700">
                Ver productos
                <IconoFlechaDerecha className="h-3.5 w-3.5" />
              </span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
