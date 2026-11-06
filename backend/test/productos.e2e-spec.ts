/**
 * Pruebas HTTP de categorías, productos y catálogo: aplicación real (guard global, controladores, casos de uso,
 * filtro de errores) con repositorios en memoria. No toca la base de datos ni Supabase.
 */
import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module.js';
import { VERIFICADOR_TOKEN, type VerificadorToken } from '../src/modules/auth/application/ports/ports.js';
import type { CatalogoRepository, ProductoCatalogo } from '../src/modules/catalog/application/ports/catalogo.repository.js';
import { CATALOGO_REPOSITORY } from '../src/modules/catalog/application/ports/catalogo.repository.js';
import { COMERCIANTE_REPOSITORY, PUESTO_REPOSITORY } from '../src/modules/merchants/application/ports/ports.js';
import { Comerciante } from '../src/modules/merchants/domain/comerciante.entity.js';
import { Puesto } from '../src/modules/merchants/domain/puesto.entity.js';
import { CATEGORIA_REPOSITORY, PRODUCTO_REPOSITORY } from '../src/modules/products/application/ports/ports.js';
import { CategoriasEnMemoria, ProductosEnMemoria } from '../src/modules/products/application/use-cases/test-doubles.js';
import { PROVEEDOR_IDENTIDAD } from '../src/modules/users/application/ports/proveedor-identidad.port.js';
import { USUARIO_REPOSITORY } from '../src/modules/users/application/ports/usuario.repository.js';
import { IdentidadFalsa, UsuariosEnMemoria } from '../src/modules/users/application/use-cases/test-doubles.js';
import { Usuario } from '../src/modules/users/domain/usuario.entity.js';
import { ALMACEN_ARCHIVOS } from '../src/shared/application/ports/almacen-archivos.port.js';
import { ErrorNoAutenticado } from '../src/shared/domain/errors.js';
import { PrismaService } from '../src/shared/infrastructure/prisma/prisma.service.js';
import { AlmacenEnMemoria } from '../src/modules/products/application/use-cases/test-doubles.js';

const uid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const AUTH = (n: number) => `aaaaaaaa-0000-4000-8000-${String(n).padStart(12, '0')}`;
const tok = (n: number) => ({ Authorization: `Bearer tok:${AUTH(n)}` });
const [ADMIN, CLIENTE, ANA, BETO] = [1, 2, 3, 4];
const PUESTO_ANA = uid(103);
const PUESTO_BETO = uid(104);
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(64)]);

const verificador: VerificadorToken = {
  async verificar(t) {
    const m = /^tok:([0-9a-f-]{36})$/.exec(t);
    if (!m) throw new ErrorNoAutenticado('Sesión inválida o expirada.');
    return { authId: m[1] };
  },
};

