import { ErrorDeValidacion } from '../../../shared/domain/errors.js';

export type EstadoComerciante = 'ACTIVO' | 'SUSPENDIDO';
export type EstadoPuesto = 'ACTIVO' | 'INACTIVO';

export interface ComercianteProps {
  id: string;
  usuarioId: string;
  nombreComercial: string;
  estado: EstadoComerciante;
  creadoEn: Date;
}

function validarNombre(valor: unknown): string {
  const nombre = typeof valor === 'string' ? valor.trim() : '';
  if (!nombre) throw new ErrorDeValidacion('El nombre comercial es obligatorio.');
  if (nombre.length > 150) throw new ErrorDeValidacion('El nombre comercial es demasiado largo.');
  return nombre;
}

export class Comerciante {
  private constructor(private props: ComercianteProps) {}

  static crear(datos: { id: string; usuarioId: string; nombreComercial: string; creadoEn?: Date }): Comerciante {
    const nombreComercial = validarNombre(datos.nombreComercial);
    return new Comerciante({ id: datos.id, usuarioId: datos.usuarioId, nombreComercial, estado: 'ACTIVO', creadoEn: datos.creadoEn ?? new Date() });
  }

  static reconstruir(props: ComercianteProps): Comerciante {
    return new Comerciante(props);
  }

  renombrar(nombreComercial: unknown): void {
    this.props = { ...this.props, nombreComercial: validarNombre(nombreComercial) };
  }

  /** Suspender oculta sus productos del catálogo y bloquea nuevas publicaciones. */
  cambiarEstado(activo: unknown): void {
    if (typeof activo !== 'boolean') throw new ErrorDeValidacion('El estado debe ser verdadero o falso.');
    this.props = { ...this.props, estado: activo ? 'ACTIVO' : 'SUSPENDIDO' };
  }

  get id() { return this.props.id; }
  get usuarioId() { return this.props.usuarioId; }
  get nombreComercial() { return this.props.nombreComercial; }
  get estado() { return this.props.estado; }
  get activo() { return this.props.estado === 'ACTIVO'; }

  toJSON(): ComercianteProps {
    return { ...this.props };
  }
}
