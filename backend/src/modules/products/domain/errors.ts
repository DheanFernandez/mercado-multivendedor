import { ErrorDeConflicto, ErrorNoEncontrado } from '../../../shared/domain/errors.js';

export class CategoriaNoEncontradaError extends ErrorNoEncontrado {
  constructor() { super('Categoría no encontrada.'); }
}
export class CategoriaDuplicadaError extends ErrorDeConflicto {
  constructor() { super('Ya existe una categoría con ese nombre.'); }
}
export class CategoriaInactivaError extends ErrorDeConflicto {
  constructor() { super('La categoría no está activa.'); }
}
export class ProductoNoEncontradoError extends ErrorNoEncontrado {
  constructor() { super('Producto no encontrado.'); }
}
export class PuestoNoEncontradoError extends ErrorNoEncontrado {
  constructor() { super('Puesto no encontrado.'); }
}
export class PuestoNoOperativoError extends ErrorDeConflicto {
  constructor() { super('El puesto o su comerciante no están activos.'); }
}
export class TransicionProductoInvalidaError extends ErrorDeConflicto {
  constructor(mensaje: string) { super(mensaje); }
}
export class LimiteImagenesError extends ErrorDeConflicto {
  constructor(max: number) { super(`Un producto admite como máximo ${max} imágenes.`); }
}
export class ImagenNoEncontradaError extends ErrorNoEncontrado {
  constructor() { super('Imagen no encontrada.'); }
}
