"use client";

import Link from "next/link";
import { useState } from "react";
import { ImagenProducto } from "@/components/catalogo/TarjetaProducto";
import { Aviso, Cargando, Contenedor, claseBoton } from "@/components/comun";
import { detalleCatalogo } from "@/lib/api";
import { UNIDADES, precioTexto } from "@/lib/formato";
import { useCarga } from "@/lib/hooks";

export function DetalleProducto({ id }: { id: string }) {
  const { datos: p, error, cargando } = useCarga(id, () => detalleCatalogo(id));
  const [elegida, setElegida] = useState(0);

  if (cargando) return <Contenedor titulo="Producto"><Cargando /></Contenedor>;
  if (error || !p) {
    return (
      <Contenedor titulo="Producto no disponible" acciones={<Link href="/catalogo" className={claseBoton("secundario")}>Volver al catálogo</Link>}>
        <Aviso tipo="error">{error ?? "No se encontró el producto."}</Aviso>
      </Contenedor>
    );
  }
  const img = p.imagenes[elegida] ?? p.imagenes[0];

  return (
    <Contenedor titulo={p.nombre} acciones={<Link href="/catalogo" className={claseBoton("secundario")}>← Catálogo</Link>}>
      <div className="grid gap-8 md:grid-cols-2">
        <div>
          <div className="aspect-square overflow-hidden rounded-xl border border-zinc-200 bg-zinc-100 dark:border-zinc-800">
            <ImagenProducto url={img?.url} alt={img?.textoAlternativo ?? p.nombre} />
          </div>
          {p.imagenes.length > 1 && (
            <ul className="mt-3 flex gap-2">
              {p.imagenes.map((i, n) => (
                <li key={n}>
                  <button type="button" onClick={() => setElegida(n)} aria-label={`Ver imagen ${n + 1}`} aria-pressed={n === elegida} className={`h-16 w-16 overflow-hidden rounded-md border-2 ${n === elegida ? "border-zinc-900 dark:border-zinc-100" : "border-transparent"}`}>
                    <ImagenProducto url={i.url} alt={i.textoAlternativo ?? `${p.nombre} ${n + 1}`} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="space-y-5">
          <p className="text-3xl font-bold text-zinc-900 dark:text-zinc-50">
            {precioTexto(p.precio)} <span className="text-base font-normal text-zinc-500">por {UNIDADES[p.unidadVenta]?.nombre.toLowerCase() ?? p.unidadVenta.toLowerCase()}</span>
          </p>
          {p.presentacion && <p className="text-zinc-700 dark:text-zinc-300">Presentación: {p.presentacion}</p>}
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
            <dt className="font-medium text-zinc-500">Categoría</dt>
            <dd className="text-zinc-900 dark:text-zinc-100">{p.categoria.nombre}</dd>
            <dt className="font-medium text-zinc-500">Puesto</dt>
            <dd className="text-zinc-900 dark:text-zinc-100">
              {p.puesto.nombre} <span className="text-zinc-500">(puesto {p.puesto.codigo})</span>
            </dd>
          </dl>
          {p.descripcion && (
            <div>
              <h2 className="mb-1 text-sm font-medium text-zinc-500">Descripción</h2>
              <p className="whitespace-pre-line text-zinc-800 dark:text-zinc-200">{p.descripcion}</p>
            </div>
          )}
          <Aviso tipo="info">La compra se habilitará próximamente. Por ahora puede consultar el producto y el puesto donde lo encuentra.</Aviso>
        </div>
      </div>
    </Contenedor>
  );
}
