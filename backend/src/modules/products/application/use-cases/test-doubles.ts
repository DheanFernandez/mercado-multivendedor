/** Dobles de prueba en memoria (solo para pruebas). */
import type { AlmacenArchivos } from '../../../../shared/application/ports/almacen-archivos.port.js';
import { Categoria } from '../../domain/categoria.entity.js';
import { CategoriaDuplicadaError } from '../../domain/errors.js';
import { Producto } from '../../domain/producto.entity.js';
import type { CategoriaRepository, FiltroProductos, ProductoRepository, PuestoConsultaPort, PuestoParaProductos } from '../ports/ports.js';

export class CategoriasEnMemoria implements CategoriaRepository {
  readonly datos = new Map<string, Categoria>();
  async guardar(c: Categoria) {
    if ([...this.datos.values()].some((x) => x.slug === c.slug && x.id !== c.id)) throw new CategoriaDuplicadaError();
    this.datos.set(c.id, Categoria.reconstruir(c.toJSON())); // copia, como una base real
  }
  async buscarPorId(id: string) { const c = this.datos.get(id); return c ? Categoria.reconstruir(c.toJSON()) : null; }
  async listar({ soloActivas }: { soloActivas: boolean }) {
    return [...this.datos.values()].map((c) => Categoria.reconstruir(c.toJSON())).filter((c) => !soloActivas || c.activa).sort((a, b) => a.nombre.localeCompare(b.nombre));
  }
}

export class ProductosEnMemoria implements ProductoRepository {
  readonly datos = new Map<string, Producto>();
  guardados = 0;
  async guardar(p: Producto) { this.guardados++; this.datos.set(p.id, Producto.reconstruir(p.toProps())); }
  async buscarPorId(id: string) { const p = this.datos.get(id); return p ? Producto.reconstruir(p.toProps()) : null; }
  async listar(f: FiltroProductos) {
    const todos = [...this.datos.values()].filter(
      (p) => (!f.puestoId || p.puestoId === f.puestoId) && (!f.puestoIds || f.puestoIds.includes(p.puestoId)) && (!f.categoriaId || p.categoriaId === f.categoriaId) && (!f.estado || p.estado === f.estado),
    );
    return { items: todos.slice(f.desplazamiento, f.desplazamiento + f.limite), total: todos.length };
  }
}

/** Puestos: `titulares` asocia puestoId → usuario titular. */
export class PuestosFalsos implements PuestoConsultaPort {
  constructor(readonly puestos: Record<string, PuestoParaProductos> = {}) {}
  async obtener(id: string) { return this.puestos[id] ?? null; }
  async idsDeTitular(usuarioId: string) { return Object.values(this.puestos).filter((p) => p.usuarioIdTitular === usuarioId).map((p) => p.id); }
}

export class AlmacenEnMemoria implements AlmacenArchivos {
  readonly archivos = new Map<string, Buffer>();
  falla = false;
  async subir(ruta: string, contenido: Buffer) {
    if (this.falla) throw new Error('almacenamiento caído');
    this.archivos.set(ruta, contenido);
  }
  async eliminar(ruta: string) { this.archivos.delete(ruta); }
  urlPublica(ruta: string) { return `https://almacen.test/${ruta}`; }
}
