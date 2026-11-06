"use client";

import Link from "next/link";
import { type FormEvent, useState } from "react";
import { Acceso } from "@/components/panel/Acceso";
import { Aviso, Cargando, Contenedor, Entrada, claseBoton } from "@/components/comun";
import { actualizarCategoria, cambiarDisponibilidadCategoria, crearCategoria, listarCategoriasGestion } from "@/lib/api";
import { mensajeError, useCarga } from "@/lib/hooks";
import type { Categoria } from "@/lib/tipos";

export default function PanelCategorias() {
  return (
    <Acceso roles={["ADMINISTRADOR"]} titulo="Categorías">
      {() => <Gestion />}
    </Acceso>
  );
}

function Gestion() {
  const { datos, error, cargando, recargar } = useCarga("gestion", listarCategoriasGestion);
  const [aviso, setAviso] = useState<string | null>(null);
  const [editando, setEditando] = useState<string | null>(null);

  async function ejecutar(accion: () => Promise<unknown>) {
    setAviso(null);
    try {
      await accion();
      setEditando(null);
      recargar();
      return true;
    } catch (e) {
      setAviso(mensajeError(e));
      return false;
    }
  }

  async function crear(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formulario = e.currentTarget;
    const d = new FormData(formulario);
    const ok = await ejecutar(() => crearCategoria({ nombre: String(d.get("nombre")).trim(), descripcion: String(d.get("descripcion")).trim() || undefined }));
    if (ok) formulario.reset();
  }

  async function guardar(e: FormEvent<HTMLFormElement>, c: Categoria) {
    e.preventDefault();
    const d = new FormData(e.currentTarget);
    await ejecutar(() => actualizarCategoria(c.id, { nombre: String(d.get("nombre")).trim(), descripcion: String(d.get("descripcion")).trim() || null }));
  }

  return (
    <Contenedor titulo="Categorías de productos" acciones={<Link href="/panel" className={claseBoton("secundario")}>← Administración</Link>}>
      <form onSubmit={crear} className="mb-6 grid gap-3 rounded-xl border border-zinc-200 bg-white p-4 sm:grid-cols-[1fr_2fr_auto] sm:items-end dark:border-zinc-800 dark:bg-zinc-900">
        <Entrada etiqueta="Nombre" name="nombre" required maxLength={80} />
        <Entrada etiqueta="Descripción (opcional)" name="descripcion" maxLength={500} />
        <button type="submit" className={claseBoton("primario")}>Crear categoría</button>
      </form>
      {(error || aviso) && <div className="mb-4"><Aviso tipo="error">{error ?? aviso}</Aviso></div>}
      {cargando && <Cargando />}
      {datos && (
        datos.length === 0 ? (
          <p className="py-10 text-center text-zinc-500">Aún no hay categorías. Cree la primera.</p>
        ) : (
          <ul className="divide-y divide-zinc-200 rounded-xl border border-zinc-200 bg-white dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-900">
            {datos.map((c) => (
              <li key={c.id} className="p-4">
                {editando === c.id ? (
                  <form onSubmit={(e) => guardar(e, c)} className="grid gap-3 sm:grid-cols-[1fr_2fr_auto_auto] sm:items-end">
                    <Entrada etiqueta="Nombre" name="nombre" required maxLength={80} defaultValue={c.nombre} />
                    <Entrada etiqueta="Descripción" name="descripcion" maxLength={500} defaultValue={c.descripcion ?? ""} />
                    <button type="submit" className={claseBoton("primario")}>Guardar</button>
                    <button type="button" className={claseBoton("secundario")} onClick={() => setEditando(null)}>Cancelar</button>
                  </form>
                ) : (
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-zinc-900 dark:text-zinc-50">
                        {c.nombre}{" "}
                        <span className={`ml-2 rounded-full px-2 py-0.5 text-xs ${c.activa ? "bg-green-100 text-green-800" : "bg-zinc-200 text-zinc-700"}`}>{c.activa ? "Activa" : "Inactiva"}</span>
                      </p>
                      {c.descripcion && <p className="text-sm text-zinc-500">{c.descripcion}</p>}
                    </div>
                    <button type="button" className={claseBoton("secundario")} onClick={() => setEditando(c.id)}>Editar</button>
                    <button type="button" className={claseBoton("secundario")} onClick={() => ejecutar(() => cambiarDisponibilidadCategoria(c.id, !c.activa))}>
                      {c.activa ? "Desactivar" : "Activar"}
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )
      )}
    </Contenedor>
  );
}
