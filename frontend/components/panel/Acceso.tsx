"use client";

import type { ReactNode } from "react";
import { Aviso, Cargando, Contenedor } from "@/components/comun";
import { useAcceso } from "@/lib/hooks";
import type { Perfil, Rol } from "@/lib/tipos";

/** Muestra el contenido solo si el rol (leído por el backend) está permitido. Es UX: el servidor autoriza cada operación. */
export function Acceso({ roles, titulo, children }: { roles: Rol[]; titulo: string; children: (perfil: Perfil) => ReactNode }) {
  const acceso = useAcceso(roles);
  if (acceso.estado === "cargando") return <Contenedor titulo={titulo}><Cargando /></Contenedor>;
  if (acceso.estado === "error") return <Contenedor titulo={titulo}><Aviso tipo="error">{acceso.mensaje}</Aviso></Contenedor>;
  if (acceso.estado === "denegado") {
    return (
      <Contenedor titulo="Acceso restringido">
        <Aviso tipo="error">Su rol ({acceso.perfil.rol}) no tiene acceso a esta sección.</Aviso>
      </Contenedor>
    );
  }
  return <>{children(acceso.perfil)}</>;
}
