"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Acceso } from "@/components/panel/Acceso";
import { FormularioProducto } from "@/components/panel/FormularioProducto";
import { Aviso, Cargando, Contenedor, claseBoton } from "@/components/comun";
import { crearProducto, listarCategorias, misPuestos } from "@/lib/api";
import { useCarga } from "@/lib/hooks";

export default function NuevoProducto() {
  return (
    <Acceso roles={["COMERCIANTE"]} titulo="Nuevo producto">
      {() => <Formulario />}
    </Acceso>
  );
}

function Formulario() {
  const router = useRouter();
  const puestos = useCarga("puestos", misPuestos);
  const categorias = useCarga("categorias", listarCategorias);
  const error = puestos.error ?? categorias.error;

  return (
    <Contenedor titulo="Nuevo producto" acciones={<Link href="/panel/productos" className={claseBoton("secundario")}>← Mis productos</Link>}>
      {error && <Aviso tipo="error">{error}</Aviso>}
      {(puestos.cargando || categorias.cargando) && <Cargando />}
      {puestos.datos && categorias.datos && (
        puestos.datos.length === 0 ? (
          <Aviso tipo="info">Todavía no tiene puestos asignados. Solicite a un administrador que registre su puesto.</Aviso>
        ) : categorias.datos.length === 0 ? (
          <Aviso tipo="info">Aún no hay categorías disponibles. Un administrador debe crearlas primero.</Aviso>
        ) : (
          <div className="max-w-3xl rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
            <FormularioProducto
              puestos={puestos.datos}
              categorias={categorias.datos}
              etiquetaBoton="Crear producto"
              alGuardar={async (d) => {
                const p = await crearProducto(d);
                router.push(`/panel/productos/${p.id}`); // allí se agregan las imágenes y se publica
              }}
            />
          </div>
        )
      )}
    </Contenedor>
  );
}
