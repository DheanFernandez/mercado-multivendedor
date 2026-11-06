import { randomUUID } from 'node:crypto';
import { Rol, esAdministrador, type Actor } from '../../../../shared/domain/actor.js';
import { ErrorDeValidacion, ErrorProhibido } from '../../../../shared/domain/errors.js';
import type { AlmacenArchivos } from '../../../../shared/application/ports/almacen-archivos.port.js';
import {
  CategoriaInactivaError,
  CategoriaNoEncontradaError,
  ProductoNoEncontradoError,
  PuestoNoEncontradoError,
  PuestoNoOperativoError,
} from '../../domain/errors.js';
import { type DatosProducto, type EstadoPublicacion, Producto } from '../../domain/producto.entity.js';
import { esUuid } from '../../../../shared/application/paginacion.js';
import { paginar, type Pagina } from '../../../../shared/application/paginacion.js';
import type { CategoriaRepository, ProductoRepository, PuestoConsultaPort, PuestoParaProductos } from '../ports/ports.js';

/** Autorización por rol y por propiedad: solo el COMERCIANTE titular del puesto escribe. Admin y clientes: no. */
function exigirTitular(actor: Actor, puesto: PuestoParaProductos): void {
  if (actor.rol !== Rol.COMERCIANTE || puesto.usuarioIdTitular !== actor.id) {
    throw new ErrorProhibido('Solo el comerciante titular del puesto puede administrar sus productos.');
  }
}

function exigirRolComerciante(actor: Actor): void {
  if (actor.rol !== Rol.COMERCIANTE) throw new ErrorProhibido('Solo un comerciante puede administrar productos.');
}

/** Carga el producto y su puesto; verifica que el actor sea el titular. */
async function cargarPropio(id: string, actor: Actor, productos: ProductoRepository, puestos: PuestoConsultaPort) {
  exigirRolComerciante(actor);
  if (!esUuid(id)) throw new ProductoNoEncontradoError();
  const producto = await productos.buscarPorId(id);
  if (!producto) throw new ProductoNoEncontradoError();
  const puesto = await puestos.obtener(producto.puestoId);
  if (!puesto) throw new PuestoNoEncontradoError();
  exigirTitular(actor, puesto);
  return { producto, puesto };
}

async function categoriaActiva(categorias: CategoriaRepository, id: unknown) {
  if (!esUuid(id)) throw new ErrorDeValidacion('La categoría no es válida.');
  const categoria = await categorias.buscarPorId(id);
  if (!categoria) throw new CategoriaNoEncontradaError();
  if (!categoria.activa) throw new CategoriaInactivaError();
  return categoria;
}

/** RF09–RF11, HU12–HU13. */
export class CrearProducto {
  constructor(
    private readonly productos: ProductoRepository,
    private readonly categorias: CategoriaRepository,
    private readonly puestos: PuestoConsultaPort,
  ) {}

  async ejecutar(comando: DatosProducto & { puestoId: string }, actor: Actor): Promise<Producto> {
    exigirRolComerciante(actor);
    if (!esUuid(comando.puestoId)) throw new ErrorDeValidacion('El puesto no es válido.');
    const puesto = await this.puestos.obtener(comando.puestoId);
    if (!puesto) throw new PuestoNoEncontradoError();
    exigirTitular(actor, puesto);
    await categoriaActiva(this.categorias, comando.categoriaId);
    const producto = Producto.crear({ id: randomUUID(), ...comando });
    await this.productos.guardar(producto);
    return producto;
  }
}

export class ActualizarProducto {
  constructor(
    private readonly productos: ProductoRepository,
    private readonly categorias: CategoriaRepository,
    private readonly puestos: PuestoConsultaPort,
  ) {}

  async ejecutar(id: string, cambios: Partial<DatosProducto>, actor: Actor): Promise<Producto> {
    const { producto } = await cargarPropio(id, actor, this.productos, this.puestos);
    if (cambios.categoriaId !== undefined && cambios.categoriaId !== producto.categoriaId) {
      await categoriaActiva(this.categorias, cambios.categoriaId);
    }
    producto.actualizar(cambios);
    await this.productos.guardar(producto);
    return producto;
  }
}

export type AccionEstado = 'PUBLICAR' | 'DESACTIVAR';

/** Publicar exige puesto y comerciante activos y categoría activa. Desactivar retira el producto del catálogo. */
export class CambiarEstadoProducto {
  constructor(
    private readonly productos: ProductoRepository,
    private readonly categorias: CategoriaRepository,
    private readonly puestos: PuestoConsultaPort,
  ) {}

  async ejecutar(id: string, accion: AccionEstado, actor: Actor): Promise<Producto> {
    // Primero se autoriza (rol y propiedad) y después se valida la entrada: quien no es titular recibe siempre 403.
    const { producto, puesto } = await cargarPropio(id, actor, this.productos, this.puestos);
    if (accion !== 'PUBLICAR' && accion !== 'DESACTIVAR') throw new ErrorDeValidacion('La acción debe ser PUBLICAR o DESACTIVAR.');
    if (accion === 'PUBLICAR') {
      if (!puesto.operativo) throw new PuestoNoOperativoError();
      await categoriaActiva(this.categorias, producto.categoriaId);
      producto.publicar();
    } else {
      producto.desactivar();
    }
    await this.productos.guardar(producto);
    return producto;
  }
}

export interface FiltroGestion {
  puestoId?: string;
  categoriaId?: string;
  estado?: EstadoPublicacion;
  pagina?: number;
  limite?: number;
}

