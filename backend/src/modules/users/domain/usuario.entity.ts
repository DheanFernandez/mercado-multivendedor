import { Rol } from '../../../shared/domain/actor.js';
import { ErrorDeValidacion } from '../../../shared/domain/errors.js';

export type EstadoUsuario = 'ACTIVO' | 'INACTIVO';

export interface UsuarioProps {
  id: string;
  email: string;
  nombres: string;
  apellidos: string;
  telefono: string | null;
  rol: Rol;
  estado: EstadoUsuario;
  /** Identificador del usuario en Supabase Auth (claim `sub` del JWT). */
  authId: string | null;
  creadoEn: Date;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const TELEFONO = /^\+?[0-9 ()-]{6,20}$/;

export class Usuario {
  private constructor(private props: UsuarioProps) {}

  /** Crea un usuario nuevo validando las reglas del dominio. */
  static crear(datos: {
    id: string;
    email: string;
    nombres: string;
    apellidos: string;
    telefono?: string | null;
    rol: Rol;
    authId?: string | null;
    creadoEn?: Date;
  }): Usuario {
    const email = (datos.email ?? '').trim().toLowerCase();
    if (email.length > 254 || !EMAIL.test(email)) throw new ErrorDeValidacion('El correo electrónico no es válido.');
    const nombres = (datos.nombres ?? '').trim();
    const apellidos = (datos.apellidos ?? '').trim();
    if (!nombres || !apellidos) throw new ErrorDeValidacion('Los nombres y apellidos son obligatorios.');
    if (nombres.length > 100 || apellidos.length > 100) throw new ErrorDeValidacion('Nombres o apellidos demasiado largos.');
    const telefono = datos.telefono?.trim() || null;
    if (telefono && !TELEFONO.test(telefono)) throw new ErrorDeValidacion('El teléfono no es válido.');
    if (!Object.values(Rol).includes(datos.rol)) throw new ErrorDeValidacion('El rol no es válido.');
    return new Usuario({
      id: datos.id,
      email,
      nombres,
      apellidos,
      telefono,
      rol: datos.rol,
      estado: 'ACTIVO',
      authId: datos.authId ?? null,
      creadoEn: datos.creadoEn ?? new Date(),
    });
  }

  /** Reconstruye un usuario ya persistido (sin revalidar). */
  static reconstruir(props: UsuarioProps): Usuario {
    return new Usuario(props);
  }

  /** HU21 / RF05: el rol solo cambia a un valor conocido. */
  cambiarRol(rol: Rol): void {
    if (!(Object.values(Rol) as string[]).includes(rol)) throw new ErrorDeValidacion('El rol no es válido.');
    this.props = { ...this.props, rol };
  }

  /** HU21: una cuenta inactiva no puede acceder (lo comprueba la autenticación). */
  cambiarEstado(activo: unknown): void {
    if (typeof activo !== 'boolean') throw new ErrorDeValidacion('El estado debe ser verdadero o falso.');
    this.props = { ...this.props, estado: activo ? 'ACTIVO' : 'INACTIVO' };
  }

  get id() { return this.props.id; }
  get email() { return this.props.email; }
  get nombres() { return this.props.nombres; }
  get apellidos() { return this.props.apellidos; }
  get telefono() { return this.props.telefono; }
  get rol() { return this.props.rol; }
  get estado() { return this.props.estado; }
  get authId() { return this.props.authId; }
  get creadoEn() { return this.props.creadoEn; }
  get activo() { return this.props.estado === 'ACTIVO'; }

  toJSON(): UsuarioProps {
    return { ...this.props };
  }
}
