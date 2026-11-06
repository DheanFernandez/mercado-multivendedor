"use client";

import Link from "next/link";
import { useState } from "react";
import { ImagenProducto } from "@/components/catalogo/TarjetaProducto";
import { Acceso } from "@/components/panel/Acceso";
import { Aviso, Cargando, Contenedor, Insignia, Paginacion, Seleccion, claseBoton } from "@/components/comun";
import { cambiarEstadoProducto, listarProductos } from "@/lib/api";
import { precioTexto, unidadCorta } from "@/lib/formato";
import { mensajeError, useCarga } from "@/lib/hooks";
import type { Rol } from "@/lib/tipos";

const ROLES: Rol[] = ["COMERCIANTE", "ADMINISTRADOR"];

export default function PanelProductos() {
  return (
    <Acceso roles={ROLES} titulo="Mis productos">
      {(perfil) => <Lista esAdmin={perfil.rol === "ADMINISTRADOR"} />}
    </Acceso>
  );
}

function Lista({ esAdmin }: { esAdmin: boolean }) {
  const [estado, setEstado] = useState("");
  const [pagina, setPagina] = useState(1);
  const [aviso, setAviso] = useState<string | null>(null);
  const { datos, error, cargando, recargar } = useCarga(`${estado}|${pagina}`, () => listarProductos({ estado: estado || undefined, pagina, limite: 10 }));

  async function cambiar(id: string, accion: "PUBLICAR" | "DESACTIVAR") {
    setAviso(null);
    try {
      await cambiarEstadoProducto(id, accion);
      recargar();
    } catch (e) {
      setAviso(mensajeError(e));
    }
  }

  return (
    <Contenedor
      titulo={esAdmin ? "Productos (solo lectura)" : "Mis productos"}
      acciones={!esAdmin && <Link href="/panel/productos/nuevo" className={claseBoton("primario")}>Nuevo producto</Link>}
    >
      <div className="mb-4 max-w-xs">
        <Seleccion etiqueta="Filtrar por estado" value={estado} onChange={(e) => { setEstado(e.target.value); setPagina(1); }}>
          <option value="">Todos</option>
          <option value="BORRADOR">Borrador</option>
          <option value="PUBLICADO">Publicado</option>
          <option value="DESACTIVADO">Desactivado</option>
        </Seleccion>
      </div>
      {(error || aviso) && <div className="mb-4"><Aviso tipo="error">{error ?? aviso}</Aviso></div>}
      {cargando && <Cargando />}
      {datos && (
        <>
          {datos.datos.length === 0 ? (
            <p className="py-12 text-center text-zinc-500">
              {esAdmin ? "No hay productos." : <>Aún no tiene productos. <Link href="/panel/productos/nuevo" className="underline">Registre el primero</Link>.</>}
            </p>
          ) : (
            <ul className="divide-y divide-zinc-200 rounded-xl border border-zinc-200 bg-white dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-900">
              {datos.datos.map((p) => (
                <li key={p.id} className="flex flex-wrap items-center gap-4 p-4">
                  <div className="h-16 w-16 shrink-0 overflow-hidden rounded-md border border-zinc-200 dark:border-zinc-700">
                    <ImagenProducto url={p.imagenes[0]?.url} alt={p.nombre} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-zinc-900 dark:text-zinc-50">{p.nombre}</p>
                    <p className="text-sm text-zinc-500">{precioTexto(p.precio)} / {unidadCorta(p.unidadVenta)}</p>
                  </div>
                  <Insignia estado={p.estado} />
                  <div className="flex gap-2">
                    <Link href={`/panel/productos/${p.id}`} className={claseBoton("secundario")}>{esAdmin ? "Ver" : "Editar"}</Link>
                    {!esAdmin && (p.estado === "PUBLICADO" ? (
                      <button type="button" className={claseBoton("secundario")} onClick={() => cambiar(p.id, "DESACTIVAR")}>Desactivar</button>
                    ) : (
                      <button type="button" className={claseBoton("primario")} onClick={() => cambiar(p.id, "PUBLICAR")}>Publicar</button>
                    ))}
                  </div>
                </li>
              ))}
            </ul>
          )}
          <Paginacion pagina={datos.pagina} totalPaginas={datos.totalPaginas} alCambiar={setPagina} />
        </>
      )}
    </Contenedor>
  );
}
