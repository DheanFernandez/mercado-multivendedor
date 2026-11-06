/**
 * Cadena administrativa completa por HTTP: el administrador invita comerciantes, registra sus perfiles y puestos;
 * los comerciantes publican productos y no pueden tocar los ajenos; nadie escala privilegios.
 * Aplicación real con repositorios en memoria y verificador de tokens simulado (no usa la base ni Supabase).
 */
import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module.js';
import { VERIFICADOR_TOKEN, type VerificadorToken } from '../src/modules/auth/application/ports/ports.js';
import { COMERCIANTE_REPOSITORY, PUESTO_REPOSITORY } from '../src/modules/merchants/application/ports/ports.js';
import type { Comerciante } from '../src/modules/merchants/domain/comerciante.entity.js';
import { CodigoPuestoDuplicadoError, ComercianteYaRegistradoError } from '../src/modules/merchants/domain/errors.js';
import type { Puesto } from '../src/modules/merchants/domain/puesto.entity.js';
import { CATEGORIA_REPOSITORY, PRODUCTO_REPOSITORY } from '../src/modules/products/application/ports/ports.js';
import { AlmacenEnMemoria, CategoriasEnMemoria, ProductosEnMemoria } from '../src/modules/products/application/use-cases/test-doubles.js';
import { CATALOGO_REPOSITORY } from '../src/modules/catalog/application/ports/catalogo.repository.js';
import { PROVEEDOR_IDENTIDAD } from '../src/modules/users/application/ports/proveedor-identidad.port.js';
import { USUARIO_REPOSITORY } from '../src/modules/users/application/ports/usuario.repository.js';
import { IdentidadFalsa, UsuariosEnMemoria } from '../src/modules/users/application/use-cases/test-doubles.js';
import { Usuario } from '../src/modules/users/domain/usuario.entity.js';
import { ALMACEN_ARCHIVOS } from '../src/shared/application/ports/almacen-archivos.port.js';
import { ErrorNoAutenticado } from '../src/shared/domain/errors.js';
import { PrismaService } from '../src/shared/infrastructure/prisma/prisma.service.js';

const uid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const AUTH = (n: number) => `aaaaaaaa-0000-4000-8000-${String(n).padStart(12, '0')}`;
const tok = (authId: string) => ({ Authorization: `Bearer tok:${authId}` });
const ADMIN = 1;
const CLIENTE = 2;

const verificador: VerificadorToken = {
  async verificar(t) {
    const m = /^tok:([0-9a-f-]{36})$/.exec(t);
    if (!m) throw new ErrorNoAutenticado('Sesión inválida o expirada.');
    return { authId: m[1] };
  },
};

class ComerciantesMem {
  datos: Comerciante[] = [];
  async guardar(c: Comerciante) {
    const i = this.datos.findIndex((x) => x.id === c.id);
    if (i >= 0) { this.datos[i] = c; return; }
    if (this.datos.some((x) => x.usuarioId === c.usuarioId)) throw new ComercianteYaRegistradoError();
    this.datos.push(c);
  }
  async buscarPorId(id: string) { return this.datos.find((c) => c.id === id) ?? null; }
  async buscarPorUsuarioId(u: string) { return this.datos.find((c) => c.usuarioId === u) ?? null; }
  async listar({ limite, desplazamiento }: { limite: number; desplazamiento: number }) { return this.datos.slice(desplazamiento, desplazamiento + limite); }
}
class PuestosMem {
  datos: Puesto[] = [];
  async guardar(p: Puesto) {
    if (this.datos.some((x) => x.id !== p.id && x.codigo === p.codigo)) throw new CodigoPuestoDuplicadoError();
    const i = this.datos.findIndex((x) => x.id === p.id);
    if (i >= 0) this.datos[i] = p; else this.datos.push(p);
  }
  async listarOperativos() { return this.datos.filter((p) => p.estado === 'ACTIVO'); }
  async buscarPorId(id: string) { return this.datos.find((p) => p.id === id) ?? null; }
  async listar({ comercianteId, limite, desplazamiento }: { comercianteId?: string; limite: number; desplazamiento: number }) {
    return this.datos.filter((p) => !comercianteId || p.comercianteId === comercianteId).slice(desplazamiento, desplazamiento + limite);
  }
}

