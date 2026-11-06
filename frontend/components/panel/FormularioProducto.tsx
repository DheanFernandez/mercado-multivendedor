"use client";

import { type FormEvent, useState } from "react";
import { Aviso, Entrada, Seleccion, claseBoton, clasesCampo } from "@/components/comun";
import type { DatosProducto } from "@/lib/api";
import { UNIDADES, precioValido } from "@/lib/formato";
import { mensajeError } from "@/lib/hooks";
import type { Categoria, Producto, Puesto } from "@/lib/tipos";

interface Props {
  inicial?: Producto;
  puestos: Puesto[];
  categorias: Categoria[];
  soloLectura?: boolean;
  etiquetaBoton: string;
  alGuardar: (datos: DatosProducto) => Promise<void>;
}

/** Formulario de alta/edición. Las validaciones son de comodidad; el backend las vuelve a aplicar. */
export function FormularioProducto({ inicial, puestos, categorias, soloLectura, etiquetaBoton, alGuardar }: Props) {
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  async function enviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const d = new FormData(e.currentTarget);
    const precio = String(d.get("precio")).trim();
    const nombre = String(d.get("nombre")).trim();
    if (!nombre) return setError("El nombre es obligatorio.");
    if (!precioValido(precio)) return setError("Ingrese un precio mayor que cero con hasta 2 decimales (por ejemplo 3.50).");
    if (!d.get("categoriaId")) return setError("Seleccione una categoría.");
    setError(null);
    setGuardando(true);
    try {
      await alGuardar({
        puestoId: inicial ? undefined : String(d.get("puestoId")),
        categoriaId: String(d.get("categoriaId")),
        nombre,
        descripcion: String(d.get("descripcion")).trim(),
        precio,
        unidadVenta: String(d.get("unidadVenta")),
        presentacion: String(d.get("presentacion")).trim(),
      });
    } catch (err) {
      setError(mensajeError(err));
    } finally {
      setGuardando(false);
    }
  }

  const categoriasOpcion = categorias.filter((c) => c.activa || c.id === inicial?.categoriaId);

  return (
    <form onSubmit={enviar} noValidate className="grid gap-4 sm:grid-cols-2">
      {error && <div className="sm:col-span-2"><Aviso tipo="error">{error}</Aviso></div>}
      <fieldset disabled={soloLectura || guardando} className="contents">
        {!inicial && (
          <div className="sm:col-span-2">
            <Seleccion etiqueta="Puesto" name="puestoId" required defaultValue={puestos.length === 1 ? puestos[0].id : ""}>
              <option value="" disabled>Seleccione un puesto</option>
              {puestos.map((p) => (
                <option key={p.id} value={p.id}>{p.codigo} · {p.nombre}</option>
              ))}
            </Seleccion>
          </div>
        )}
        <div className="sm:col-span-2">
          <Entrada etiqueta="Nombre del producto" name="nombre" required maxLength={150} defaultValue={inicial?.nombre} />
        </div>
        <Seleccion etiqueta="Categoría" name="categoriaId" required defaultValue={inicial?.categoriaId ?? ""}>
          <option value="" disabled>Seleccione una categoría</option>
          {categoriasOpcion.map((c) => (
            <option key={c.id} value={c.id}>{c.nombre}{c.activa ? "" : " (inactiva)"}</option>
          ))}
        </Seleccion>
        <Entrada etiqueta="Precio (S/)" name="precio" required inputMode="decimal" placeholder="0.00" defaultValue={inicial?.precio} />
        <Seleccion etiqueta="Unidad de venta" name="unidadVenta" required defaultValue={inicial?.unidadVenta ?? "UNIDAD"}>
          {Object.entries(UNIDADES).map(([valor, u]) => (
            <option key={valor} value={valor}>{u.nombre}</option>
          ))}
        </Seleccion>
        <Entrada etiqueta="Presentación (opcional)" name="presentacion" maxLength={100} placeholder="Bolsa de 1 kg" defaultValue={inicial?.presentacion ?? ""} />
        <label className="block text-sm font-medium text-zinc-700 sm:col-span-2 dark:text-zinc-300">
          Descripción (opcional)
          <textarea name="descripcion" rows={4} maxLength={2000} defaultValue={inicial?.descripcion ?? ""} className={clasesCampo} />
        </label>
        {!soloLectura && (
          <div className="sm:col-span-2">
            <button type="submit" className={claseBoton("primario")} disabled={guardando}>
              {guardando ? "Guardando…" : etiquetaBoton}
            </button>
          </div>
        )}
      </fieldset>
    </form>
  );
}
