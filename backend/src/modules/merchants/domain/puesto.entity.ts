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

function validarCodigo(valor: unknown): string {
  const codigo = typeof valor === 'string' ? valor.trim().toUpperCase() : '';
  if (!CODIGO.test(codigo)) throw new ErrorDeValidacion('El código del puesto no es válido (letras, números y guiones, máximo 20).');
  return codigo;
}

function validarNombre(valor: unknown): string {
  const nombre = typeof valor === 'string' ? valor.trim() : '';
  if (!nombre) throw new ErrorDeValidacion('El nombre del puesto es obligatorio.');
  if (nombre.length > 150) throw new ErrorDeValidacion('El nombre del puesto es demasiado largo.');
  return nombre;
}

export class Puesto {
  private constructor(private props: PuestoProps) {}

  static crear(datos: { id: string; comercianteId: string; codigo: string; nombre: string; creadoEn?: Date }): Puesto {
    const codigo = validarCodigo(datos.codigo);
    const nombre = validarNombre(datos.nombre);
    return new Puesto({ id: datos.id, comercianteId: datos.comercianteId, codigo, nombre, estado: 'ACTIVO', creadoEn: datos.creadoEn ?? new Date() });
  }

  static reconstruir(props: PuestoProps): Puesto {
    return new Puesto(props);
  }

  /** Solo cambian los campos presentes; un valor inválido no modifica nada. */
  actualizar(cambios: { codigo?: unknown; nombre?: unknown; comercianteId?: string }): void {
    const nuevo = { ...this.props };
    if (cambios.codigo !== undefined) nuevo.codigo = validarCodigo(cambios.codigo);
    if (cambios.nombre !== undefined) nuevo.nombre = validarNombre(cambios.nombre);
    if (cambios.comercianteId !== undefined) nuevo.comercianteId = cambios.comercianteId;
    this.props = nuevo;
  }

  /** Un puesto inactivo no publica ni muestra productos en el catálogo. */
  cambiarEstado(activo: unknown): void {
    if (typeof activo !== 'boolean') throw new ErrorDeValidacion('El estado debe ser verdadero o falso.');
    this.props = { ...this.props, estado: activo ? 'ACTIVO' : 'INACTIVO' };
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
