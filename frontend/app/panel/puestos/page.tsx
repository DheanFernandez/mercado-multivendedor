"use client";

import Link from "next/link";
import { type FormEvent, useState } from "react";
import { Acceso } from "@/components/panel/Acceso";
import { Aviso, Cargando, Contenedor, Entrada, Paginacion, Seleccion, claseBoton, totalPaginasEstimado } from "@/components/comun";
import { actualizarPuesto, cambiarEstadoPuesto, listarComerciantes, listarPuestos, registrarPuesto } from "@/lib/api";
import { mensajeError, useCarga } from "@/lib/hooks";

const LIMITE = 10;
const CODIGO = /^[A-Z0-9][A-Z0-9-]{0,19}$/;

export default function PanelPuestos() {
  return (
    <Acceso roles={["ADMINISTRADOR"]} titulo="Puestos">
      {() => <Gestion />}
    </Acceso>
  );
}

function Gestion() {
  const [filtro, setFiltro] = useState("");
  const [pagina, setPagina] = useState(1);
  const [editando, setEditando] = useState<string | null>(null);
  const comerciantes = useCarga("comerciantes", () => listarComerciantes({ limite: 100 }));
  const puestos = useCarga(`puestos|${filtro}|${pagina}`, () => listarPuestos({ comercianteId: filtro || undefined, limite: LIMITE, desplazamiento: (pagina - 1) * LIMITE }));
  const [mensaje, setMensaje] = useState<{ tipo: "ok" | "error"; texto: string } | null>(null);
  const [ocupado, setOcupado] = useState(false);

  const nombres = new Map((comerciantes.datos ?? []).map((c) => [c.id, c.nombreComercial]));
  const activos = (comerciantes.datos ?? []).filter((c) => c.estado === "ACTIVO");

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
      puestos.recargar();
    }
  }

  async function registrar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formulario = e.currentTarget;
    const d = new FormData(formulario);
    const codigo = String(d.get("codigo")).trim().toUpperCase();
    if (!CODIGO.test(codigo)) return setMensaje({ tipo: "error", texto: "El código solo admite letras, números y guiones (máximo 20), por ejemplo A-12." });
    const ok = await operar(() => registrarPuesto({ comercianteId: String(d.get("comercianteId")), codigo, nombre: String(d.get("nombre")).trim() }), `Puesto ${codigo} registrado y asignado.`);
    if (ok) formulario.reset();
  }

  async function guardar(e: FormEvent<HTMLFormElement>, id: string) {
    e.preventDefault();
    const d = new FormData(e.currentTarget);
    const codigo = String(d.get("codigo")).trim().toUpperCase();
    if (!CODIGO.test(codigo)) return setMensaje({ tipo: "error", texto: "El código solo admite letras, números y guiones (máximo 20)." });
    await operar(() => actualizarPuesto(id, { codigo, nombre: String(d.get("nombre")).trim(), comercianteId: String(d.get("comercianteId")) }), "Puesto actualizado.");
  }

  const error = comerciantes.error ?? puestos.error;
  return (
    <Contenedor titulo="Puestos comerciales" acciones={<><Link href="/panel/comerciantes" className={claseBoton("secundario")}>Comerciantes</Link><Link href="/panel" className={claseBoton("secundario")}>← Administración</Link></>}>
      {error && <div className="mb-4"><Aviso tipo="error">{error}</Aviso></div>}
      {mensaje && <div className="mb-4"><Aviso tipo={mensaje.tipo}>{mensaje.texto}</Aviso></div>}

      <section className="mb-8 rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900" aria-labelledby="t-puesto">
        <h2 id="t-puesto" className="mb-4 text-lg font-medium text-zinc-900 dark:text-zinc-50">Registrar puesto y asignarlo a un comerciante</h2>
        {comerciantes.datos && activos.length === 0 ? (
          <Aviso tipo="info">Primero registre un comerciante activo en <Link href="/panel/comerciantes" className="underline">Comerciantes</Link>.</Aviso>
        ) : (
          <form onSubmit={registrar} noValidate className="grid gap-3 sm:grid-cols-[2fr_1fr_2fr_auto] sm:items-end">
            <fieldset disabled={ocupado} className="contents">
              <Seleccion etiqueta="Comerciante" name="comercianteId" required defaultValue="">
                <option value="" disabled>Seleccione un comerciante</option>
                {activos.map((c) => <option key={c.id} value={c.id}>{c.nombreComercial}</option>)}
              </Seleccion>
              <Entrada etiqueta="Código" name="codigo" required maxLength={20} placeholder="A-12" />
              <Entrada etiqueta="Nombre del puesto" name="nombre" required maxLength={150} />
              <button type="submit" className={claseBoton("primario")}>{ocupado ? "Guardando…" : "Registrar"}</button>
            </fieldset>
          </form>
        )}
      </section>

      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <h2 className="text-lg font-medium text-zinc-900 dark:text-zinc-50">Puestos registrados</h2>
        <div className="w-full max-w-xs">
          <Seleccion etiqueta="Filtrar por comerciante" value={filtro} onChange={(e) => { setFiltro(e.target.value); setPagina(1); }}>
            <option value="">Todos</option>
            {(comerciantes.datos ?? []).map((c) => <option key={c.id} value={c.id}>{c.nombreComercial}</option>)}
          </Seleccion>
        </div>
      </div>
      {puestos.cargando && <Cargando />}
      {puestos.datos && (
        <>
          <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-zinc-200 text-xs uppercase text-zinc-500 dark:border-zinc-800">
                <tr><th className="px-4 py-3">Código</th><th className="px-4 py-3">Nombre</th><th className="px-4 py-3">Comerciante</th><th className="px-4 py-3">Estado</th><th className="px-4 py-3">Acciones</th></tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {puestos.datos.map((p) =>
                  editando === p.id ? (
                    <tr key={p.id}>
                      <td colSpan={5} className="px-4 py-3">
                        <form onSubmit={(e) => guardar(e, p.id)} className="grid gap-3 sm:grid-cols-[1fr_2fr_2fr_auto_auto] sm:items-end">
                          <Entrada etiqueta="Código" name="codigo" defaultValue={p.codigo} required maxLength={20} />
                          <Entrada etiqueta="Nombre" name="nombre" defaultValue={p.nombre} required maxLength={150} />
                          <Seleccion etiqueta="Comerciante (reasignar)" name="comercianteId" defaultValue={p.comercianteId}>
                            {(comerciantes.datos ?? []).filter((c) => c.estado === "ACTIVO" || c.id === p.comercianteId).map((c) => <option key={c.id} value={c.id}>{c.nombreComercial}</option>)}
                          </Seleccion>
                          <button type="submit" className={claseBoton("primario")} disabled={ocupado}>Guardar</button>
                          <button type="button" className={claseBoton("secundario")} onClick={() => setEditando(null)}>Cancelar</button>
                        </form>
                      </td>
                    </tr>
                  ) : (
                    <tr key={p.id}>
                      <td className="px-4 py-3 font-medium text-zinc-900 dark:text-zinc-50">{p.codigo}</td>
                      <td className="px-4 py-3">{p.nombre}</td>
                      <td className="px-4 py-3">{nombres.get(p.comercianteId) ?? "—"}</td>
                      <td className="px-4 py-3">{p.estado === "ACTIVO" ? "Activo" : "Inactivo"}</td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          <button type="button" className={claseBoton("secundario")} disabled={ocupado} onClick={() => setEditando(p.id)}>Editar</button>
                          <button type="button" className={claseBoton("secundario")} disabled={ocupado} onClick={() => void operar(() => cambiarEstadoPuesto(p.id, p.estado !== "ACTIVO"), p.estado === "ACTIVO" ? "Puesto desactivado: sus productos salen del catálogo." : "Puesto reactivado.")}>
                            {p.estado === "ACTIVO" ? "Desactivar" : "Reactivar"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ),
                )}
                {puestos.datos.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-zinc-500">No hay puestos registrados.</td></tr>}
              </tbody>
            </table>
          </div>
          <Paginacion pagina={pagina} totalPaginas={totalPaginasEstimado(pagina, puestos.datos.length, LIMITE)} alCambiar={setPagina} />
        </>
      )}
    </Contenedor>
  );
}
