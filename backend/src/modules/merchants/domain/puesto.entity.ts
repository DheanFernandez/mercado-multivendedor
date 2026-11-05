import { ErrorDeValidacion } from '../../../shared/domain/errors.js';
import type { EstadoPuesto } from './comerciante.entity.js';

export interface PuestoProps {
  id: string;
  comercianteId: string;
  codigo: string;
  nombre: string;
  estado: EstadoPuesto;
  creadoEn: Date;
}

const CODIGO = /^[A-Z0-9][A-Z0-9-]{0,19}$/;

export class Puesto {
  private constructor(private readonly props: PuestoProps) {}

  static crear(datos: { id: string; comercianteId: string; codigo: string; nombre: string; creadoEn?: Date }): Puesto {
    const codigo = (datos.codigo ?? '').trim().toUpperCase();
    if (!CODIGO.test(codigo)) throw new ErrorDeValidacion('El código del puesto no es válido (letras, números y guiones, máximo 20).');
    const nombre = (datos.nombre ?? '').trim();
    if (!nombre) throw new ErrorDeValidacion('El nombre del puesto es obligatorio.');
    if (nombre.length > 150) throw new ErrorDeValidacion('El nombre del puesto es demasiado largo.');
    return new Puesto({ id: datos.id, comercianteId: datos.comercianteId, codigo, nombre, estado: 'ACTIVO', creadoEn: datos.creadoEn ?? new Date() });
  }

  static reconstruir(props: PuestoProps): Puesto {
    return new Puesto(props);
  }

  get id() { return this.props.id; }
  get comercianteId() { return this.props.comercianteId; }
  get codigo() { return this.props.codigo; }
  get nombre() { return this.props.nombre; }
  get estado() { return this.props.estado; }

  toJSON(): PuestoProps {
    return { ...this.props };
  }
}
