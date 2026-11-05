/** Puerto hacia el proveedor de identidad (Supabase Auth). Las contraseñas solo pasan por aquí; nunca se almacenan. */
export interface ProveedorIdentidad {
  /** Crea la identidad con correo y contraseña (el proveedor envía el correo de confirmación).
   * @throws IdentidadYaExisteError | ErrorDeValidacion | ErrorServicioNoDisponible */
  registrar(email: string, contrasena: string): Promise<{ authId: string }>;
  /** Invita a un correo (el proveedor envía un enlace para que la persona defina su contraseña). Requiere credencial de servicio. */
  invitar(email: string): Promise<{ authId: string }>;
  /** Compensación: elimina una identidad creada cuando falla el guardado del perfil. */
  eliminar(authId: string): Promise<void>;
}

export const PROVEEDOR_IDENTIDAD = Symbol('PROVEEDOR_IDENTIDAD');
