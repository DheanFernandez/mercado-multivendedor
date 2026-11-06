import { ErrorDeValidacion } from '../../../shared/domain/errors.js';
import { ImagenNoEncontradaError, LimiteImagenesError, TransicionProductoInvalidaError } from './errors.js';
import { Precio } from '../../../shared/domain/precio.js';

export const UnidadVenta = {
  UNIDAD: 'UNIDAD',
  KILOGRAMO: 'KILOGRAMO',
  GRAMO: 'GRAMO',
  LITRO: 'LITRO',
  DOCENA: 'DOCENA',
  MANOJO: 'MANOJO',
  PAQUETE: 'PAQUETE',
} as const;
export type UnidadVenta = (typeof UnidadVenta)[keyof typeof UnidadVenta];

export type EstadoPublicacion = 'BORRADOR' | 'PUBLICADO' | 'DESACTIVADO';
export const MAX_IMAGENES = 5;

export interface ImagenProducto {
  id: string;
  ruta: string;
  textoAlternativo: string | null;
  orden: number;
}

export interface ProductoProps {
  id: string;
  puestoId: string;
  categoriaId: string;
  nombre: string;
  descripcion: string | null;
  precio: Precio;
  unidadVenta: UnidadVenta;
  presentacion: string | null;
  estado: EstadoPublicacion;
  imagenes: ImagenProducto[];
  creadoEn: Date;
}

export interface DatosProducto {
  categoriaId: string;
  nombre: string;
  descripcion?: string | null;
  precio: unknown;
  unidadVenta: string;
  presentacion?: string | null;
}

const texto = (valor: unknown, campo: string, max: number, obligatorio = false): string | null => {
  if (valor == null || valor === '') {
    if (obligatorio) throw new ErrorDeValidacion(`${campo} es obligatorio.`);
    return null;
  }
  if (typeof valor !== 'string') throw new ErrorDeValidacion(`${campo} no es válido.`);
  const t = valor.trim().replace(/[ \t]+/g, ' ');
  if (!t) {
    if (obligatorio) throw new ErrorDeValidacion(`${campo} es obligatorio.`);
    return null;
  }
  if (t.length > max) throw new ErrorDeValidacion(`${campo} no puede superar ${max} caracteres.`);
  return t;
};

const unidad = (valor: unknown): UnidadVenta => {
  if (typeof valor !== 'string' || !(Object.values(UnidadVenta) as string[]).includes(valor)) {
    throw new ErrorDeValidacion(`La unidad de venta debe ser una de: ${Object.values(UnidadVenta).join(', ')}.`);
  }
  return valor as UnidadVenta;
};

export class Producto {
  private constructor(private props: ProductoProps) {}

  /** Todo producto nace como BORRADOR (no visible en el catálogo). */
  static crear(datos: DatosProducto & { id: string; puestoId: string; creadoEn?: Date }): Producto {
    return new Producto({
      id: datos.id,
      puestoId: datos.puestoId,
      categoriaId: datos.categoriaId,
      nombre: texto(datos.nombre, 'El nombre', 150, true)!,
      descripcion: texto(datos.descripcion, 'La descripción', 2000),
      precio: Precio.desde(datos.precio),
      unidadVenta: unidad(datos.unidadVenta),
      presentacion: texto(datos.presentacion, 'La presentación', 100),
      estado: 'BORRADOR',
      imagenes: [],
      creadoEn: datos.creadoEn ?? new Date(),
    });
  }

  static reconstruir(props: ProductoProps): Producto {
    return new Producto({ ...props, imagenes: [...props.imagenes] });
  }

  /** Actualiza solo los campos presentes. El puesto no puede cambiarse. */
  actualizar(c: Partial<DatosProducto>): void {
    const p = { ...this.props };
    if (c.nombre !== undefined) p.nombre = texto(c.nombre, 'El nombre', 150, true)!;
    if (c.descripcion !== undefined) p.descripcion = texto(c.descripcion, 'La descripción', 2000);
    if (c.precio !== undefined) p.precio = Precio.desde(c.precio);
    if (c.unidadVenta !== undefined) p.unidadVenta = unidad(c.unidadVenta);
    if (c.presentacion !== undefined) p.presentacion = texto(c.presentacion, 'La presentación', 100);
    if (c.categoriaId !== undefined) p.categoriaId = c.categoriaId;
    this.props = p;
  }

  publicar(): void {
    if (this.props.estado === 'PUBLICADO') throw new TransicionProductoInvalidaError('El producto ya está publicado.');
    this.props = { ...this.props, estado: 'PUBLICADO' };
  }

  desactivar(): void {
    if (this.props.estado === 'DESACTIVADO') throw new TransicionProductoInvalidaError('El producto ya está desactivado.');
    this.props = { ...this.props, estado: 'DESACTIVADO' };
  }

  agregarImagen(datos: { id: string; ruta: string; textoAlternativo?: string | null }): ImagenProducto {
    if (this.props.imagenes.length >= MAX_IMAGENES) throw new LimiteImagenesError(MAX_IMAGENES);
    const orden = this.props.imagenes.reduce((m, i) => Math.max(m, i.orden), -1) + 1;
    const imagen = { id: datos.id, ruta: datos.ruta, textoAlternativo: texto(datos.textoAlternativo, 'El texto alternativo', 200), orden };
    this.props = { ...this.props, imagenes: [...this.props.imagenes, imagen] };
    return imagen;
  }

  quitarImagen(imagenId: string): ImagenProducto {
    const imagen = this.props.imagenes.find((i) => i.id === imagenId);
    if (!imagen) throw new ImagenNoEncontradaError();
    this.props = { ...this.props, imagenes: this.props.imagenes.filter((i) => i.id !== imagenId) };
    return imagen;
  }

  /** Copia de los datos (persistencia/pruebas). */
  toProps(): ProductoProps { return { ...this.props, imagenes: [...this.props.imagenes] }; }

  get id() { return this.props.id; }
  get puestoId() { return this.props.puestoId; }
  get categoriaId() { return this.props.categoriaId; }
  get nombre() { return this.props.nombre; }
  get descripcion() { return this.props.descripcion; }
  get precio() { return this.props.precio; }
  get unidadVenta() { return this.props.unidadVenta; }
  get presentacion() { return this.props.presentacion; }
  get estado() { return this.props.estado; }
  get imagenes() { return [...this.props.imagenes]; }
  get creadoEn() { return this.props.creadoEn; }
}
