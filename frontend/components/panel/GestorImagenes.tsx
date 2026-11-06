"use client";

import { useState } from "react";
import { ImagenProducto } from "@/components/catalogo/TarjetaProducto";
import { Aviso, claseBoton } from "@/components/comun";
import { eliminarImagen, subirImagen } from "@/lib/api";
import { mensajeError } from "@/lib/hooks";
import type { Producto } from "@/lib/tipos";

const TIPOS = ["image/jpeg", "image/png", "image/webp"];
const MAX = 2 * 1024 * 1024;

export function GestorImagenes({ producto, soloLectura, alCambiar }: { producto: Producto; soloLectura?: boolean; alCambiar: (p: Producto) => void }) {
  const [error, setError] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  async function elegir(e: React.ChangeEvent<HTMLInputElement>) {
    const archivo = e.target.files?.[0];
    e.target.value = "";
    if (!archivo) return;
    if (!TIPOS.includes(archivo.type)) return setError("Solo se admiten imágenes JPEG, PNG o WebP.");
    if (archivo.size > MAX) return setError("La imagen no puede superar 2 MB.");
    setError(null);
    setOcupado(true);
    try {
      alCambiar(await subirImagen(producto.id, archivo, producto.nombre));
    } catch (err) {
      setError(mensajeError(err));
    } finally {
      setOcupado(false);
    }
  }

  async function quitar(imagenId: string) {
    setOcupado(true);
    setError(null);
    try {
      alCambiar(await eliminarImagen(producto.id, imagenId));
    } catch (err) {
      setError(mensajeError(err));
    } finally {
      setOcupado(false);
    }
  }

  return (
    <section aria-labelledby="titulo-imagenes" className="space-y-3">
      <h2 id="titulo-imagenes" className="text-lg font-medium text-zinc-900 dark:text-zinc-50">Imágenes ({producto.imagenes.length}/5)</h2>
      {error && <Aviso tipo="error">{error}</Aviso>}
      <ul className="flex flex-wrap gap-3">
        {producto.imagenes.map((i) => (
          <li key={i.id} className="w-28">
            <div className="aspect-square overflow-hidden rounded-md border border-zinc-200 dark:border-zinc-700">
              <ImagenProducto url={i.url} alt={i.textoAlternativo ?? producto.nombre} />
            </div>
            {!soloLectura && (
              <button type="button" onClick={() => quitar(i.id)} disabled={ocupado} className="mt-1 w-full text-xs text-red-700 underline disabled:opacity-50">
                Quitar
              </button>
            )}
          </li>
        ))}
        {producto.imagenes.length === 0 && <li className="text-sm text-zinc-500">Aún no hay imágenes.</li>}
      </ul>
      {!soloLectura && producto.imagenes.length < 5 && (
        <label className={`${claseBoton("secundario")} cursor-pointer`}>
          {ocupado ? "Subiendo…" : "Agregar imagen"}
          <input type="file" accept={TIPOS.join(",")} className="sr-only" onChange={elegir} disabled={ocupado} />
        </label>
      )}
      <p className="text-xs text-zinc-500">JPEG, PNG o WebP, hasta 2 MB cada una. Requiere el almacenamiento de imágenes configurado en el servidor.</p>
    </section>
  );
}
