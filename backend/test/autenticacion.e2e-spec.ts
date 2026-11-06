/**
 * Pruebas HTTP de autenticación y autorización. Se usa la aplicación real (guard global, controladores,
 * casos de uso y filtro de errores) con repositorios en memoria y un verificador de tokens falso:
 * no se toca la base de datos ni Supabase.
 */
import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module.js';
import { VERIFICADOR_TOKEN, type VerificadorToken } from '../src/modules/auth/application/ports/ports.js';
import { COMERCIANTE_REPOSITORY, PUESTO_REPOSITORY } from '../src/modules/merchants/application/ports/ports.js';
import type { Comerciante } from '../src/modules/merchants/domain/comerciante.entity.js';
import type { Puesto } from '../src/modules/merchants/domain/puesto.entity.js';
import { PROVEEDOR_IDENTIDAD } from '../src/modules/users/application/ports/proveedor-identidad.port.js';
import { USUARIO_REPOSITORY } from '../src/modules/users/application/ports/usuario.repository.js';
import { IdentidadFalsa, UsuariosEnMemoria } from '../src/modules/users/application/use-cases/test-doubles.js';
import { Usuario } from '../src/modules/users/domain/usuario.entity.js';
import { ErrorNoAutenticado } from '../src/shared/domain/errors.js';
import { PrismaService } from '../src/shared/infrastructure/prisma/prisma.service.js';

const uid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const AUTH = (n: number) => `aaaaaaaa-0000-4000-8000-${String(n).padStart(12, '0')}`;
const bearer = (n: number) => ({ Authorization: `Bearer tok:${AUTH(n)}` });

const verificador: VerificadorToken = {
  async verificar(token) {
    const m = /^tok:([0-9a-f-]{36})$/.exec(token);
    if (!m) throw new ErrorNoAutenticado('Sesión inválida o expirada.');
    return { authId: m[1] };
  },
};

class ComerciantesMem {
  datos: Comerciante[] = [];
  async guardar(c: Comerciante) { this.datos.push(c); }
  async buscarPorId(id: string) { return this.datos.find((c) => c.id === id) ?? null; }
  async buscarPorUsuarioId(u: string) { return this.datos.find((c) => c.usuarioId === u) ?? null; }
  async listar() { return this.datos; }
}
class PuestosMem {
  datos: Puesto[] = [];
  async guardar(p: Puesto) { this.datos.push(p); }
  async buscarPorId(id: string) { return this.datos.find((p) => p.id === id) ?? null; }
  async listar({ comercianteId }: { comercianteId?: string }) { return this.datos.filter((p) => !comercianteId || p.comercianteId === comercianteId); }
}