/** Comerciante: solo productos de sus puestos. Administrador: lectura de todos (supervisión). Cliente: no. */
export class ListarProductosGestion {
  constructor(
    private readonly productos: ProductoRepository,
    private readonly puestos: PuestoConsultaPort,
  ) {}

  async ejecutar(actor: Actor, f: FiltroGestion = {}): Promise<Pagina<Producto>> {
    const { pagina, limite, desplazamiento } = paginar(f.pagina, f.limite, 100);
    if (f.puestoId !== undefined && !esUuid(f.puestoId)) throw new ErrorDeValidacion('El puesto no es válido.');
    if (f.categoriaId !== undefined && !esUuid(f.categoriaId)) throw new ErrorDeValidacion('La categoría no es válida.');
    if (f.estado !== undefined && !['BORRADOR', 'PUBLICADO', 'DESACTIVADO'].includes(f.estado)) throw new ErrorDeValidacion('El estado no es válido.');

    let puestoIds: string[] | undefined;
    if (esAdministrador(actor)) {
      puestoIds = undefined;
    } else if (actor.rol === Rol.COMERCIANTE) {
      puestoIds = await this.puestos.idsDeTitular(actor.id);
      if (f.puestoId && !puestoIds.includes(f.puestoId)) throw new ErrorProhibido('No puede consultar productos de otro comerciante.');
      if (puestoIds.length === 0) return { datos: [], pagina, limite, total: 0, totalPaginas: 0 };
    } else {
      throw new ErrorProhibido('No tiene permiso para gestionar productos.');
    }
    const { items, total } = await this.productos.listar({
      puestoIds,
      puestoId: f.puestoId,
      categoriaId: f.categoriaId,
      estado: f.estado,
      limite,
      desplazamiento,
    });
    return { datos: items, pagina, limite, total, totalPaginas: Math.ceil(total / limite) };
  }
}

/** API entre módulos (la usa Inventario): a qué puesto pertenece un producto. No autoriza; quien llama debe hacerlo. */
export class ObtenerPuestoDeProducto {
  constructor(private readonly productos: ProductoRepository) {}

  async ejecutar(productoId: string): Promise<{ productoId: string; puestoId: string } | null> {
    if (!esUuid(productoId)) return null;
    const p = await this.productos.buscarPorId(productoId);
    return p ? { productoId: p.id, puestoId: p.puestoId } : null;
  }
}

export class ObtenerProductoGestion {
  constructor(
    private readonly productos: ProductoRepository,
    private readonly puestos: PuestoConsultaPort,
  ) {}

  async ejecutar(id: string, actor: Actor): Promise<Producto> {
    if (!esAdministrador(actor)) return (await cargarPropio(id, actor, this.productos, this.puestos)).producto;
    if (!esUuid(id)) throw new ProductoNoEncontradoError();
    const producto = await this.productos.buscarPorId(id);
    if (!producto) throw new ProductoNoEncontradoError();
    return producto;
  }
}

// ───────────── Imágenes ─────────────

export const MAX_BYTES_IMAGEN = 2 * 1024 * 1024;
const TIPOS: Record<string, { extension: string; firma: (b: Buffer) => boolean }> = {
  'image/jpeg': { extension: 'jpg', firma: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  'image/png': { extension: 'png', firma: (b) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) },
  'image/webp': { extension: 'webp', firma: (b) => b.subarray(0, 4).toString('latin1') === 'RIFF' && b.subarray(8, 12).toString('latin1') === 'WEBP' },
};

export interface ArchivoImagen {
  contenido: Buffer;
  tipoMime: string;
  textoAlternativo?: string | null;
}

export class SubirImagenProducto {
  constructor(
    private readonly productos: ProductoRepository,
    private readonly puestos: PuestoConsultaPort,
    private readonly almacen: AlmacenArchivos,
  ) {}

  async ejecutar(id: string, archivo: ArchivoImagen, actor: Actor): Promise<Producto> {
    const { producto } = await cargarPropio(id, actor, this.productos, this.puestos);
    const tipo = TIPOS[archivo?.tipoMime];
    if (!tipo || !Buffer.isBuffer(archivo.contenido)) throw new ErrorDeValidacion('Solo se admiten imágenes JPEG, PNG o WebP.');
    if (archivo.contenido.length === 0 || archivo.contenido.length > MAX_BYTES_IMAGEN) {
      throw new ErrorDeValidacion('La imagen debe pesar entre 1 byte y 2 MB.');
    }
    // El tipo declarado por el cliente no basta: se verifica la firma real del archivo.
    if (!tipo.firma(archivo.contenido)) throw new ErrorDeValidacion('El contenido no coincide con el tipo de imagen indicado.');

    const imagenId = randomUUID();
    const ruta = `${producto.id}/${imagenId}.${tipo.extension}`;
    producto.agregarImagen({ id: imagenId, ruta, textoAlternativo: archivo.textoAlternativo }); // valida límite y texto antes de subir
    await this.almacen.subir(ruta, archivo.contenido, archivo.tipoMime);
    try {
      await this.productos.guardar(producto);
    } catch (error) {
      await this.almacen.eliminar(ruta);
      throw error;
    }
    return producto;
  }
}

export class EliminarImagenProducto {
  constructor(
    private readonly productos: ProductoRepository,
    private readonly puestos: PuestoConsultaPort,
    private readonly almacen: AlmacenArchivos,
  ) {}

  async ejecutar(id: string, imagenId: string, actor: Actor): Promise<Producto> {
    const { producto } = await cargarPropio(id, actor, this.productos, this.puestos);
    const imagen = producto.quitarImagen(imagenId);
    await this.productos.guardar(producto);
    await this.almacen.eliminar(imagen.ruta);
    return producto;
  }
}