describe('Productos, categorías y catálogo (HTTP)', () => {
  let app: INestApplication;
  const usuarios = new UsuariosEnMemoria();
  const categorias = new CategoriasEnMemoria();
  const productos = new ProductosEnMemoria();
  const almacen = new AlmacenEnMemoria();
  const comerciantes = new Map<string, Comerciante>();
  const puestos = new Map<string, Puesto>();

  // Lectura del catálogo derivada de los repositorios en memoria (misma regla de visibilidad que el real).
  const catalogo: CatalogoRepository = {
    async buscar(f) {
      const visibles: ProductoCatalogo[] = [];
      for (const p of productos.datos.values()) {
        const cat = categorias.datos.get(p.categoriaId);
        const pu = puestos.get(p.puestoId);
        if (p.estado !== 'PUBLICADO' || !cat?.activa || pu?.estado !== 'ACTIVO') continue;
        if (f.categoriaId && p.categoriaId !== f.categoriaId) continue;
        if (f.puestoId && p.puestoId !== f.puestoId) continue;
        if (f.texto && !p.nombre.toLowerCase().includes(f.texto.toLowerCase())) continue;
        if (f.precioMinCentimos !== undefined && p.precio.centimos < f.precioMinCentimos) continue;
        if (f.precioMaxCentimos !== undefined && p.precio.centimos > f.precioMaxCentimos) continue;
        visibles.push({
          id: p.id, nombre: p.nombre, descripcion: p.descripcion, precio: p.precio.toString(), unidadVenta: p.unidadVenta, presentacion: p.presentacion,
          categoria: { id: cat.id, nombre: cat.nombre, slug: cat.slug }, puesto: { id: pu.id, codigo: pu.codigo, nombre: pu.nombre },
          imagenes: p.imagenes.map((i) => ({ ruta: i.ruta, textoAlternativo: i.textoAlternativo, orden: i.orden })),
        });
      }
      return { items: visibles.slice(f.desplazamiento, f.desplazamiento + f.limite), total: visibles.length };
    },
    async detalle(id) {
      return (await this.buscar({ orden: 'recientes', limite: 1000, desplazamiento: 0 })).items.find((p) => p.id === id) ?? null;
    },
  };

  const crearUsuario = (n: number, rol: Usuario['rol']) =>
    usuarios.datos.set(uid(n), Usuario.reconstruir({ id: uid(n), email: `u${n}@t.co`, nombres: 'N', apellidos: 'A', telefono: null, rol, estado: 'ACTIVO', authId: AUTH(n), creadoEn: new Date() }));

  beforeAll(async () => {
    crearUsuario(ADMIN, 'ADMINISTRADOR');
    crearUsuario(CLIENTE, 'CLIENTE');
    crearUsuario(ANA, 'COMERCIANTE');
    crearUsuario(BETO, 'COMERCIANTE');
    for (const [n, usuario, puesto, codigo] of [[201, ANA, PUESTO_ANA, 'A-1'], [202, BETO, PUESTO_BETO, 'B-1']] as const) {
      const c = Comerciante.reconstruir({ id: uid(n), usuarioId: uid(usuario), nombreComercial: `Comercio ${n}`, estado: 'ACTIVO', creadoEn: new Date() });
      comerciantes.set(c.id, c);
      puestos.set(puesto, Puesto.reconstruir({ id: puesto, comercianteId: c.id, codigo, nombre: `Puesto ${codigo}`, estado: 'ACTIVO', creadoEn: new Date() }));
    }
    const modulo = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService).useValue({})
      .overrideProvider(USUARIO_REPOSITORY).useValue(usuarios)
      .overrideProvider(PROVEEDOR_IDENTIDAD).useValue(new IdentidadFalsa())
      .overrideProvider(VERIFICADOR_TOKEN).useValue(verificador)
      .overrideProvider(COMERCIANTE_REPOSITORY).useValue({
        async buscarPorId(id: string) { return comerciantes.get(id) ?? null; },
        async buscarPorUsuarioId(u: string) { return [...comerciantes.values()].find((c) => c.usuarioId === u) ?? null; },
        async guardar() {}, async listar() { return [...comerciantes.values()]; },
      })
      .overrideProvider(PUESTO_REPOSITORY).useValue({
        async buscarPorId(id: string) { return puestos.get(id) ?? null; },
        async listar({ comercianteId }: { comercianteId?: string }) { return [...puestos.values()].filter((p) => !comercianteId || p.comercianteId === comercianteId); },
        async guardar() {},
      })
      .overrideProvider(CATEGORIA_REPOSITORY).useValue(categorias)
      .overrideProvider(PRODUCTO_REPOSITORY).useValue(productos)
      .overrideProvider(CATALOGO_REPOSITORY).useValue(catalogo)
      .overrideProvider(ALMACEN_ARCHIVOS).useValue(almacen)
      .compile();
    app = modulo.createNestApplication();
    await app.init();
  });
  afterAll(() => app.close());
  const http = () => request(app.getHttpServer());

  let categoriaId = '';
  let productoAna = '';

  describe('categorías', () => {
    it('solo el administrador crea categorías (401 sin sesión, 403 a otros roles)', async () => {
      const cuerpo = { nombre: 'Verduras y Hortalizas', descripcion: 'Frescas' };
      await http().post('/api/v1/categorias').send(cuerpo).expect(401);
      await http().post('/api/v1/categorias').set(tok(CLIENTE)).send(cuerpo).expect(403);
      await http().post('/api/v1/categorias').set(tok(ANA)).send(cuerpo).expect(403);
      const r = await http().post('/api/v1/categorias').set(tok(ADMIN)).send(cuerpo).expect(201);
      expect(r.body).toMatchObject({ nombre: 'Verduras y Hortalizas', slug: 'verduras-y-hortalizas', activa: true });
      categoriaId = r.body.id;
    });

    it('rechaza duplicados (409) y nombres inválidos (400)', async () => {
      await http().post('/api/v1/categorias').set(tok(ADMIN)).send({ nombre: 'verduras y hortalizas' }).expect(409);
      await http().post('/api/v1/categorias').set(tok(ADMIN)).send({ nombre: '  ' }).expect(400);
      await http().post('/api/v1/categorias').set(tok(ADMIN)).send({}).expect(400);
    });

    it('actualizar y cambiar disponibilidad: solo administrador; recurso inexistente → 404; id inválido → 400', async () => {
      await http().patch(`/api/v1/categorias/${categoriaId}`).set(tok(ANA)).send({ descripcion: 'x' }).expect(403);
      await http().patch(`/api/v1/categorias/${categoriaId}`).set(tok(ADMIN)).send({ descripcion: 'Del campo' }).expect(200);
      await http().patch(`/api/v1/categorias/${uid(999)}`).set(tok(ADMIN)).send({ nombre: 'Z' }).expect(404);
      await http().patch('/api/v1/categorias/no-uuid').set(tok(ADMIN)).send({ nombre: 'Z' }).expect(400);
      await http().patch(`/api/v1/categorias/${categoriaId}/estado`).set(tok(ANA)).send({ activa: false }).expect(403);
      await http().patch(`/api/v1/categorias/${categoriaId}/estado`).set(tok(ADMIN)).send({ activa: 'no' }).expect(400);
    });

    it('el listado público no requiere sesión; el de gestión exige administrador', async () => {
      const r = await http().get('/api/v1/categorias').expect(200);
      expect(r.body.map((c: { slug: string }) => c.slug)).toEqual(['verduras-y-hortalizas']);
      await http().get('/api/v1/categorias/gestion').expect(401);
      await http().get('/api/v1/categorias/gestion').set(tok(ANA)).expect(403);
      await http().get('/api/v1/categorias/gestion').set(tok(ADMIN)).expect(200);
    });
  });

  describe('productos', () => {
    const cuerpo = (extra: object = {}) => ({ puestoId: PUESTO_ANA, categoriaId, nombre: 'Papa amarilla', precio: '3.50', unidadVenta: 'KILOGRAMO', presentacion: 'saco', ...extra });

    it('las rutas de gestión exigen sesión', async () => {
      await http().post('/api/v1/productos').send(cuerpo()).expect(401);
      await http().get('/api/v1/productos').expect(401);
      await http().get(`/api/v1/productos/${uid(1)}`).expect(401);
      await http().patch(`/api/v1/productos/${uid(1)}`).send({}).expect(401);
      await http().post(`/api/v1/productos/${uid(1)}/imagenes`).expect(401);
    });

    it('el cliente y el administrador no pueden crear productos', async () => {
      await http().post('/api/v1/productos').set(tok(CLIENTE)).send(cuerpo()).expect(403);
      await http().post('/api/v1/productos').set(tok(ADMIN)).send(cuerpo()).expect(403);
    });

    it('un comerciante no crea productos en el puesto de otro', async () => {
      await http().post('/api/v1/productos').set(tok(BETO)).send(cuerpo()).expect(403);
    });

    it('el titular crea un producto en BORRADOR con precio exacto', async () => {
      const r = await http().post('/api/v1/productos').set(tok(ANA)).send(cuerpo()).expect(201);
      expect(r.body).toMatchObject({ estado: 'BORRADOR', precio: '3.50', unidadVenta: 'KILOGRAMO', puestoId: PUESTO_ANA });
      productoAna = r.body.id;
    });

    it.each([
      [{ precio: '-5' }], [{ precio: '0' }], [{ precio: 0.30000000000000004 }], [{ precio: '1.999' }], [{ precio: 'gratis' }],
      [{ unidadVenta: 'TONELADA' }], [{ nombre: '' }], [{ categoriaId: 'x' }], [{ puestoId: 'x' }],
    ])('rechaza datos inválidos %j con 400', async (extra) => {
      await http().post('/api/v1/productos').set(tok(ANA)).send(cuerpo(extra)).expect(400);
    });

    it('categoría o puesto inexistentes → 404', async () => {
      await http().post('/api/v1/productos').set(tok(ANA)).send(cuerpo({ categoriaId: uid(999) })).expect(404);
      await http().post('/api/v1/productos').set(tok(ANA)).send(cuerpo({ puestoId: uid(998) })).expect(404);
    });

    it('un comerciante ajeno no puede ver, modificar ni publicar un producto', async () => {
      await http().get(`/api/v1/productos/${productoAna}`).set(tok(BETO)).expect(403);
      await http().patch(`/api/v1/productos/${productoAna}`).set(tok(BETO)).send({ nombre: 'Robado' }).expect(403);
      await http().patch(`/api/v1/productos/${productoAna}/estado`).set(tok(BETO)).send({ accion: 'PUBLICAR' }).expect(403);
      await http().patch(`/api/v1/productos/${productoAna}`).set(tok(ADMIN)).send({ nombre: 'Admin' }).expect(403);
      await http().patch(`/api/v1/productos/${productoAna}`).set(tok(CLIENTE)).send({ nombre: 'Cliente' }).expect(403);
      expect(productos.datos.get(productoAna)!.nombre).toBe('Papa amarilla');
    });

    it('el titular actualiza; el puesto y el estado no se cambian por PATCH', async () => {
      const r = await http().patch(`/api/v1/productos/${productoAna}`).set(tok(ANA)).send({ precio: '4.25', puestoId: PUESTO_BETO, estado: 'PUBLICADO' }).expect(200);
      expect(r.body).toMatchObject({ precio: '4.25', puestoId: PUESTO_ANA, estado: 'BORRADOR' });
      await http().patch(`/api/v1/productos/${productoAna}`).set(tok(ANA)).send({ precio: '-1' }).expect(400);
    });

    it('producto inexistente → 404; id mal formado → 400', async () => {
      await http().get(`/api/v1/productos/${uid(777)}`).set(tok(ANA)).expect(404);
      await http().get('/api/v1/productos/no-uuid').set(tok(ANA)).expect(400);
    });

    it('listado de gestión: cada comerciante ve lo suyo, el administrador todo, el cliente nada', async () => {
      await http().post('/api/v1/productos').set(tok(BETO)).send(cuerpo({ puestoId: PUESTO_BETO, nombre: 'Manzana' })).expect(201);
      const ana = await http().get('/api/v1/productos').set(tok(ANA)).expect(200);
      expect(ana.body.datos.map((p: { nombre: string }) => p.nombre)).toEqual(['Papa amarilla']);
      expect(ana.body).toMatchObject({ pagina: 1, total: 1, totalPaginas: 1 });
      expect((await http().get('/api/v1/productos').set(tok(ADMIN)).expect(200)).body.total).toBe(2);
      await http().get('/api/v1/productos').set(tok(CLIENTE)).expect(403);
      await http().get(`/api/v1/productos?puestoId=${PUESTO_BETO}`).set(tok(ANA)).expect(403);
      await http().get('/api/v1/productos?limite=1000').set(tok(ADMIN)).expect(400);
    });
  });

  describe('imágenes', () => {
    it('el titular sube una imagen válida y se expone su URL pública', async () => {
      const r = await http().post(`/api/v1/productos/${productoAna}/imagenes`).set(tok(ANA)).field('textoAlternativo', 'Papas').attach('archivo', PNG, { filename: 'p.png', contentType: 'image/png' }).expect(201);
      expect(r.body.imagenes).toHaveLength(1);
      expect(r.body.imagenes[0].url).toMatch(/^https:\/\/almacen\.test\/.+\.png$/);
    });

    it('rechaza archivos falsos, tipos no permitidos, ausencia de archivo y tamaño excesivo', async () => {
      const subir = () => http().post(`/api/v1/productos/${productoAna}/imagenes`).set(tok(ANA));
      await subir().attach('archivo', Buffer.from('no soy una imagen'), { filename: 'x.png', contentType: 'image/png' }).expect(400);
      await subir().attach('archivo', Buffer.from('<svg/>'), { filename: 'x.svg', contentType: 'image/svg+xml' }).expect(400);
      await subir().expect(400);
      await subir().attach('archivo', Buffer.concat([PNG, Buffer.alloc(2.5 * 1024 * 1024)]), { filename: 'g.png', contentType: 'image/png' }).expect(413);
    });

    it('un comerciante ajeno no sube ni elimina imágenes', async () => {
      await http().post(`/api/v1/productos/${productoAna}/imagenes`).set(tok(BETO)).attach('archivo', PNG, { filename: 'p.png', contentType: 'image/png' }).expect(403);
      const id = productos.datos.get(productoAna)!.imagenes[0].id;
      await http().delete(`/api/v1/productos/${productoAna}/imagenes/${id}`).set(tok(BETO)).expect(403);
      await http().delete(`/api/v1/productos/${productoAna}/imagenes/${uid(404)}`).set(tok(ANA)).expect(404);
    });
  });

  describe('catálogo público', () => {
    it('no muestra productos en borrador', async () => {
      const r = await http().get('/api/v1/catalogo/productos').expect(200);
      expect(r.body).toMatchObject({ datos: [], total: 0 });
      await http().get(`/api/v1/catalogo/productos/${productoAna}`).expect(404);
    });

    it('tras publicar, el producto aparece con categoría, puesto, precio e imágenes, sin sesión', async () => {
      await http().patch(`/api/v1/productos/${productoAna}/estado`).set(tok(ANA)).send({ accion: 'PUBLICAR' }).expect(200);
      const lista = await http().get('/api/v1/catalogo/productos').expect(200);
      expect(lista.body.total).toBe(1);
      expect(lista.body.datos[0]).toMatchObject({
        id: productoAna, precio: '4.25', unidadVenta: 'KILOGRAMO', categoria: { slug: 'verduras-y-hortalizas' }, puesto: { codigo: 'A-1' },
      });
      expect(lista.body.datos[0].imagenes[0].url).toContain('almacen.test');
      const det = await http().get(`/api/v1/catalogo/productos/${productoAna}`).expect(200);
      expect(det.body.puesto).toMatchObject({ id: PUESTO_ANA, nombre: 'Puesto A-1' });
    });

    it('no expone datos internos (propietario, estado, puesto como id suelto)', async () => {
      const det = await http().get(`/api/v1/catalogo/productos/${productoAna}`).expect(200);
      expect(JSON.stringify(det.body)).not.toMatch(/usuarioId|estado|authId|email/);
    });

    it('filtra por categoría, puesto, texto y precio', async () => {
      const q = (s: string) => http().get(`/api/v1/catalogo/productos?${s}`).expect(200).then((r) => r.body.total as number);
      expect(await q(`categoriaId=${categoriaId}`)).toBe(1);
      expect(await q(`categoriaId=${uid(555)}`)).toBe(0);
      expect(await q(`puestoId=${PUESTO_ANA}`)).toBe(1);
      expect(await q(`puestoId=${PUESTO_BETO}`)).toBe(0);
      expect(await q('q=papa')).toBe(1);
      expect(await q('q=sandia')).toBe(0);
      expect(await q('precioMin=4&precioMax=5')).toBe(1);
      expect(await q('precioMin=4.30')).toBe(0);
    });

    it.each(['limite=51', 'limite=0', 'pagina=0', 'pagina=abc', 'precioMin=-1', 'precioMin=10&precioMax=5', 'categoriaId=x', "puestoId=1'OR'1'='1", 'orden=azar'])('consulta inválida %s → 400', async (s) => {
      await http().get(`/api/v1/catalogo/productos?${s}`).expect(400);
    });

    it('desactivar un producto, o la categoría, lo retira del catálogo', async () => {
      await http().patch(`/api/v1/categorias/${categoriaId}/estado`).set(tok(ADMIN)).send({ activa: false }).expect(200);
      expect((await http().get('/api/v1/catalogo/productos').expect(200)).body.total).toBe(0);
      await http().patch(`/api/v1/categorias/${categoriaId}/estado`).set(tok(ADMIN)).send({ activa: true }).expect(200);
      expect((await http().get('/api/v1/catalogo/productos').expect(200)).body.total).toBe(1);
      await http().patch(`/api/v1/productos/${productoAna}/estado`).set(tok(ANA)).send({ accion: 'DESACTIVAR' }).expect(200);
      expect((await http().get('/api/v1/catalogo/productos').expect(200)).body.total).toBe(0);
      await http().get(`/api/v1/catalogo/productos/${productoAna}`).expect(404);
    });
  });
});
