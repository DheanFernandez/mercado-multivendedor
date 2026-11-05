import { randomUUID } from 'node:crypto';
import { Rol, esAdministrador, type Actor } from '../../../../shared/domain/actor.js';
import { ErrorProhibido } from '../../../../shared/domain/errors.js';
import { Usuario } from '../../domain/usuario.entity.js';
import { EmailYaRegistradoError } from '../../domain/errors.js';
import type { ProveedorIdentidad } from '../ports/proveedor-identidad.port.js';
import type { UsuarioRepository } from '../ports/usuario.repository.js';

export interface RegistrarUsuarioComando {
  email: string;
  nombres: string;
  apellidos: string;
  telefono?: string | null;
  rol?: Rol;
}

/**
 * HU21. Solo el administrador crea usuarios con cualquier rol (el autorregistro es RegistrarCliente).
 * La persona recibe una invitación de Supabase Auth para definir su contraseña y queda vinculada por authId.
 */
export class RegistrarUsuario {
  constructor(
    private readonly usuarios: UsuarioRepository,
    private readonly identidad: ProveedorIdentidad,
  ) {}

  async ejecutar(comando: RegistrarUsuarioComando, actor: Actor): Promise<Usuario> {
    if (!esAdministrador(actor)) throw new ErrorProhibido('Solo un administrador puede registrar usuarios.');
    const id = randomUUID();
    const rol = comando.rol ?? Rol.CLIENTE;
    const borrador = Usuario.crear({ id, ...comando, rol });
    if (await this.usuarios.buscarPorEmail(borrador.email)) throw new EmailYaRegistradoError();

    const { authId } = await this.identidad.invitar(borrador.email);
    const usuario = Usuario.crear({ id, email: borrador.email, nombres: borrador.nombres, apellidos: borrador.apellidos, telefono: borrador.telefono, rol, authId });
    try {
      await this.usuarios.guardar(usuario);
    } catch (error) {
      await this.identidad.eliminar(authId).catch(() => undefined); // mejor esfuerzo
      throw error;
    }
    return usuario;
  }
}
