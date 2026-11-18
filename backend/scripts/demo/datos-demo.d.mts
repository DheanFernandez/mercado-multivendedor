export interface CategoriaDemo { id: string; nombre: string; slug: string; descripcion: string }
export interface PuestoDemo {
  id: string;
  codigo: string;
  nombre: string;
  comerciante: { id: string; nombreComercial: string };
  usuario: { id: string; email: string; nombres: string; apellidos: string };
}
export interface ProductoDemo {
  id: string;
  puestoId: string;
  categoriaId: string;
  nombre: string;
  precio: string;
  unidadVenta: string;
  presentacion: string | null;
  descripcion: string | null;
  stock: number;
  inventarioId: string;
  movimientoId: string;
  imagenId: string;
  archivoFoto: string;
  rutaFoto: string;
  actorId: string;
}
export const PREFIJO_ID: string;
export const DOMINIO_CORREO: string;
export const ID: Record<'categoria' | 'usuario' | 'comerciante' | 'puesto' | 'producto' | 'inventario' | 'movimiento' | 'imagen', (n: number) => string>;
export function generarSlug(nombre: string): string;
export const CATEGORIAS: CategoriaDemo[];
export const PUESTOS: PuestoDemo[];
export const CLIENTE_PRUEBA: { id: string; email: string; nombres: string; apellidos: string; authId: string };
export const PRODUCTOS: ProductoDemo[];
export const UNIDADES_VENTA: string[];
export const MOTIVO_INGRESO: string;
export const IDS: Record<'categorias' | 'usuarios' | 'comerciantes' | 'puestos' | 'productos', string[]>;
