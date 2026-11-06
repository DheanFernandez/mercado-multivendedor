"use client";

import Link from "next/link";
import { Acceso } from "@/components/panel/Acceso";
import { Contenedor } from "@/components/comun";
import type { Rol } from "@/lib/tipos";

const ROLES: Rol[] = ["COMERCIANTE", "ADMINISTRADOR"];

const SECCIONES_ADMIN = [
  { href: "/panel/usuarios", titulo: "Usuarios", texto: "Consulte las cuentas registradas y sus roles." },
  { href: "/panel/comerciantes", titulo: "Comerciantes", texto: "Invite comerciantes y registre su perfil comercial." },
  { href: "/panel/puestos", titulo: "Puestos", texto: "Registre puestos y asígnelos a sus comerciantes." },
  { href: "/panel/categorias", titulo: "Categorías", texto: "Cree y administre las categorías de productos." },
  { href: "/panel/productos", titulo: "Productos", texto: "Supervise los productos de todos los puestos (solo lectura)." },
];

export default function PanelInicio() {
  return (
    <Acceso roles={ROLES} titulo="Panel">
      {(perfil) => {
        const admin = perfil.rol === "ADMINISTRADOR";
        const secciones = admin ? SECCIONES_ADMIN : [{ href: "/panel/productos", titulo: "Mis productos", texto: "Registre, edite y publique los productos de sus puestos." }];
        return (
          <Contenedor titulo={admin ? "Administración" : "Panel del comerciante"}>
            <p className="mb-6 text-sm text-zinc-600 dark:text-zinc-400">
              Sesión iniciada como {perfil.nombres} {perfil.apellidos} ({perfil.rol}).
            </p>
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {secciones.map((s) => (
                <li key={s.href}>
                  <Link href={s.href} className="block h-full rounded-xl border border-zinc-200 bg-white p-5 shadow-sm transition hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900">
                    <h2 className="font-medium text-zinc-900 dark:text-zinc-50">{s.titulo}</h2>
                    <p className="mt-1 text-sm text-zinc-500">{s.texto}</p>
                  </Link>
                </li>
              ))}
            </ul>
          </Contenedor>
        );
      }}
    </Acceso>
  );
}