describe('Autenticación y autorización (HTTP)', () => {
  let app: INestApplication;
  const usuarios = new UsuariosEnMemoria();
  const siembra = (n: number, rol: Usuario['rol'], estado: 'ACTIVO' | 'INACTIVO' = 'ACTIVO') =>
    usuarios.datos.set(uid(n), Usuario.reconstruir({ id: uid(n), email: `u${n}@t.co`, nombres: 'N', apellidos: 'A', telefono: null, rol, estado, authId: AUTH(n), creadoEn: new Date() }));

  beforeAll(async () => {
    siembra(1, 'ADMINISTRADOR');
    siembra(2, 'CLIENTE');
    siembra(3, 'COMERCIANTE');
    siembra(4, 'CLIENTE', 'INACTIVO');
    const modulo = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService).useValue({})
      .overrideProvider(USUARIO_REPOSITORY).useValue(usuarios)
      .overrideProvider(COMERCIANTE_REPOSITORY).useValue(new ComerciantesMem())
      .overrideProvider(PUESTO_REPOSITORY).useValue(new PuestosMem())
      .overrideProvider(PROVEEDOR_IDENTIDAD).useValue(new IdentidadFalsa())
      .overrideProvider(VERIFICADOR_TOKEN).useValue(verificador)
      .compile();
    app = modulo.createNestApplication();
    await app.init();
  });
  afterAll(() => app.close());
  const http = () => request(app.getHttpServer());

  describe('rutas protegidas sin sesión válida', () => {
    it.each(['/api/v1/auth/me', '/api/v1/usuarios', `/api/v1/usuarios/${uid(2)}`, '/api/v1/comerciantes', '/api/v1/puestos'])('GET %s sin token → 401', async (ruta) => {
      const r = await http().get(ruta).expect(401);
      expect(r.body.codigo).toBe('NO_AUTENTICADO');
    });

    it.each(['/api/v1/usuarios', '/api/v1/comerciantes', '/api/v1/puestos'])('POST %s sin token → 401', (ruta) => http().post(ruta).send({}).expect(401));

    it('token inválido, esquema incorrecto o cabecera vacía → 401', async () => {
      await http().get('/api/v1/auth/me').set('Authorization', 'Bearer basura').expect(401);
      await http().get('/api/v1/auth/me').set('Authorization', `Basic tok:${AUTH(1)}`).expect(401);
      await http().get('/api/v1/auth/me').set('Authorization', 'Bearer').expect(401);
    });

    it('las cabeceras de desarrollo ya no autentican a nadie', async () => {
      await http().get('/api/v1/usuarios').set('x-dev-user-id', uid(1)).set('x-dev-user-role', 'ADMINISTRADOR').expect(401);
    });

    it('token válido de una identidad sin perfil vinculado → 403', async () => {
      await http().get('/api/v1/auth/me').set('Authorization', `Bearer tok:${AUTH(99)}`).expect(403);
    });

    it('cuenta desactivada → 403', async () => {
      await http().get('/api/v1/auth/me').set(bearer(4)).expect(403);
    });

    it('la ruta pública raíz sigue accesible', () => http().get('/').expect(200));
  });

  describe('roles obtenidos de PostgreSQL', () => {
    it('GET /auth/me devuelve el perfil y el rol de la base de datos, sin authId', async () => {
      const r = await http().get('/api/v1/auth/me').set(bearer(3)).expect(200);
      expect(r.body).toMatchObject({ id: uid(3), rol: 'COMERCIANTE' });
      expect(r.body.authId).toBeUndefined();
    });

    it('un cliente no accede a rutas de administración', async () => {
      await http().get('/api/v1/usuarios').set(bearer(2)).expect(403);
      await http().get('/api/v1/comerciantes').set(bearer(2)).expect(403);
      await http().post('/api/v1/comerciantes').set(bearer(2)).send({ usuarioId: uid(3), nombreComercial: 'X' }).expect(403);
      await http().post('/api/v1/puestos').set(bearer(2)).send({ comercianteId: uid(3), codigo: 'A1', nombre: 'X' }).expect(403);
      await http().post('/api/v1/usuarios').set(bearer(2)).send({ email: 'z@t.co', nombres: 'Z', apellidos: 'Z', rol: 'ADMINISTRADOR' }).expect(403);
    });

    it('un cliente solo consulta su propio perfil', async () => {
      await http().get(`/api/v1/usuarios/${uid(2)}`).set(bearer(2)).expect(200);
      await http().get(`/api/v1/usuarios/${uid(3)}`).set(bearer(2)).expect(403);
    });

    it('un id mal formado → 400', () => http().get('/api/v1/usuarios/no-es-uuid').set(bearer(1)).expect(400));

    it('el administrador lista usuarios sin exponer authId', async () => {
      const r = await http().get('/api/v1/usuarios').set(bearer(1)).expect(200);
      expect(r.body.length).toBeGreaterThanOrEqual(4);
      expect(JSON.stringify(r.body)).not.toContain('aaaaaaaa-0000');
    });
  });

  describe('autorregistro', () => {
    const cuerpo = { email: 'Nuevo@Correo.com', contrasena: 'clave-segura-1', nombres: 'Nuevo', apellidos: 'Cliente' };

    it('crea únicamente CLIENTE aunque se envíe otro rol (sin sesión)', async () => {
      const r = await http().post('/api/v1/auth/registro').send({ ...cuerpo, rol: 'ADMINISTRADOR' }).expect(201);
      expect(r.body).toMatchObject({ email: 'nuevo@correo.com', rol: 'CLIENTE' });
      expect(JSON.stringify(r.body)).not.toContain('clave-segura-1');
      expect(r.body.authId).toBeUndefined();
    });

    it('rechaza correo duplicado (409), contraseña corta y datos inválidos (400)', async () => {
      await http().post('/api/v1/auth/registro').send(cuerpo).expect(409);
      await http().post('/api/v1/auth/registro').send({ ...cuerpo, email: 'otro@correo.com', contrasena: 'corta' }).expect(400);
      await http().post('/api/v1/auth/registro').send({ ...cuerpo, email: 'malo' }).expect(400);
      await http().post('/api/v1/auth/registro').send({}).expect(400);
    });
  });

  describe('flujo de administración', () => {
    it('el administrador da de alta un comerciante, su perfil y su puesto; el comerciante solo ve lo suyo', async () => {
      const alta = await http().post('/api/v1/usuarios').set(bearer(1)).send({ email: 'com@t.co', nombres: 'Rosa', apellidos: 'Díaz', rol: 'COMERCIANTE' }).expect(201);
      expect(alta.body.rol).toBe('COMERCIANTE');
      const perfil = await http().post('/api/v1/comerciantes').set(bearer(1)).send({ usuarioId: alta.body.id, nombreComercial: 'Frutas Rosa' }).expect(201);
      await http().post('/api/v1/puestos').set(bearer(1)).send({ comercianteId: perfil.body.id, codigo: 'a-1', nombre: 'Frutas' }).expect(201);

      // El comerciante invitado inicia sesión: su authId lo asignó el proveedor de identidad (IdentidadFalsa).
      const authIdInvitado = [...usuarios.datos.values()].find((u) => u.email === 'com@t.co')!.authId!;
      const propio = { Authorization: `Bearer tok:${authIdInvitado}` };
      const puestos = await http().get('/api/v1/puestos').set(propio).expect(200);
      expect(puestos.body.map((p: { codigo: string }) => p.codigo)).toEqual(['A-1']);
      await http().get('/api/v1/comerciantes').set(propio).expect(403);
      await http().post('/api/v1/puestos').set(propio).send({ comercianteId: perfil.body.id, codigo: 'B-1', nombre: 'X' }).expect(403);
      await http().get(`/api/v1/comerciantes/${perfil.body.id}`).set(propio).expect(200);
    });
  });
});
