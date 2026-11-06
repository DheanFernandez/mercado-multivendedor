import { describe, expect, it } from 'vitest';
import { Rol, type Actor } from '../../../../shared/domain/actor.js';
import { ErrorDeValidacion, ErrorProhibido, ErrorServicioNoDisponible } from '../../../../shared/domain/errors.js';
import { CategoriaDuplicadaError, CategoriaInactivaError, CategoriaNoEncontradaError, ImagenNoEncontradaError, LimiteImagenesError, ProductoNoEncontradoError, PuestoNoEncontradoError, PuestoNoOperativoError } from '../../domain/errors.js';
import { ActualizarCategoria, CambiarDisponibilidadCategoria, CrearCategoria, ListarCategorias } from './categorias.use-cases.js';
import {
  ActualizarProducto, CambiarEstadoProducto, CrearProducto, EliminarImagenProducto, ListarProductosGestion, ObtenerProductoGestion, SubirImagenProducto,
} from './productos.use-cases.js';
import { AlmacenEnMemoria, CategoriasEnMemoria, ProductosEnMemoria, PuestosFalsos } from './test-doubles.js';

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const admin: Actor = { id: id(1), rol: Rol.ADMINISTRADOR };
const cliente: Actor = { id: id(2), rol: Rol.CLIENTE };
const ana: Actor = { id: id(10), rol: Rol.COMERCIANTE }; // titular del puesto A
const beto: Actor = { id: id(11), rol: Rol.COMERCIANTE }; // titular del puesto B
const sinPuestos: Actor = { id: id(12), rol: Rol.COMERCIANTE };
const PUESTO_A = id(100);
const PUESTO_B = id(101);
const PUESTO_C = id(102); // de Ana pero inactivo

const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(32)]);
const JPG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(32)]);

async function escenario() {
  const categorias = new CategoriasEnMemoria();
  const productos = new ProductosEnMemoria();
  const almacen = new AlmacenEnMemoria();
  const puestos = new PuestosFalsos({
    [PUESTO_A]: { id: PUESTO_A, codigo: 'A-1', nombre: 'Verduras', operativo: true, usuarioIdTitular: ana.id },
    [PUESTO_B]: { id: PUESTO_B, codigo: 'B-1', nombre: 'Frutas', operativo: true, usuarioIdTitular: beto.id },
    [PUESTO_C]: { id: PUESTO_C, codigo: 'A-2', nombre: 'Cerrado', operativo: false, usuarioIdTitular: ana.id },
  });
  const cat = await new CrearCategoria(categorias).ejecutar({ nombre: 'Verduras' }, admin);
  const crear = new CrearProducto(productos, categorias, puestos);
  const datos = (extra: object = {}) => ({ puestoId: PUESTO_A, categoriaId: cat.id, nombre: 'Papa', precio: '3.50', unidadVenta: 'KILOGRAMO', ...extra });
  return {
    categorias, productos, almacen, puestos, cat, datos, crear,
    actualizar: new ActualizarProducto(productos, categorias, puestos),
    estado: new CambiarEstadoProducto(productos, categorias, puestos),
    listar: new ListarProductosGestion(productos, puestos),
    obtener: new ObtenerProductoGestion(productos, puestos),
    subir: new SubirImagenProducto(productos, puestos, almacen),
    quitar: new EliminarImagenProducto(productos, puestos, almacen),
  };
}