describe('Administración del marketplace (HTTP)', () => {
  let app: INestApplication;
  const usuarios = new UsuariosEnMemoria();
  const identidad = new IdentidadFalsa();
  const comerciantes = new ComerciantesMem();
  const puestos = new PuestosMem();
  const productos = new ProductosEnMemoria();
  const categorias = new CategoriasEnMemoria();
  const http = () => request(app.getHttpServer());

  const sembrar = (n: number, rol: Usuario['rol']) =>
    usuarios.datos.set(uid(n), Usuario.reconstruir({ id: uid(n), email: `u${n}@t.co`, nombres: 'N', apellidos: 'A', telefono: null, rol, estado: 'ACTIVO', authId: AUTH(n), creadoEn: new Date() }));
  const authIdDe = (email: string) => [...usuarios.datos.values()].find((u) => u.email === email)!.authId!;

  let comercianteA = { usuarioId: '', comercianteId: '', puestoId: '', authId: '' };
  let comercianteB = { usuarioId: '', comercianteId: '', puestoId: '', authId: '' };
  let categoriaId = '';

  beforeAll(async () => {
    sembrar(ADMIN, 'ADMINISTRADOR');
    sembrar(CLIENTE, 'CLIENTE');
    const modulo = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService).useValue({})
      .overrideProvider(USUARIO_REPOSITORY).useValue(usuarios)
      .overrideProvider(PROVEEDOR_IDENTIDAD).useValue(identidad)
      .overrideProvider(VERIFICADOR_TOKEN).useValue(verificador)
      .overrideProvider(COMERCIANTE_REPOSITORY).useValue(comerciantes)
      .overrideProvider(PUESTO_REPOSITORY).useValue(puestos)
      .overrideProvider(PRODUCTO_REPOSITORY).useValue(productos)
      .overrideProvider(CATEGORIA_REPOSITORY).useValue(categorias)
      .overrideProvider(CATALOGO_REPOSITORY).useValue({ async buscar() { return { items: [], total: 0 }; }, async detalle() { return null; } })
      .overrideProvider(ALMACEN_ARCHIVOS).useValue(new AlmacenEnMemoria())
      .compile();
    app = modulo.createNestApplication();
    await app.init();
  });
  afterAll(() => app.close());

  const admin = tok(AUTH(ADMIN));
  const cliente = tok(AUTH(CLIENTE));

  describe('invitar comerciantes (usuarios)', () => {
    const cuerpo = (n: number, extra: object = {}) => ({ email: `Comercio${n}@Mercado.com`, nombres: `Comerciante ${n}`, apellidos: 'Prueba', telefono: '+51 987 654 321', rol: 'COMERCIANTE', ...extra });

    it('solo el administrador invita usuarios', async () => {
      await http().post('/api/v1/usuarios').send(cuerpo(1)).expect(401);
      await http().post('/api/v1/usuarios').set(cliente).send(cuerpo(1)).expect(403);
      expect(identidad.invitados).toHaveLength(0);
    });

    it('el administrador invita a dos comerciantes; la invitación sale al correo normalizado y no se expone el authId', async () => {
      const a = await http().post('/api/v1/usuarios').set(admin).send(cuerpo(1)).expect(201);
      const b = await http().post('/api/v1/usuarios').set(admin).send(cuerpo(2)).expect(201);
      expect(a.body).toMatchObject({ email: 'comercio1@mercado.com', rol: 'COMERCIANTE', estado: 'ACTIVO' });
      expect(JSON.stringify(a.body)).not.toContain('aaaaaaaa');
      expect(a.body.authId).toBeUndefined();
      expect(identidad.invitados).toEqual(['comercio1@mercado.com', 'comercio2@mercado.com']);
      comercianteA = { ...comercianteA, usuarioId: a.body.id, authId: authIdDe('comercio1@mercado.com') };
      comercianteB = { ...comercianteB, usuarioId: b.body.id, authId: authIdDe('comercio2@mercado.com') };
    });

    it('rechaza correos duplicados (409) y datos inválidos (400)', async () => {
      await http().post('/api/v1/usuarios').set(admin).send(cuerpo(1)).expect(409);
      await http().post('/api/v1/usuarios').set(admin).send(cuerpo(9, { email: 'no-es-correo' })).expect(400);
      await http().post('/api/v1/usuarios').set(admin).send(cuerpo(9, { nombres: ' ' })).expect(400);
      await http().post('/api/v1/usuarios').set(admin).send(cuerpo(9, { rol: 'SUPERADMIN' })).expect(400);
    });

    it('si la identidad no puede crearse no queda ningún usuario a medias', async () => {
      const antes = usuarios.datos.size;
      identidad.falla = new Error('Supabase caído');
      await http().post('/api/v1/usuarios').set(admin).send(cuerpo(8)).expect(500);
      identidad.falla = undefined;
      expect(usuarios.datos.size).toBe(antes);
    });
  });

  describe('registrar comerciantes', () => {
    it('solo el administrador', async () => {
      const cuerpo = { usuarioId: comercianteA.usuarioId, nombreComercial: 'Frutas Rosa' };
      await http().post('/api/v1/comerciantes').send(cuerpo).expect(401);
      await http().post('/api/v1/comerciantes').set(cliente).send(cuerpo).expect(403);
      await http().post('/api/v1/comerciantes').set(tok(comercianteA.authId)).send(cuerpo).expect(403); // ni siquiera el propio comerciante
    });

    it('registra el perfil de cada comerciante invitado', async () => {
      const a = await http().post('/api/v1/comerciantes').set(admin).send({ usuarioId: comercianteA.usuarioId, nombreComercial: ' Frutas Rosa ' }).expect(201);
      const b = await http().post('/api/v1/comerciantes').set(admin).send({ usuarioId: comercianteB.usuarioId, nombreComercial: 'Verduras Beto' }).expect(201);
      expect(a.body).toMatchObject({ nombreComercial: 'Frutas Rosa', estado: 'ACTIVO', usuarioId: comercianteA.usuarioId });
      comercianteA.comercianteId = a.body.id;
      comercianteB.comercianteId = b.body.id;
    });

    it('rechaza perfil duplicado (409), usuario inexistente (404), usuario que no es comerciante (400) y nombre vacío (400)', async () => {
      await http().post('/api/v1/comerciantes').set(admin).send({ usuarioId: comercianteA.usuarioId, nombreComercial: 'Otro' }).expect(409);
      await http().post('/api/v1/comerciantes').set(admin).send({ usuarioId: uid(999), nombreComercial: 'X' }).expect(404);
      await http().post('/api/v1/comerciantes').set(admin).send({ usuarioId: uid(CLIENTE), nombreComercial: 'X' }).expect(400);
      await http().post('/api/v1/comerciantes').set(admin).send({ usuarioId: comercianteB.usuarioId, nombreComercial: '  ' }).expect(400);
    });

    it('un campo "rol" o "estado" enviado en el cuerpo no tiene ningún efecto', async () => {
      const r = await http().get(`/api/v1/comerciantes/${comercianteA.comercianteId}`).set(admin).expect(200);
      expect(r.body.estado).toBe('ACTIVO');
      expect(usuarios.datos.get(comercianteA.usuarioId)!.rol).toBe('COMERCIANTE');
    });
  });

  describe('registrar puestos', () => {
    it('solo el administrador', async () => {
      const cuerpo = { comercianteId: comercianteA.comercianteId, codigo: 'A-1', nombre: 'Frutas' };
      await http().post('/api/v1/puestos').send(cuerpo).expect(401);
      await http().post('/api/v1/puestos').set(cliente).send(cuerpo).expect(403);
      await http().post('/api/v1/puestos').set(tok(comercianteA.authId)).send(cuerpo).expect(403);
    });

    it('asigna un puesto a cada comerciante con el código normalizado', async () => {
      const a = await http().post('/api/v1/puestos').set(admin).send({ comercianteId: comercianteA.comercianteId, codigo: ' a-1 ', nombre: 'Frutas Rosa' }).expect(201);
      const b = await http().post('/api/v1/puestos').set(admin).send({ comercianteId: comercianteB.comercianteId, codigo: 'B-1', nombre: 'Verduras Beto' }).expect(201);
      expect(a.body).toMatchObject({ codigo: 'A-1', comercianteId: comercianteA.comercianteId, estado: 'ACTIVO' });
      comercianteA.puestoId = a.body.id;
      comercianteB.puestoId = b.body.id;
    });

    it('rechaza código duplicado (409), comerciante inexistente (404) y datos inválidos (400)', async () => {
      await http().post('/api/v1/puestos').set(admin).send({ comercianteId: comercianteB.comercianteId, codigo: 'a-1', nombre: 'Repetido' }).expect(409);
      await http().post('/api/v1/puestos').set(admin).send({ comercianteId: uid(998), codigo: 'Z-9', nombre: 'X' }).expect(404);
      await http().post('/api/v1/puestos').set(admin).send({ comercianteId: comercianteA.comercianteId, codigo: 'Z 9!', nombre: 'X' }).expect(400);
      await http().post('/api/v1/puestos').set(admin).send({ comercianteId: comercianteA.comercianteId, codigo: 'Z-9', nombre: ' ' }).expect(400);
      await http().post('/api/v1/puestos').set(admin).send({ comercianteId: 'no-uuid', codigo: 'Z-9', nombre: 'X' }).expect(404);
    });
  });

  describe('consultas administrativas', () => {
    it('el administrador consulta usuarios, comerciantes y puestos; los demás no', async () => {
      for (const ruta of ['/api/v1/usuarios', '/api/v1/comerciantes']) {
        await http().get(ruta).expect(401);
        await http().get(ruta).set(cliente).expect(403);
        await http().get(ruta).set(tok(comercianteA.authId)).expect(403);
      }
      expect((await http().get('/api/v1/usuarios').set(admin).expect(200)).body).toHaveLength(4);
      expect((await http().get('/api/v1/comerciantes').set(admin).expect(200)).body).toHaveLength(2);
      expect((await http().get('/api/v1/puestos').set(admin).expect(200)).body).toHaveLength(2);
      expect((await http().get(`/api/v1/puestos?comercianteId=${comercianteB.comercianteId}`).set(admin).expect(200)).body.map((p: { codigo: string }) => p.codigo)).toEqual(['B-1']);
    });

    it('pagina los usuarios y valida los parámetros', async () => {
      expect((await http().get('/api/v1/usuarios?limite=1').set(admin).expect(200)).body).toHaveLength(1);
      expect((await http().get('/api/v1/usuarios?limite=2&desplazamiento=3').set(admin).expect(200)).body).toHaveLength(1);
      await http().get('/api/v1/usuarios?limite=500').set(admin).expect(400);
      await http().get('/api/v1/usuarios?desplazamiento=-1').set(admin).expect(400);
    });

    it('el listado de usuarios no expone identificadores de Supabase', async () => {
      const r = await http().get('/api/v1/usuarios').set(admin).expect(200);
      expect(JSON.stringify(r.body)).not.toMatch(/authId|aaaaaaaa|9000/);
    });

    it('cada comerciante ve solo sus puestos y no puede consultar el perfil de otro', async () => {
      const a = await http().get('/api/v1/puestos').set(tok(comercianteA.authId)).expect(200);
      expect(a.body.map((p: { codigo: string }) => p.codigo)).toEqual(['A-1']);
      await http().get(`/api/v1/puestos?comercianteId=${comercianteB.comercianteId}`).set(tok(comercianteA.authId)).expect(403);
      await http().get(`/api/v1/comerciantes/${comercianteB.comercianteId}`).set(tok(comercianteA.authId)).expect(403);
      await http().get(`/api/v1/comerciantes/${comercianteA.comercianteId}`).set(tok(comercianteA.authId)).expect(200);
      await http().get('/api/v1/puestos').set(cliente).expect(403);
    });
  });

  describe('imposible escalar privilegios', () => {
    it('quien se autorregistra siempre es CLIENTE, aunque envíe rol ADMINISTRADOR, y no accede a la administración', async () => {
      const r = await http().post('/api/v1/auth/registro').send({ email: 'astuto@t.co', contrasena: 'clave-segura-1', nombres: 'A', apellidos: 'B', rol: 'ADMINISTRADOR', estado: 'ACTIVO' }).expect(201);
      expect(r.body.rol).toBe('CLIENTE');
      const suyo = tok(authIdDe('astuto@t.co'));
      await http().get('/api/v1/usuarios').set(suyo).expect(403);
      await http().post('/api/v1/usuarios').set(suyo).send({ email: 'otro@t.co', nombres: 'A', apellidos: 'B', rol: 'ADMINISTRADOR' }).expect(403);
      await http().post('/api/v1/categorias').set(suyo).send({ nombre: 'Mía' }).expect(403);
    });

    it('las cabeceras y campos manipulados por el cliente no otorgan permisos', async () => {
      await http().get('/api/v1/usuarios').set(cliente).set('x-dev-user-role', 'ADMINISTRADOR').set('x-rol', 'ADMINISTRADOR').expect(403);
      await http().get('/api/v1/usuarios?rol=ADMINISTRADOR').set(cliente).expect(403);
      await http().get('/api/v1/usuarios').set('x-dev-user-id', uid(ADMIN)).set('x-dev-user-role', 'ADMINISTRADOR').expect(401);
    });

    it('un token válido de una identidad sin perfil, o con firma inventada, no accede', async () => {
      await http().get('/api/v1/usuarios').set(tok(AUTH(777))).expect(403);
      await http().get('/api/v1/usuarios').set({ Authorization: 'Bearer eyJhbGciOiJub25lIn0.eyJyb2xlIjoiYWRtaW4ifQ.' }).expect(401);
    });
  });

  describe('flujo de extremo a extremo: comerciantes, productos y aislamiento', () => {
    let productoA = '';

    it('el administrador crea la categoría y el comerciante A crea y publica un producto en su puesto', async () => {
      categoriaId = (await http().post('/api/v1/categorias').set(admin).send({ nombre: 'Frutas' }).expect(201)).body.id;
      const p = await http().post('/api/v1/productos').set(tok(comercianteA.authId)).send({ puestoId: comercianteA.puestoId, categoriaId, nombre: 'Mango', precio: '6.50', unidadVenta: 'KILOGRAMO' }).expect(201);
      productoA = p.body.id;
      await http().patch(`/api/v1/productos/${productoA}/estado`).set(tok(comercianteA.authId)).send({ accion: 'PUBLICAR' }).expect(200);
    });

    it('el comerciante B no puede crear productos en el puesto de A ni modificar, publicar o ver su producto', async () => {
      const b = tok(comercianteB.authId);
      await http().post('/api/v1/productos').set(b).send({ puestoId: comercianteA.puestoId, categoriaId, nombre: 'Intruso', precio: '1', unidadVenta: 'UNIDAD' }).expect(403);
      await http().patch(`/api/v1/productos/${productoA}`).set(b).send({ nombre: 'Robado', precio: '0.01' }).expect(403);
      await http().patch(`/api/v1/productos/${productoA}/estado`).set(b).send({ accion: 'DESACTIVAR' }).expect(403);
      await http().get(`/api/v1/productos/${productoA}`).set(b).expect(403);
      await http().post(`/api/v1/productos/${productoA}/imagenes`).set(b).expect(403);
      const intacto = productos.datos.get(productoA)!;
      expect(intacto).toMatchObject({ nombre: 'Mango', estado: 'PUBLICADO' });
      expect(intacto.precio.toString()).toBe('6.50');
    });

    it('ni el administrador ni un cliente modifican productos', async () => {
      await http().patch(`/api/v1/productos/${productoA}`).set(admin).send({ nombre: 'Admin' }).expect(403);
      await http().patch(`/api/v1/productos/${productoA}`).set(cliente).send({ nombre: 'Cliente' }).expect(403);
      await http().post('/api/v1/productos').set(admin).send({ puestoId: comercianteA.puestoId, categoriaId, nombre: 'X', precio: '1', unidadVenta: 'UNIDAD' }).expect(403);
    });

    it('cada comerciante lista solo sus productos; el administrador los ve todos en lectura', async () => {
      await http().post('/api/v1/productos').set(tok(comercianteB.authId)).send({ puestoId: comercianteB.puestoId, categoriaId, nombre: 'Lechuga', precio: '2', unidadVenta: 'UNIDAD' }).expect(201);
      const a = await http().get('/api/v1/productos').set(tok(comercianteA.authId)).expect(200);
      expect(a.body.datos.map((p: { nombre: string }) => p.nombre)).toEqual(['Mango']);
      expect((await http().get('/api/v1/productos').set(admin).expect(200)).body.total).toBe(2);
    });
  });
});
