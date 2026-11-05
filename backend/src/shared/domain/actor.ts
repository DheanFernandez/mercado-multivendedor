export const Rol = {
  CLIENTE: 'CLIENTE',
  COMERCIANTE: 'COMERCIANTE',
  TRABAJADOR_PUESTO: 'TRABAJADOR_PUESTO',
  ADMINISTRADOR: 'ADMINISTRADOR',
} as const;
export type Rol = (typeof Rol)[keyof typeof Rol];

/** Usuario autenticado que ejecuta un caso de uso (lo resuelve la capa de entrada). */
export interface Actor {
  readonly id: string;
  readonly rol: Rol;
}

export const esAdministrador = (actor?: Actor): boolean => actor?.rol === Rol.ADMINISTRADOR;