describe('Categorías', () => {
  it('solo el administrador crea, actualiza y cambia disponibilidad', async () => {
    const categorias = new CategoriasEnMemoria();
    for (const actor of [cliente, ana]) {
      await expect(new CrearCategoria(categorias).ejecutar({ nombre: 'X' }, actor)).rejects.toBeInstanceOf(ErrorProhibido);
    }
    const c = await new CrearCategoria(categorias).ejecutar({ nombre: 'Frutas', descripcion: ' dulces ' }, admin);
    expect(c).toMatchObject({ slug: 'frutas', descripcion: 'dulces', activa: true });
    await expect(new ActualizarCategoria(categorias).ejecutar(c.id, { nombre: 'Y' }, ana)).rejects.toBeInstanceOf(ErrorProhibido);
    await expect(new CambiarDisponibilidadCategoria(categorias).ejecutar(c.id, false, ana)).rejects.toBeInstanceOf(ErrorProhibido);
    expect((await new ActualizarCategoria(categorias).ejecutar(c.id, { nombre: 'Frutas Frescas' }, admin)).slug).toBe('frutas-frescas');
    expect((await new CambiarDisponibilidadCategoria(categorias).ejecutar(c.id, false, admin)).activa).toBe(false);
  });

  it('rechaza duplicados (aunque cambien mayúsculas o tildes), inexistentes y datos inválidos', async () => {
    const categorias = new CategoriasEnMemoria();
    await new CrearCategoria(categorias).ejecutar({ nombre: 'Lácteos' }, admin);
    await expect(new CrearCategoria(categorias).ejecutar({ nombre: 'LACTEOS' }, admin)).rejects.toBeInstanceOf(CategoriaDuplicadaError);
    await expect(new CrearCategoria(categorias).ejecutar({ nombre: ' ' }, admin)).rejects.toBeInstanceOf(ErrorDeValidacion);
    await expect(new ActualizarCategoria(categorias).ejecutar(id(77), { nombre: 'Z' }, admin)).rejects.toBeInstanceOf(CategoriaNoEncontradaError);
    const otra = await new CrearCategoria(categorias).ejecutar({ nombre: 'Carnes' }, admin);
    await expect(new ActualizarCategoria(categorias).ejecutar(otra.id, { nombre: 'lácteos' }, admin)).rejects.toBeInstanceOf(CategoriaDuplicadaError);
  });

  it('el listado público solo muestra activas; las inactivas exigen administrador', async () => {
    const categorias = new CategoriasEnMemoria();
    const a = await new CrearCategoria(categorias).ejecutar({ nombre: 'A' }, admin);
    await new CrearCategoria(categorias).ejecutar({ nombre: 'B' }, admin);
    await new CambiarDisponibilidadCategoria(categorias).ejecutar(a.id, false, admin);
    const listar = new ListarCategorias(categorias);
    expect((await listar.ejecutar()).map((c) => c.nombre)).toEqual(['B']);
    await expect(listar.ejecutar({ incluirInactivas: true })).rejects.toBeInstanceOf(ErrorProhibido);
    await expect(listar.ejecutar({ incluirInactivas: true }, ana)).rejects.toBeInstanceOf(ErrorProhibido);
    expect(await listar.ejecutar({ incluirInactivas: true }, admin)).toHaveLength(2);
  });
});

describe('CrearProducto', () => {
  it('el comerciante titular crea productos en BORRADOR en su puesto', async () => {
    const e = await escenario();
    const p = await e.crear.ejecutar(e.datos({ presentacion: 'saco', descripcion: 'Fresca' }), ana);
    expect(p).toMatchObject({ estado: 'BORRADOR', puestoId: PUESTO_A, nombre: 'Papa' });
    expect(p.precio.toString()).toBe('3.50');
    expect(e.productos.datos.size).toBe(1);
  });

  it.each([['cliente', cliente], ['administrador', admin]])('%s no puede crear productos', async (_n, actor) => {
    const e = await escenario();
    await expect(e.crear.ejecutar(e.datos(), actor)).rejects.toBeInstanceOf(ErrorProhibido);
    expect(e.productos.datos.size).toBe(0);
  });

  it('un comerciante no puede crear productos en un puesto ajeno', async () => {
    const e = await escenario();
    await expect(e.crear.ejecutar(e.datos({ puestoId: PUESTO_B }), ana)).rejects.toBeInstanceOf(ErrorProhibido);
    await expect(e.crear.ejecutar(e.datos(), sinPuestos)).rejects.toBeInstanceOf(ErrorProhibido);
  });

  it('valida puesto, categoría, precio y unidad', async () => {
    const e = await escenario();
    await expect(e.crear.ejecutar(e.datos({ puestoId: id(555) }), ana)).rejects.toBeInstanceOf(PuestoNoEncontradoError);
    await expect(e.crear.ejecutar(e.datos({ puestoId: 'x' }), ana)).rejects.toBeInstanceOf(ErrorDeValidacion);
    await expect(e.crear.ejecutar(e.datos({ categoriaId: id(556) }), ana)).rejects.toBeInstanceOf(CategoriaNoEncontradaError);
    await expect(e.crear.ejecutar(e.datos({ categoriaId: 'x' }), ana)).rejects.toBeInstanceOf(ErrorDeValidacion);
    await expect(e.crear.ejecutar(e.datos({ precio: '-1' }), ana)).rejects.toBeInstanceOf(ErrorDeValidacion);
    await expect(e.crear.ejecutar(e.datos({ precio: 0.1 + 0.2 }), ana)).rejects.toBeInstanceOf(ErrorDeValidacion);
    await expect(e.crear.ejecutar(e.datos({ unidadVenta: 'TONELADA' }), ana)).rejects.toBeInstanceOf(ErrorDeValidacion);
    await expect(e.crear.ejecutar(e.datos({ nombre: '' }), ana)).rejects.toBeInstanceOf(ErrorDeValidacion);
    expect(e.productos.datos.size).toBe(0);
  });

  it('no admite categorías inactivas', async () => {
    const e = await escenario();
    await new CambiarDisponibilidadCategoria(e.categorias).ejecutar(e.cat.id, false, admin);
    await expect(e.crear.ejecutar(e.datos(), ana)).rejects.toBeInstanceOf(CategoriaInactivaError);
  });
});

