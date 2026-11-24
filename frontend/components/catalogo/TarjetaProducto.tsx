import Link from "next/link";
import type { ReactNode } from "react";
import { IconoCategoria, IconoImagen, IconoTienda } from "@/components/iconos";
import { TONOS } from "@/components/tienda/tonos";
import { claveCategoria } from "@/lib/catalogo";
import { precioTexto, unidadCorta } from "@/lib/formato";
import type { ProductoCatalogo } from "@/lib/tipos";

/**
 * Imagen de producto o marcador «Sin imagen». La usan el catálogo, el detalle y el panel: su firma no cambia (spec 004,
 * CA-CAT-12). `marcador` (opcional, E4) reemplaza el contenido visual del marcador; el nombre accesible sigue siendo
 * «Sin imagen».
 */
export function ImagenProducto({ url, alt, className = "", marcador }: { url?: string | null; alt: string; className?: string; marcador?: ReactNode }) {
  if (url) {
    // Las URL provienen del almacenamiento configurado (dominio variable); se usa <img> para no depender de remotePatterns.
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt={alt} loading="lazy" className={`h-full w-full object-cover ${className}`} />;
  }
  return marcador ? (
    <div role="img" aria-label="Sin imagen" className="flex h-full w-full items-center justify-center">
      {marcador}
    </div>
  ) : (
    <div role="img" aria-label="Sin imagen" className="flex h-full w-full flex-col items-center justify-center gap-1 bg-zinc-100 text-xs text-zinc-400 dark:bg-zinc-800 dark:text-zinc-500">
      <IconoImagen className="h-7 w-7" />
      <span aria-hidden="true">Sin imagen</span>
    </div>
  );
}

/**
 * Tarjeta de producto (spec 004, CA-CAT-04 y E4: CA-UI-05, CA-UI-06). Imagen con la categoría como insignia, nombre,
 * presentación o extracto, puesto, precio en soles y unidad tal como llegan de la API. No muestra disponibilidad,
 * descuentos ni valoraciones (A1, E1-A6). Todo el contenido enlaza al detalle; la acción (agregar o ingresar) va FUERA del
 * enlace, en la esquina inferior derecha, para no anidar elementos interactivos.
 */
export function TarjetaProducto({ producto: p, accion }: { producto: ProductoCatalogo; accion?: ReactNode }) {
  const img = p.imagenes[0];
  const extracto = p.presentacion ?? p.descripcion;
  const clave = claveCategoria(p.categoria.slug, p.categoria.nombre);
  const tono = TONOS[clave];
  return (
    <article className="group/tarjeta relative h-full rounded-[1.6rem] bg-white p-2 shadow-tarjeta ring-1 ring-crema-300/70 transition duration-200 hover:-translate-y-1 hover:shadow-flotante motion-reduce:transition-none motion-reduce:hover:translate-y-0">
      <Link href={`/catalogo/${p.id}`} className="flex h-full flex-col rounded-[1.35rem] outline-none focus-visible:ring-2 focus-visible:ring-marca-600 focus-visible:ring-offset-2">
        <div className={`relative aspect-[4/3] overflow-hidden rounded-[1.2rem] ${tono.fondo}`}>
          <ImagenProducto
            url={img?.url}
            alt={img?.textoAlternativo ?? p.nombre}
            className="transition duration-500 ease-out group-hover/tarjeta:scale-[1.04] motion-reduce:transition-none"
            marcador={
              <span className="flex flex-col items-center gap-1.5 pt-7 sm:pt-6">
                <span className={`flex h-12 w-12 items-center justify-center rounded-full bg-white/70 shadow-sm ring-1 ring-black/5 sm:h-16 sm:w-16 ${tono.icono}`}>
                  <IconoCategoria clave={clave} className="h-6 w-6 sm:h-8 sm:w-8" />
                </span>
                <span aria-hidden="true" className="text-[0.7rem] font-medium text-tinta-media">
                  Sin imagen
                </span>
              </span>
            }
          />
          <span className="absolute left-2.5 top-2.5 max-w-[calc(100%-1.25rem)] truncate rounded-full bg-white/95 px-2.5 py-1 text-[0.68rem] font-bold uppercase tracking-wide text-marca-800 shadow-sm">
            {p.categoria.nombre}
          </span>
        </div>
        <div className="flex flex-1 flex-col px-2 pb-2 pt-3">
          <h3 className="line-clamp-2 text-[0.98rem] font-bold leading-snug text-tinta">{p.nombre}</h3>
          {extracto && <p className="mt-0.5 line-clamp-1 text-[0.8rem] text-tinta-suave">{extracto}</p>}
          <p className="mt-1.5 flex items-center gap-1.5 text-xs text-tinta-suave">
            <IconoTienda className="h-3.5 w-3.5 shrink-0 text-marca-600" />
            <span className="truncate">
              Puesto {p.puesto.codigo} · {p.puesto.nombre}
            </span>
          </p>
          <p data-precio className={`mt-auto flex flex-wrap items-baseline gap-x-1 pt-3 ${accion ? "pr-12" : ""}`}>
            <span className="text-lg font-extrabold tabular-nums text-tinta">{precioTexto(p.precio)}</span>
            <span className="text-xs font-medium text-tinta-suave">/ {unidadCorta(p.unidadVenta)}</span>
          </p>
        </div>
      </Link>
      {accion && <div className="absolute bottom-3 right-3">{accion}</div>}
    </article>
  );
}
