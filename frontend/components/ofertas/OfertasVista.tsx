"use client";

import Link from "next/link";
import { TarjetaProducto } from "@/components/catalogo/TarjetaProducto";
import { IconoEtiqueta, IconoFlechaDerecha } from "@/components/iconos";
import { Productos, claseGrillaInicio } from "@/components/inicio/InicioVista";
import { AvisoFlotanteCarrito, BotonAgregar, useAgregarAlCarrito } from "@/components/tienda/AgregarAlCarrito";
import { EncabezadoSeccion, FondoSuave, claseContenedor } from "@/components/tienda/Bloques";
import { buscarCatalogo } from "@/lib/api";
import { useCarga } from "@/lib/hooks";

/**
 * Ofertas (spec 004, E4; CA-UI-08). El backend aún no tiene un modelo de promociones (ni precio anterior, ni porcentaje, ni
 * vigencia): la página lo dice con claridad y, mientras tanto, muestra los precios más bajos REALES (`orden=precio_asc`).
 */
export function OfertasVista() {
  const economicos = useCarga("ofertas:economicos", () => buscarCatalogo({ pagina: 1, limite: 8, orden: "precio_asc" }));
  const carrito = useAgregarAlCarrito();

  return (
    <main className="flex-1 bg-crema-100 font-sans text-tinta">
      <FondoSuave>
        <div className={`${claseContenedor} pb-8 pt-6 sm:pb-10 sm:pt-12`}>
          <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-terracota">Ofertas</p>
          <h1 className="mt-2 text-3xl font-extrabold tracking-tight sm:text-5xl">Ofertas del mercado</h1>
          <p className="mt-3 max-w-2xl text-base text-tinta-suave sm:text-lg">Aquí verás las promociones que publiquen los puestos del mercado.</p>
        </div>
      </FondoSuave>

      <div className={`${claseContenedor} space-y-10 pb-16 sm:space-y-14`}>
        <section aria-labelledby="sin-ofertas" className="relative isolate overflow-hidden rounded-[1.75rem] bg-[linear-gradient(110deg,var(--color-promo)_0%,var(--color-promo-rosa)_100%)] px-6 py-8 ring-1 ring-black/5 sm:px-10 sm:py-10">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
            <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-white text-terracota shadow-sm">
              <IconoEtiqueta className="h-8 w-8" />
            </span>
            <div className="min-w-0 flex-1">
              <h2 id="sin-ofertas" className="text-xl font-extrabold tracking-tight sm:text-2xl">
                Aún no hay ofertas publicadas
              </h2>
              <p className="mt-1.5 max-w-2xl text-sm text-tinta-media sm:text-base">
                Cuando los puestos del mercado publiquen promociones, las verás aquí. Mientras tanto, revisa los precios más bajos del catálogo.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <a href="#precios-bajos" className="rounded-full bg-marca-700 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-marca-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-marca-700 focus-visible:ring-offset-2">
                Ver precios más bajos
              </a>
              <Link href="/catalogo" className="inline-flex items-center gap-1.5 rounded-full bg-white px-5 py-2.5 text-sm font-bold text-tinta transition hover:bg-crema-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-marca-600">
                Ir al catálogo
                <IconoFlechaDerecha className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </section>

        <section id="precios-bajos" aria-labelledby="titulo-precios" className="scroll-mt-24">
          <EncabezadoSeccion id="titulo-precios" titulo="Precios más bajos" subtitulo="Ordenados de menor a mayor precio" enlace={{ href: "/catalogo?orden=precio_asc", texto: "Ver todos" }} />
          <Productos carga={economicos} cantidad={8} vacio="Todavía no hay productos publicados.">
            {(p) => (
              <ul className={claseGrillaInicio}>
                {p.datos.map((x) => (
                  <li key={x.id} className="min-w-0">
                    <TarjetaProducto producto={x} accion={<BotonAgregar producto={x} sesion={carrito.sesion} enviando={carrito.enviando} alAgregar={carrito.agregar} />} />
                  </li>
                ))}
              </ul>
            )}
          </Productos>
        </section>
      </div>
      <AvisoFlotanteCarrito aviso={carrito.aviso} alCerrar={carrito.cerrarAviso} />
    </main>
  );
}