describe('ActualizarProducto y CambiarEstadoProducto', () => {
  it('el titular actualiza; no se puede cambiar de puesto', async () => {
    const e = await escenario();
    const p = await e.crear.ejecutar(e.datos(), ana);
    const r = await e.actualizar.ejecutar(p.id, { precio: '4.25', nombre: 'Papa blanca', puestoId: PUESTO_B } as never, ana);
    expect(r).toMatchObject({ nombre: 'Papa blanca', puestoId: PUESTO_A });
    expect(r.precio.toString()).toBe('4.25');
  });

  it('prohíbe modificar productos ajenos, o hacerlo como cliente/administrador', async () => {
    const e = await escenario();
    const p = await e.crear.ejecutar(e.datos(), ana);
    for (const actor of [beto, cliente, admin, sinPuestos]) {
      await expect(e.actualizar.ejecutar(p.id, { nombre: 'Robado' }, actor)).rejects.toBeInstanceOf(ErrorProhibido);
      await expect(e.estado.ejecutar(p.id, 'PUBLICAR', actor)).rejects.toBeInstanceOf(ErrorProhibido);
    }
    expect(e.productos.datos.get(p.id)!.nombre).toBe('Papa');
    expect(e.productos.datos.get(p.id)!.estado).toBe('BORRADOR');
  });

  it('producto inexistente o id mal formado → no encontrado', async () => {
    const e = await escenario();
    await expect(e.actualizar.ejecutar(id(999), { nombre: 'x' }, ana)).rejects.toBeInstanceOf(ProductoNoEncontradoError);
    await expect(e.actualizar.ejecutar('no-uuid', { nombre: 'x' }, ana)).rejects.toBeInstanceOf(ProductoNoEncontradoError);
  });

  it('cambiar de categoría exige una categoría activa existente', async () => {
    const e = await escenario();
    const p = await e.crear.ejecutar(e.datos(), ana);
    const otra = await new CrearCategoria(e.categorias).ejecutar({ nombre: 'Frutas' }, admin);
    expect((await e.actualizar.ejecutar(p.id, { categoriaId: otra.id }, ana)).categoriaId).toBe(otra.id);
    await expect(e.actualizar.ejecutar(p.id, { categoriaId: id(888) }, ana)).rejects.toBeInstanceOf(CategoriaNoEncontradaError);
    await new CambiarDisponibilidadCategoria(e.categorias).ejecutar(e.cat.id, false, admin);
    await expect(e.actualizar.ejecutar(p.id, { categoriaId: e.cat.id }, ana)).rejects.toBeInstanceOf(CategoriaInactivaError);
  });

  it('publicar, desactivar y reactivar', async () => {
    const e = await escenario();
    const p = await e.crear.ejecutar(e.datos(), ana);
    expect((await e.estado.ejecutar(p.id, 'PUBLICAR', ana)).estado).toBe('PUBLICADO');
    expect((await e.estado.ejecutar(p.id, 'DESACTIVAR', ana)).estado).toBe('DESACTIVADO');
    expect((await e.estado.ejecutar(p.id, 'PUBLICAR', ana)).estado).toBe('PUBLICADO');
    await expect(e.estado.ejecutar(p.id, 'ELIMINAR' as never, ana)).rejects.toBeInstanceOf(ErrorDeValidacion);
  });

  it('autoriza antes de validar la acción: un no titular recibe 403 aunque la acción sea inválida', async () => {
    const e = await escenario();
    const p = await e.crear.ejecutar(e.datos(), ana);
    for (const actor of [beto, cliente, admin]) {
      await expect(e.estado.ejecutar(p.id, 'ELIMINAR' as never, actor)).rejects.toBeInstanceOf(ErrorProhibido);
    }
    await expect(e.estado.ejecutar(p.id, 'ELIMINAR' as never, ana)).rejects.toBeInstanceOf(ErrorDeValidacion);
  });

  it('no se publica si el puesto no está operativo o la categoría está inactiva', async () => {
    const e = await escenario();
    const enCerrado = await e.crear.ejecutar(e.datos({ puestoId: PUESTO_C }), ana);
    await expect(e.estado.ejecutar(enCerrado.id, 'PUBLICAR', ana)).rejects.toBeInstanceOf(PuestoNoOperativoError);
    const p = await e.crear.ejecutar(e.datos(), ana);
    await new CambiarDisponibilidadCategoria(e.categorias).ejecutar(e.cat.id, false, admin);
    await expect(e.estado.ejecutar(p.id, 'PUBLICAR', ana)).rejects.toBeInstanceOf(CategoriaInactivaError);
  });
});

