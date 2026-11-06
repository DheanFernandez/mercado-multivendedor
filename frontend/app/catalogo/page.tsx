"use client";

import { type FormEvent, useState } from "react";
import { TarjetaProducto } from "@/components/catalogo/TarjetaProducto";
import { Aviso, Cargando, Contenedor, Entrada, Paginacion, Seleccion, claseBoton } from "@/components/comun";
import { type FiltroCatalogo, buscarCatalogo, listarCategorias, puestosPublicos } from "@/lib/api";
import { precioValido } from "@/lib/formato";
import { useCarga } from "@/lib/hooks";

const LIMITE = 12;

export default function Catalogo() {
  const [filtro, setFiltro] = useState<FiltroCatalogo>({ orden: "recientes", pagina: 1 });
  const [errorForm, setErrorForm] = useState<string | null>(null);

  const categorias = useCarga("categorias", listarCategorias);
  const puestos = useCarga("puestos", puestosPublicos);
  const productos = useCarga(JSON.stringify(filtro), () => buscarCatalogo({ ...filtro, limite: LIMITE }));

  function aplicar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const d = new FormData(e.currentTarget);
    const min = String(d.get("precioMin") ?? "").trim();
    const max = String(d.get("precioMax") ?? "").trim();
    if ((min && !precioValido(min)) || (max && !precioValido(max))) return setErrorForm("Ingrese precios válidos, con hasta 2 decimales.");
    if (min && max && Number(min) > Number(max)) return setErrorForm("El precio mínimo no puede superar al máximo.");
    setErrorForm(null);
    setFiltro((f) => ({
      ...f,
      q: String(d.get("q") ?? "").trim() || undefined,
      precioMin: min || undefined,
      precioMax: max || undefined,
      puestoId: String(d.get("puestoId") ?? "") || undefined,
      orden: String(d.get("orden")),
      pagina: 1,
    }));
  }

  const chip = (activo: boolean) =>
    `rounded-full border px-3 py-1 text-sm transition-colors ${
      activo ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900" : "border-zinc-300 text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
    }`;

  return (
    <Contenedor titulo="Catálogo de productos">
      <div className="mb-4 flex flex-wrap gap-2" role="group" aria-label="Categorías">
        <button type="button" className={chip(!filtro.categoriaId)} onClick={() => setFiltro((f) => ({ ...f, categoriaId: undefined, pagina: 1 }))}>
          Todas
        </button>
        {categorias.datos?.map((c) => (
          <button key={c.id} type="button" className={chip(filtro.categoriaId === c.id)} aria-pressed={filtro.categoriaId === c.id} onClick={() => setFiltro((f) => ({ ...f, categoriaId: c.id, pagina: 1 }))}>
            {c.nombre}
          </button>
        ))}
      </div>

      <form onSubmit={aplicar} noValidate className="mb-6 grid gap-3 rounded-xl border border-zinc-200 bg-white p-4 sm:grid-cols-2 lg:grid-cols-3 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="lg:col-span-3">
          <Entrada etiqueta="Buscar" name="q" type="search" placeholder="Papa, leche, tomate…" maxLength={100} defaultValue={filtro.q} />
        </div>
        <Entrada etiqueta="Precio mín. (S/)" name="precioMin" inputMode="decimal" placeholder="0.00" defaultValue={filtro.precioMin} />
        <Entrada etiqueta="Precio máx. (S/)" name="precioMax" inputMode="decimal" placeholder="0.00" defaultValue={filtro.precioMax} />
        <Seleccion etiqueta="Puesto" name="puestoId" defaultValue={filtro.puestoId ?? ""}>
          <option value="">Todos los puestos</option>
          {puestos.datos?.map((p) => (
            <option key={p.id} value={p.id}>{p.codigo} · {p.nombre}</option>
          ))}
        </Seleccion>
        <Seleccion etiqueta="Ordenar por" name="orden" defaultValue={filtro.orden}>
          <option value="recientes">Más recientes</option>
          <option value="precio_asc">Precio: menor a mayor</option>
          <option value="precio_desc">Precio: mayor a menor</option>
          <option value="nombre">Nombre (A–Z)</option>
        </Seleccion>
        <div className="flex items-end sm:col-span-2 lg:col-span-3">
          <button type="submit" className={claseBoton("primario")}>Aplicar filtros</button>
        </div>
        {errorForm && <div className="sm:col-span-2 lg:col-span-3"><Aviso tipo="error">{errorForm}</Aviso></div>}
      </form>

      {productos.error && <Aviso tipo="error">{productos.error}</Aviso>}
      {productos.cargando && <Cargando />}
      {productos.datos && (
        <>
          <p className="mb-3 text-sm text-zinc-500" aria-live="polite">
            {productos.datos.total} {productos.datos.total === 1 ? "producto" : "productos"}
          </p>
          {productos.datos.datos.length === 0 ? (
            <p className="py-16 text-center text-zinc-500">No hay productos que coincidan con su búsqueda.</p>
          ) : (
            <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {productos.datos.datos.map((p) => (
                <li key={p.id}>
                  <TarjetaProducto producto={p} />
                </li>
              ))}
            </ul>
          )}
          <Paginacion pagina={productos.datos.pagina} totalPaginas={productos.datos.totalPaginas} alCambiar={(pagina) => setFiltro((f) => ({ ...f, pagina }))} />
        </>
      )}
    </Contenedor>
  );
}
