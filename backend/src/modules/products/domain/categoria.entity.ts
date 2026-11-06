import { ErrorDeValidacion } from '../../../shared/domain/errors.js';

export interface CategoriaProps {
  id: string;
  nombre: string;
  slug: string;
  descripcion: string | null;
  activa: boolean;
  creadoEn: Date;
}

/** "Frutas y Verduras" → "frutas-y-verduras" (sin tildes, minúsculas, guiones). */
export function generarSlug(nombre: string): string {
  return nombre
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function validar(nombre: unknown, descripcion: unknown): { nombre: string; slug: string; descripcion: string | null } {
  const n = typeof nombre === 'string' ? nombre.trim().replace(/\s+/g, ' ') : '';
  if (!n) throw new ErrorDeValidacion('El nombre de la categoría es obligatorio.');
  if (n.length > 80) throw new ErrorDeValidacion('El nombre de la categoría no puede superar 80 caracteres.');
  const slug = generarSlug(n);
  if (!slug) throw new ErrorDeValidacion('El nombre de la categoría debe contener letras o números.');
  const d = typeof descripcion === 'string' ? descripcion.trim() : '';
  if (descripcion != null && typeof descripcion !== 'string') throw new ErrorDeValidacion('La descripción no es válida.');
  if (d.length > 500) throw new ErrorDeValidacion('La descripción no puede superar 500 caracteres.');
  return { nombre: n, slug, descripcion: d || null };
}

/** Categoría plana y global (sin jerarquías: los requisitos no las piden). */
export class Categoria {
  private constructor(private props: CategoriaProps) {}

  static crear(datos: { id: string; nombre: string; descripcion?: string | null; creadoEn?: Date }): Categoria {
    const v = validar(datos.nombre, datos.descripcion);
    return new Categoria({ id: datos.id, ...v, activa: true, creadoEn: datos.creadoEn ?? new Date() });
  }

  static reconstruir(props: CategoriaProps): Categoria {
    return new Categoria(props);
  }

  actualizar(cambios: { nombre?: string; descripcion?: string | null }): void {
    const v = validar(cambios.nombre ?? this.props.nombre, cambios.descripcion === undefined ? this.props.descripcion : cambios.descripcion);
    this.props = { ...this.props, ...v };
  }

  cambiarDisponibilidad(activa: boolean): void {
    if (typeof activa !== 'boolean') throw new ErrorDeValidacion('El estado de la categoría no es válido.');
    this.props = { ...this.props, activa };
  }

  get id() { return this.props.id; }
  get nombre() { return this.props.nombre; }
  get slug() { return this.props.slug; }
  get descripcion() { return this.props.descripcion; }
  get activa() { return this.props.activa; }

  toJSON(): CategoriaProps { return { ...this.props }; }
}