describe('Gestión: listar y consultar', () => {
  it('el comerciante solo ve sus productos; el administrador ve todos; el cliente nada', async () => {
    const e = await escenario();
    await e.crear.ejecutar(e.datos({ nombre: 'De Ana' }), ana);
    await e.crear.ejecutar(e.datos({ nombre: 'De Beto', puestoId: PUESTO_B }), beto);
    expect((await e.listar.ejecutar(ana)).datos.map((p) => p.nombre)).toEqual(['De Ana']);
    expect((await e.listar.ejecutar(beto)).total).toBe(1);
    expect((await e.listar.ejecutar(admin)).total).toBe(2);
    expect((await e.listar.ejecutar(sinPuestos)).datos).toEqual([]);
    await expect(e.listar.ejecutar(cliente)).rejects.toBeInstanceOf(ErrorProhibido);
    await expect(e.listar.ejecutar(ana, { puestoId: PUESTO_B })).rejects.toBeInstanceOf(ErrorProhibido);
  });

  it('valida filtros y paginación', async () => {
    const e = await escenario();
    await expect(e.listar.ejecutar(admin, { pagina: 0 })).rejects.toBeInstanceOf(ErrorDeValidacion);
    await expect(e.listar.ejecutar(admin, { limite: 1000 })).rejects.toBeInstanceOf(ErrorDeValidacion);
    await expect(e.listar.ejecutar(admin, { puestoId: 'x' })).rejects.toBeInstanceOf(ErrorDeValidacion);
    await expect(e.listar.ejecutar(admin, { estado: 'OTRO' as never })).rejects.toBeInstanceOf(ErrorDeValidacion);
  });

  it('obtener: titular y administrador sí; otros no', async () => {
    const e = await escenario();
    const p = await e.crear.ejecutar(e.datos(), ana);
    expect((await e.obtener.ejecutar(p.id, ana)).id).toBe(p.id);
    expect((await e.obtener.ejecutar(p.id, admin)).id).toBe(p.id);
    await expect(e.obtener.ejecutar(p.id, beto)).rejects.toBeInstanceOf(ErrorProhibido);
    await expect(e.obtener.ejecutar(p.id, cliente)).rejects.toBeInstanceOf(ErrorProhibido);
    await expect(e.obtener.ejecutar(id(999), admin)).rejects.toBeInstanceOf(ProductoNoEncontradoError);
  });
});

