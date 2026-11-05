"use client";

import { type FormEvent, useState } from "react";
import { Boton, Campo, Enlace, Mensaje, Pagina } from "@/components/auth/ui";
import { ErrorApi, registrarCliente } from "@/lib/api";

export default function Registro() {
  const [error, setError] = useState<string | null>(null);
  const [listo, setListo] = useState(false);
  const [cargando, setCargando] = useState(false);

  async function enviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const d = new FormData(e.currentTarget);
    const contrasena = String(d.get("contrasena"));
    if (contrasena.length < 8) return setError("La contraseña debe tener al menos 8 caracteres.");
    if (contrasena !== String(d.get("confirmar"))) return setError("Las contraseñas no coinciden.");
    setCargando(true);
    setError(null);
    try {
      await registrarCliente({
        email: String(d.get("email")).trim(),
        contrasena,
        nombres: String(d.get("nombres")).trim(),
        apellidos: String(d.get("apellidos")).trim(),
        telefono: String(d.get("telefono")).trim() || undefined,
      });
      setListo(true);
    } catch (err) {
      setError(err instanceof ErrorApi ? err.message : "No se pudo completar el registro.");
    } finally {
      setCargando(false);
    }
  }

  if (listo) {
    return (
      <Pagina titulo="Revise su correo" pie={<Enlace href="/login">Ir a iniciar sesión</Enlace>}>
        <Mensaje tipo="ok">
          Le enviamos un enlace para confirmar su correo electrónico. Cuando lo confirme podrá iniciar sesión.
        </Mensaje>
      </Pagina>
    );
  }

  return (
    <Pagina titulo="Crear cuenta" pie={<p>¿Ya tiene cuenta? <Enlace href="/login">Inicie sesión</Enlace></p>}>
      <form onSubmit={enviar} noValidate>
        {error && <Mensaje tipo="error">{error}</Mensaje>}
        <Campo etiqueta="Nombres" name="nombres" autoComplete="given-name" required maxLength={100} />
        <Campo etiqueta="Apellidos" name="apellidos" autoComplete="family-name" required maxLength={100} />
        <Campo etiqueta="Teléfono (opcional)" name="telefono" type="tel" autoComplete="tel" />
        <Campo etiqueta="Correo electrónico" name="email" type="email" autoComplete="email" required />
        <Campo etiqueta="Contraseña (mínimo 8 caracteres)" name="contrasena" type="password" autoComplete="new-password" required minLength={8} maxLength={72} />
        <Campo etiqueta="Confirmar contraseña" name="confirmar" type="password" autoComplete="new-password" required />
        <Boton type="submit" cargando={cargando}>Registrarme</Boton>
      </form>
    </Pagina>
  );
}
