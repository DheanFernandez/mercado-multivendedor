import Link from "next/link";
import { precioTexto, unidadCorta } from "@/lib/formato";
import type { ProductoCatalogo } from "@/lib/tipos";

export function ImagenProducto({ url, alt, className = "" }: { url?: string | null; alt: string; className?: string }) {
  return url ? (
    // Las URL provienen de Supabase Storage (dominio configurable); se usa <img> para no depender de remotePatterns.
    // eslint-disable-next-line @next/next/no-img-element
    <img src={url} alt={alt} loading="lazy" className={`h-full w-full object-cover ${className}`} />
  ) : (
    <div className="flex h-full w-full items-center justify-center bg-zinc-100 text-xs text-zinc-400 dark:bg-zinc-800" aria-label="Sin imagen">
      Sin imagen
    </div>
  );
}

export function TarjetaProducto({ producto: p }: { producto: ProductoCatalogo }) {
  const img = p.imagenes[0];
  return (
    <Link
      href={`/catalogo/${p.id}`}
      className="group flex flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm transition hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900"
    >
      <div className="aspect-[4/3] overflow-hidden bg-zinc-100">
        <ImagenProducto url={img?.url} alt={img?.textoAlternativo ?? p.nombre} className="transition group-hover:scale-105" />
      </div>
      <div className="flex flex-1 flex-col gap-1 p-4">
        <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">{p.categoria.nombre}</span>
        <h3 className="font-medium text-zinc-900 dark:text-zinc-50">{p.nombre}</h3>
        <p className="text-sm text-zinc-500">
          Puesto {p.puesto.codigo} · {p.puesto.nombre}
        </p>
        <p className="mt-auto pt-2 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
          {precioTexto(p.precio)} <span className="text-sm font-normal text-zinc-500">/ {unidadCorta(p.unidadVenta)}</span>
        </p>
      </div>
    </Link>
  );
}