describe('Imágenes', () => {
  it('sube una imagen válida, la guarda en el almacén y la asocia al producto', async () => {
    const e = await escenario();
    const p = await e.crear.ejecutar(e.datos(), ana);
    const r = await e.subir.ejecutar(p.id, { contenido: PNG, tipoMime: 'image/png', textoAlternativo: 'Papas' }, ana);
    expect(r.imagenes).toHaveLength(1);
    expect(r.imagenes[0].ruta).toMatch(new RegExp(`^${p.id}/[0-9a-f-]{36}\\.png$`));
    expect(e.almacen.archivos.has(r.imagenes[0].ruta)).toBe(true);
  });

  it('rechaza tipos no permitidos, contenido falso, vacío y demasiado grande', async () => {
    const e = await escenario();
    const p = await e.crear.ejecutar(e.datos(), ana);
    const intento = (a: object) => e.subir.ejecutar(p.id, a as never, ana);
    await expect(intento({ contenido: Buffer.from('<svg/>'), tipoMime: 'image/svg+xml' })).rejects.toBeInstanceOf(ErrorDeValidacion);
    await expect(intento({ contenido: Buffer.from('#!/bin/sh'), tipoMime: 'image/png' })).rejects.toBeInstanceOf(ErrorDeValidacion);
    await expect(intento({ contenido: JPG, tipoMime: 'image/png' })).rejects.toBeInstanceOf(ErrorDeValidacion);
    await expect(intento({ contenido: Buffer.alloc(0), tipoMime: 'image/png' })).rejects.toBeInstanceOf(ErrorDeValidacion);
    await expect(intento({ contenido: Buffer.concat([PNG, Buffer.alloc(2 * 1024 * 1024)]), tipoMime: 'image/png' })).rejects.toBeInstanceOf(ErrorDeValidacion);
    await expect(intento({ tipoMime: undefined, contenido: undefined })).rejects.toBeInstanceOf(ErrorDeValidacion);
    expect(e.almacen.archivos.size).toBe(0);
  });

  it('máximo 5 imágenes y no sube el archivo si se excede', async () => {
    const e = await escenario();
    const p = await e.crear.ejecutar(e.datos(), ana);
    for (let i = 0; i < 5; i++) await e.subir.ejecutar(p.id, { contenido: JPG, tipoMime: 'image/jpeg' }, ana);
    await expect(e.subir.ejecutar(p.id, { contenido: JPG, tipoMime: 'image/jpeg' }, ana)).rejects.toBeInstanceOf(LimiteImagenesError);
    expect(e.almacen.archivos.size).toBe(5);
  });

  it('solo el titular sube o elimina imágenes', async () => {
    const e = await escenario();
    const p = await e.crear.ejecutar(e.datos(), ana);
    for (const actor of [beto, cliente, admin]) {
      await expect(e.subir.ejecutar(p.id, { contenido: PNG, tipoMime: 'image/png' }, actor)).rejects.toBeInstanceOf(ErrorProhibido);
    }
    const r = await e.subir.ejecutar(p.id, { contenido: PNG, tipoMime: 'image/png' }, ana);
    await expect(e.quitar.ejecutar(p.id, r.imagenes[0].id, beto)).rejects.toBeInstanceOf(ErrorProhibido);
    await expect(e.quitar.ejecutar(p.id, id(404), ana)).rejects.toBeInstanceOf(ImagenNoEncontradaError);
    const ruta = r.imagenes[0].ruta;
    expect((await e.quitar.ejecutar(p.id, r.imagenes[0].id, ana)).imagenes).toHaveLength(0);
    expect(e.almacen.archivos.has(ruta)).toBe(false);
  });

  it('si falla el almacenamiento no queda ninguna imagen asociada; si falla el guardado se limpia el archivo', async () => {
    const e = await escenario();
    const p = await e.crear.ejecutar(e.datos(), ana);
    e.almacen.falla = true;
    await expect(e.subir.ejecutar(p.id, { contenido: PNG, tipoMime: 'image/png' }, ana)).rejects.toThrow('almacenamiento caído');
    expect(e.productos.datos.get(p.id)!.imagenes).toHaveLength(0);
    e.almacen.falla = false;
    const original = e.productos.guardar.bind(e.productos);
    e.productos.guardar = async () => { throw new Error('bd caída'); };
    await expect(e.subir.ejecutar(p.id, { contenido: PNG, tipoMime: 'image/png' }, ana)).rejects.toThrow('bd caída');
    expect(e.almacen.archivos.size).toBe(0);
    e.productos.guardar = original;
  });

  it('propaga el error si el almacenamiento no está configurado', async () => {
    const e = await escenario();
    const p = await e.crear.ejecutar(e.datos(), ana);
    e.almacen.subir = async () => { throw new ErrorServicioNoDisponible('El almacenamiento de imágenes no está configurado.'); };
    await expect(e.subir.ejecutar(p.id, { contenido: PNG, tipoMime: 'image/png' }, ana)).rejects.toBeInstanceOf(ErrorServicioNoDisponible);
  });
});
