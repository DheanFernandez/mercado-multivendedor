"use client";

import Link from "next/link";
import { useState } from "react";
import { Acceso } from "@/components/panel/Acceso";
import { Aviso, Cargando, Contenedor, Paginacion, Seleccion, claseBoton, totalPaginasEstimado } from "@/components/comun";
import { cambiarEstadoUsuario, cambiarRolUsuario, listarUsuarios } from "@/lib/api";
import { mensajeError, useCarga } from "@/lib/hooks";
import type { Rol } from "@/lib/tipos";

const LIMITE = 20;
const ROLES: { valor: Rol; nombre: string }[] = [
  { valor: "CLIENTE", nombre: "Cliente" },
  { valor: "COMERCIANTE", nombre: "Comerciante" },
  { valor: "TRABAJADOR_PUESTO", nombre: "Trabajador de puesto" },
  { valor: "ADMINISTRADOR", nombre: "Administrador" },
];

export default function PanelUsuarios() {
  return (
    <Acceso roles={["ADMINISTRADOR"]} titulo="Usuarios">
      {(perfil) => <Lista miId={perfil.id} />}
    </Acceso>
  );
}

function Lista({ miId }: { miId: string }) {
  const [pagina, setPagina] = useState(1);
  const [rol, setRol] = useState("");
  const [aviso, setAviso] = useState<{ tipo: "ok" | "error"; texto: string } | null>(null);
  const [pendiente, setPendiente] = useState<string | null>(null);
  const { datos, error, cargando, recargar } = useCarga(`u|${pagina}`, () => listarUsuarios({ limite: LIMITE, desplazamiento: (pagina - 1) * LIMITE }));
  const visibles = datos?.filter((u) => !rol || u.rol === rol);

  async function ejecutar(id: string, accion: () => Promise<unknown>, ok: string) {
    setPendiente(id);
    setAviso(null);
    try {
      await accion();
      setAviso({ tipo: "ok", texto: ok });
      recargar();
    } catch (e) {
      setAviso({ tipo: "error", texto: mensajeError(e) });
    } finally {
      setPendiente(null);
    }
  }

  return (
    <Contenedor titulo="Usuarios registrados" acciones={<Link href="/panel" className={claseBoton("secundario")}>← Administración</Link>}>
      <div className="mb-4 max-w-xs">
        <Seleccion etiqueta="Filtrar por rol (en esta página)" value={rol} onChange={(e) => setRol(e.target.value)}>
          <option value="">Todos</option>
          {ROLES.map((r) => <option key={r.valor} value={r.valor}>{r.nombre}</option>)}
        </Seleccion>
      </div>
      {(error || aviso) && <div className="mb-4"><Aviso tipo={aviso?.tipo ?? "error"}>{aviso?.texto ?? error}</Aviso></div>}
      {cargando && <Cargando />}
      {visibles && (
        <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-zinc-200 text-xs uppercase text-zinc-500 dark:border-zinc-800">
              <tr>
                <th className="px-4 py-3">Nombre</th><th className="px-4 py-3">Correo</th><th className="px-4 py-3">Rol</th>
                <th className="px-4 py-3">Estado</th><th className="px-4 py-3">Alta</th><th className="px-4 py-3">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {visibles.map((u) => {
                const propio = u.id === miId;
                const ocupado = pendiente === u.id;
                return (
                  <tr key={u.id}>
                    <td className="px-4 py-3 font-medium text-zinc-900 dark:text-zinc-50">{u.nombres} {u.apellidos}{propio && <span className="ml-2 text-xs text-zinc-500">(usted)</span>}</td>
                    <td className="px-4 py-3 text-zinc-600 dark:text-zinc-300">{u.email}</td>
                    <td className="px-4 py-3">
                      <label className="sr-only" htmlFor={`rol-${u.id}`}>Rol de {u.email}</label>
                      <select
                        id={`rol-${u.id}`}
                        value={u.rol}
                        disabled={propio || ocupado}
                        onChange={(e) => {
                          const nuevo = e.target.value as Rol;
                          if (window.confirm(`¿Cambiar el rol de ${u.email} a ${nuevo}?`)) void ejecutar(u.id, () => cambiarRolUsuario(u.id, nuevo), `Rol actualizado a ${nuevo}.`);
                          else e.target.value = u.rol;
                        }}
                        className="rounded-md border border-zinc-300 bg-white px-2 py-1 text-sm disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-800"
                      >
                        {ROLES.map((r) => <option key={r.valor} value={r.valor}>{r.nombre}</option>)}
                      </select>
                    </td>
                    <td className="px-4 py-3">{u.estado === "ACTIVO" ? "Activo" : "Inactivo"}</td>
                    <td className="px-4 py-3 text-zinc-500">{u.creadoEn?.slice(0, 10) ?? "—"}</td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        disabled={propio || ocupado}
                        className={claseBoton("secundario")}
                        onClick={() => void ejecutar(u.id, () => cambiarEstadoUsuario(u.id, u.estado !== "ACTIVO"), u.estado === "ACTIVO" ? "Usuario desactivado." : "Usuario reactivado.")}
                      >
                        {u.estado === "ACTIVO" ? "Desactivar" : "Reactivar"}
                      </button>
                    </td>
                  </tr>
                );
              })}
              {visibles.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-zinc-500">No hay usuarios para mostrar.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
      {datos && <Paginacion pagina={pagina} totalPaginas={totalPaginasEstimado(pagina, datos.length, LIMITE)} alCambiar={setPagina} />}
      <p className="mt-4 text-xs text-zinc-500">
        El rol y el estado se guardan en la base de datos; el servidor los consulta en cada petición. No puede modificar su propia cuenta ni dejar a la plataforma sin administradores.
        Para dar de alta a un comerciante use <Link href="/panel/comerciantes" className="underline">Comerciantes</Link>.
      </p>
    </Contenedor>
  );
}
