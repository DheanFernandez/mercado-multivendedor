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

export class Comerciante {
  private constructor(private readonly props: ComercianteProps) {}

  static crear(datos: { id: string; usuarioId: string; nombreComercial: string; creadoEn?: Date }): Comerciante {
    const nombreComercial = (datos.nombreComercial ?? '').trim();
    if (!nombreComercial) throw new ErrorDeValidacion('El nombre comercial es obligatorio.');
    if (nombreComercial.length > 150) throw new ErrorDeValidacion('El nombre comercial es demasiado largo.');
    return new Comerciante({ id: datos.id, usuarioId: datos.usuarioId, nombreComercial, estado: 'ACTIVO', creadoEn: datos.creadoEn ?? new Date() });
  }

  static reconstruir(props: ComercianteProps): Comerciante {
    return new Comerciante(props);
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
