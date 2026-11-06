import type { Usuario } from '../../domain/usuario.entity.js';

export interface UsuarioRepository {
  /** Crea o actualiza (rol, estado y datos personales). @throws EmailYaRegistradoError si el correo o el authId ya existen. */
  guardar(usuario: Usuario): Promise<void>;
  buscarPorId(id: string): Promise<Usuario | null>;
  buscarPorEmail(email: string): Promise<Usuario | null>;
  buscarPorAuthId(authId: string): Promise<Usuario | null>;
  listar(opciones: { limite: number; desplazamiento: number }): Promise<Usuario[]>;
}

export const USUARIO_REPOSITORY = Symbol('USUARIO_REPOSITORY');
