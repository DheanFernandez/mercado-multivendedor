import { randomUUID } from 'node:crypto';
import { Rol } from '../../../../shared/domain/actor.js';
import { ErrorDeValidacion } from '../../../../shared/domain/errors.js';
import { EmailYaRegistradoError } from '../../domain/errors.js';
import { Usuario } from '../../domain/usuario.entity.js';
import type { ProveedorIdentidad } from '../ports/proveedor-identidad.port.js';
import type { UsuarioRepository } from '../ports/usuario.repository.js';

export interface RegistrarClienteComando {
  email: string;
  contrasena: string;
  nombres: string;
  apellidos: string;
  telefono?: string | null;
}

export const CONTRASENA_MIN = 8;
export const CONTRASENA_MAX = 72;

/**
 * RF01. Autorregistro público: el rol es SIEMPRE CLIENTE, sin importar lo que envíe el cliente HTTP.
 * Crea la identidad en Supabase Auth y vincula su id con usuarios.authId.
 */
export class RegistrarCliente {
  constructor(
    private readonly usuarios: UsuarioRepository,
    private readonly identidad: ProveedorIdentidad,
  ) {}

  async ejecutar(comando: RegistrarClienteComando): Promise<Usuario> {
    const { contrasena } = comando;
    if (typeof contrasena !== 'string' || contrasena.length < CONTRASENA_MIN || contrasena.length > CONTRASENA_MAX) {
      throw new ErrorDeValidacion(`La contraseña debe tener entre ${CONTRASENA_MIN} y ${CONTRASENA_MAX} caracteres.`);
    }
    const id = randomUUID();
    // Valida los datos antes de crear la identidad externa.
    const borrador = Usuario.crear({ id, email: comando.email, nombres: comando.nombres, apellidos: comando.apellidos, telefono: comando.telefono, rol: Rol.CLIENTE });
    if (await this.usuarios.buscarPorEmail(borrador.email)) throw new EmailYaRegistradoError();

    const { authId } = await this.identidad.registrar(borrador.email, contrasena);
    const usuario = Usuario.crear({ id, email: borrador.email, nombres: borrador.nombres, apellidos: borrador.apellidos, telefono: borrador.telefono, rol: Rol.CLIENTE, authId });
    try {
      await this.usuarios.guardar(usuario);
    } catch (error) {
      await this.identidad.eliminar(authId).catch(() => undefined); // mejor esfuerzo
      throw error;
    }
    return usuario;
  }
}
