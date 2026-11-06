"use client";

import Link from "next/link";
import { useState } from "react";
import { Acceso } from "@/components/panel/Acceso";
import { FormularioProducto } from "@/components/panel/FormularioProducto";
import { GestorImagenes } from "@/components/panel/GestorImagenes";
import { Aviso, Cargando, Contenedor, Insignia, claseBoton } from "@/components/comun";
import { actualizarProducto, cambiarEstadoProducto, listarCategorias, listarCategoriasGestion, misPuestos, obtenerProducto } from "@/lib/api";
import { mensajeError, useCarga } from "@/lib/hooks";
import type { Producto } from "@/lib/tipos";

export function EditarProducto({ id }: { id: string }) {
  return (
    <Acceso roles={["COMERCIANTE", "ADMINISTRADOR"]} titulo="Producto">
      {(perfil) => <Contenido id={id} soloLectura={perfil.rol === "ADMINISTRADOR"} />}
    </Acceso>
  );
}

function Contenido({ id, soloLectura }: { id: string; soloLectura: boolean }) {
  const producto = useCarga(`p-${id}`, () => obtenerProducto(id));
  // El administrador ve también las categorías inactivas (por si el producto usa una).
  const categorias = useCarga(`c-${soloLectura}`, () => (soloLectura ? listarCategoriasGestion() : listarCategorias()));
  const puestos = useCarga("puestos", () => (soloLectura ? Promise.resolve([]) : misPuestos()));
  const [editado, setEditado] = useState<Producto | null>(null);
  const [aviso, setAviso] = useState<{ tipo: "ok" | "error"; texto: string } | null>(null);

  const p = editado ?? producto.datos;
  const error = producto.error ?? categorias.error ?? puestos.error;
  const volver = <Link href="/panel/productos" className={claseBoton("secundario")}>← Productos</Link>;

  if (error) return <Contenedor titulo="Producto" acciones={volver}><Aviso tipo="error">{error}</Aviso></Contenedor>;
  if (!p || !categorias.datos || !puestos.datos) return <Contenedor titulo="Producto" acciones={volver}><Cargando /></Contenedor>;

  const puesto = puestos.datos.find((x) => x.id === p.puestoId);

  async function cambiarEstado(accion: "PUBLICAR" | "DESACTIVAR") {
    setAviso(null);
    try {
      setEditado(await cambiarEstadoProducto(id, accion));
      setAviso({ tipo: "ok", texto: accion === "PUBLICAR" ? "Producto publicado en el catálogo." : "Producto desactivado." });
    } catch (e) {
      setAviso({ tipo: "error", texto: mensajeError(e) });
    }
  }

  return (
    <Contenedor
      titulo={p.nombre}
      acciones={
        <>
          {volver}
          {p.estado === "PUBLICADO" && <Link href={`/catalogo/${p.id}`} className={claseBoton("secundario")}>Ver en catálogo</Link>}
        </>
      }
    >
      <div className="max-w-3xl space-y-8">
        <div className="flex flex-wrap items-center gap-3">
          <Insignia estado={p.estado} />
          {puesto && <span className="text-sm text-zinc-500">Puesto {puesto.codigo}</span>}
          {!soloLectura && (p.estado === "PUBLICADO" ? (
            <button type="button" className={claseBoton("secundario")} onClick={() => cambiarEstado("DESACTIVAR")}>Desactivar</button>
          ) : (
            <button type="button" className={claseBoton("primario")} onClick={() => cambiarEstado("PUBLICAR")}>Publicar</button>
          ))}
        </div>
        {aviso && <Aviso tipo={aviso.tipo}>{aviso.texto}</Aviso>}
        <div className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
          <FormularioProducto
            key={`${p.nombre}|${p.precio}|${p.categoriaId}|${p.unidadVenta}`}
            inicial={p}
            puestos={puestos.datos}
            categorias={categorias.datos}
            soloLectura={soloLectura}
            etiquetaBoton="Guardar cambios"
            alGuardar={async (d) => {
              // El puesto no se puede cambiar: solo se envían los campos editables.
              const { categoriaId, nombre, descripcion, precio, unidadVenta, presentacion } = d;
              setEditado(await actualizarProducto(id, { categoriaId, nombre, descripcion, precio, unidadVenta, presentacion }));
              setAviso({ tipo: "ok", texto: "Cambios guardados." });
            }}
          />
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
          <GestorImagenes producto={p} soloLectura={soloLectura} alCambiar={setEditado} />
        </div>
      </div>
    </Contenedor>
  );
}
