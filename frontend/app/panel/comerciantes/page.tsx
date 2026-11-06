"use client";

import Link from "next/link";
import { type FormEvent, useState } from "react";
import { Acceso } from "@/components/panel/Acceso";
import { Aviso, Cargando, Contenedor, Entrada, Paginacion, Seleccion, claseBoton, totalPaginasEstimado } from "@/components/comun";
import { actualizarComerciante, cambiarEstadoComerciante, invitarUsuario, listarComerciantes, listarUsuarios, registrarComerciante } from "@/lib/api";
import { mensajeError, useCarga } from "@/lib/hooks";

const LIMITE = 10;

export default function PanelComerciantes() {
  return (
    <Acceso roles={["ADMINISTRADOR"]} titulo="Comerciantes">
      {() => <Gestion />}
    </Acceso>
  );
}

type Mensaje = { tipo: "ok" | "error"; texto: string } | null;

function Gestion() {
  const [pagina, setPagina] = useState(1);
  const [editando, setEditando] = useState<string | null>(null);
  // Búsquedas auxiliares (hasta 100 registros) para mostrar nombres y detectar usuarios sin perfil.
  const usuarios = useCarga("usuarios", () => listarUsuarios({ limite: 100 }));
  const todos = useCarga("comerciantes-todos", () => listarComerciantes({ limite: 100 }));
  // Tabla paginada en el servidor.
  const tabla = useCarga(`comerciantes|${pagina}`, () => listarComerciantes({ limite: LIMITE, desplazamiento: (pagina - 1) * LIMITE }));
  const [mensaje, setMensaje] = useState<Mensaje>(null);
  const [ocupado, setOcupado] = useState(false);

  const recargar = () => {
    usuarios.recargar();
    todos.recargar();
    tabla.recargar();
  };
  const error = usuarios.error ?? todos.error ?? tabla.error;
  const porId = new Map((usuarios.datos ?? []).map((u) => [u.id, u]));
  const conPerfil = new Set((todos.datos ?? []).map((c) => c.usuarioId));
  const sinPerfil = (usuarios.datos ?? []).filter((u) => u.rol === "COMERCIANTE" && !conPerfil.has(u.id));

  async function operar(accion: () => Promise<unknown>, ok: string) {
    setOcupado(true);
    setMensaje(null);
    try {
      await accion();
      setMensaje({ tipo: "ok", texto: ok });
      setEditando(null);
      return true;
    } catch (err) {
      setMensaje({ tipo: "error", texto: mensajeError(err) });
      return false;
    } finally {
      setOcupado(false);
      recargar();
    }
  }

  /** Invita al usuario (rol COMERCIANTE) y registra su perfil comercial. Requiere la clave de servicio de Supabase en el backend. */
  async function invitar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formulario = e.currentTarget;
    const d = new FormData(formulario);
    const nombreComercial = String(d.get("nombreComercial")).trim();
    if (!nombreComercial) return setMensaje({ tipo: "error", texto: "El nombre comercial es obligatorio." });
    setOcupado(true);
    setMensaje(null);
    let usuarioId: string | null = null;
    try {
      const usuario = await invitarUsuario({
        email: String(d.get("email")).trim(),
        nombres: String(d.get("nombres")).trim(),
        apellidos: String(d.get("apellidos")).trim(),
        telefono: String(d.get("telefono")).trim() || undefined,
        rol: "COMERCIANTE",
      });
      usuarioId = usuario.id;
      await registrarComerciante({ usuarioId, nombreComercial });
      formulario.reset();
      setMensaje({ tipo: "ok", texto: "Comerciante registrado. Recibirá una invitación por correo; para definir su contraseña debe usar «¿Olvidó su contraseña?»." });
    } catch (err) {
      setMensaje({
        tipo: "error",
        texto: usuarioId
          ? `Se invitó al usuario, pero no se pudo registrar su perfil comercial: ${mensajeError(err)} Complételo en «Usuarios comerciantes sin perfil».`
          : mensajeError(err),
      });
    } finally {
      setOcupado(false);
      recargar();
    }
  }

  async function registrarPerfil(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formulario = e.currentTarget;
    const d = new FormData(formulario);
    const ok = await operar(
      () => registrarComerciante({ usuarioId: String(d.get("usuarioId")), nombreComercial: String(d.get("nombreComercial")).trim() }),
      "Perfil de comerciante registrado. Ahora puede asignarle un puesto en «Puestos».",
    );
    if (ok) formulario.reset();
  }

  async function guardarNombre(e: FormEvent<HTMLFormElement>, id: string) {
    e.preventDefault();
    const nombre = String(new FormData(e.currentTarget).get("nombreComercial")).trim();
    await operar(() => actualizarComerciante(id, { nombreComercial: nombre }), "Nombre comercial actualizado.");
  }

  const tarjeta = "rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900";

  return (
    <Contenedor titulo="Comerciantes" acciones={<><Link href="/panel/puestos" className={claseBoton("secundario")}>Puestos</Link><Link href="/panel" className={claseBoton("secundario")}>← Administración</Link></>}>
      {error && <div className="mb-4"><Aviso tipo="error">{error}</Aviso></div>}
      {mensaje && <div className="mb-4"><Aviso tipo={mensaje.tipo}>{mensaje.texto}</Aviso></div>}

      <div className="mb-8 grid gap-6 lg:grid-cols-2">
        <section className={tarjeta} aria-labelledby="t-perfil">
          <h2 id="t-perfil" className="mb-1 text-lg font-medium text-zinc-900 dark:text-zinc-50">Usuarios comerciantes sin perfil</h2>
          <p className="mb-4 text-sm text-zinc-500">
            Registre el perfil comercial de un usuario con rol Comerciante. Para convertir una cuenta existente en comerciante, cambie su rol en <Link href="/panel/usuarios" className="underline">Usuarios</Link>.
          </p>
          {sinPerfil.length === 0 ? (
            <p className="text-sm text-zinc-500">No hay usuarios con rol Comerciante pendientes de perfil.</p>
          ) : (
            <form onSubmit={registrarPerfil} noValidate className="grid gap-3">
              <fieldset disabled={ocupado} className="contents">
                <Seleccion etiqueta="Usuario" name="usuarioId" required defaultValue="">
                  <option value="" disabled>Seleccione un usuario</option>
                  {sinPerfil.map((u) => <option key={u.id} value={u.id}>{u.nombres} {u.apellidos} · {u.email}</option>)}
                </Seleccion>
                <Entrada etiqueta="Nombre comercial" name="nombreComercial" required maxLength={150} />
                <div><button type="submit" className={claseBoton("primario")}>Registrar perfil</button></div>
              </fieldset>
            </form>
          )}
        </section>

        <section className={tarjeta} aria-labelledby="t-invitar">
          <h2 id="t-invitar" className="mb-1 text-lg font-medium text-zinc-900 dark:text-zinc-50">Invitar nuevo comerciante</h2>
          <p className="mb-4 text-sm text-zinc-500">Crea la cuenta, envía la invitación por correo y registra el perfil. Requiere la clave de servicio de Supabase configurada en el servidor.</p>
          <form onSubmit={invitar} noValidate className="grid gap-3 sm:grid-cols-2">
            <fieldset disabled={ocupado} className="contents">
              <Entrada etiqueta="Nombres" name="nombres" required maxLength={100} />
              <Entrada etiqueta="Apellidos" name="apellidos" required maxLength={100} />
              <div className="sm:col-span-2"><Entrada etiqueta="Correo electrónico" name="email" type="email" required /></div>
              <Entrada etiqueta="Teléfono (opcional)" name="telefono" type="tel" />
              <Entrada etiqueta="Nombre comercial" name="nombreComercial" required maxLength={150} />
              <div className="sm:col-span-2"><button type="submit" className={claseBoton("primario")}>{ocupado ? "Procesando…" : "Invitar y registrar"}</button></div>
            </fieldset>
          </form>
        </section>
      </div>

      <h2 className="mb-3 text-lg font-medium text-zinc-900 dark:text-zinc-50">Comerciantes registrados</h2>
      {tabla.cargando && <Cargando />}
      {tabla.datos && (
        <>
          <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-zinc-200 text-xs uppercase text-zinc-500 dark:border-zinc-800">
                <tr><th className="px-4 py-3">Nombre comercial</th><th className="px-4 py-3">Titular</th><th className="px-4 py-3">Correo</th><th className="px-4 py-3">Estado</th><th className="px-4 py-3">Acciones</th></tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {tabla.datos.map((c) => {
                  const u = porId.get(c.usuarioId);
                  return (
                    <tr key={c.id}>
                      <td className="px-4 py-3 font-medium text-zinc-900 dark:text-zinc-50">
                        {editando === c.id ? (
                          <form onSubmit={(e) => guardarNombre(e, c.id)} className="flex gap-2">
                            <input name="nombreComercial" defaultValue={c.nombreComercial} required maxLength={150} aria-label="Nombre comercial" className="w-full rounded-md border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-800" />
                            <button type="submit" className={claseBoton("primario")} disabled={ocupado}>Guardar</button>
                            <button type="button" className={claseBoton("secundario")} onClick={() => setEditando(null)}>Cancelar</button>
                          </form>
                        ) : c.nombreComercial}
                      </td>
                      <td className="px-4 py-3">{u ? `${u.nombres} ${u.apellidos}` : "—"}</td>
                      <td className="px-4 py-3 text-zinc-600 dark:text-zinc-300">{u?.email ?? "—"}</td>
                      <td className="px-4 py-3">{c.estado === "ACTIVO" ? "Activo" : "Suspendido"}</td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          <button type="button" className={claseBoton("secundario")} disabled={ocupado} onClick={() => setEditando(c.id)}>Editar</button>
                          <button type="button" className={claseBoton("secundario")} disabled={ocupado} onClick={() => void operar(() => cambiarEstadoComerciante(c.id, c.estado !== "ACTIVO"), c.estado === "ACTIVO" ? "Comerciante suspendido: sus productos salen del catálogo." : "Comerciante reactivado.")}>
                            {c.estado === "ACTIVO" ? "Suspender" : "Reactivar"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {tabla.datos.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-zinc-500">Aún no hay comerciantes registrados.</td></tr>}
              </tbody>
            </table>
          </div>
          <Paginacion pagina={pagina} totalPaginas={totalPaginasEstimado(pagina, tabla.datos.length, LIMITE)} alCambiar={setPagina} />
        </>
      )}
    </Contenedor>
  );
}
