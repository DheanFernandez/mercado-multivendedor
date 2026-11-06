/**
 * Hito H0 · flujos completos por HTTP: registrar un comerciante y asignarle un puesto, gestionar roles y estados,
 * editar/suspender comerciantes y puestos, y proteger los productos entre comerciantes.
 * Aplicación real con repositorios en memoria (no usa la base de datos ni Supabase).
 */
import { type INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { U, bearer, crearAppEnMemoria, uid } from './helpers/app-en-memoria.js';

describe('H0 · administración de usuarios, comerciantes y puestos (HTTP)', () => {
  let app: INestApplication;
  let h: Awaited<ReturnType<typeof crearAppEnMemoria>>;
  const http = () => request(app.getHttpServer());
  const admin = bearer(U.ADMIN);
  const objetivo = uid(U.OBJETIVO);

  beforeAll(async () => {
    h = await crearAppEnMemoria();
    app = h.app;
  });
  afterAll(() => app.close());

  describe('registrar un comerciante y asignarle un puesto', () => {
    it('el administrador asciende a un usuario a COMERCIANTE; el rol se lee de la base de datos en la siguiente petición', async () => {
      expect((await http().get('/api/v1/auth/me').set(bearer(U.OBJETIVO)).expect(200)).body.rol).toBe('CLIENTE');
      await http().patch(`/api/v1/usuarios/${objetivo}/rol`).set(admin).send({ rol: 'COMERCIANTE' }).expect(200);
      expect((await http().get('/api/v1/auth/me').set(bearer(U.OBJETIVO)).expect(200)).body.rol).toBe('COMERCIANTE');
    });

    it('registra su perfil de comerciante y le asigna un puesto; ya puede ver su puesto', async () => {
      const c = await http().post('/api/v1/comerciantes').set(admin).send({ usuarioId: objetivo, nombreComercial: 'Lácteos Lupe' }).expect(201);
      expect(c.body).toMatchObject({ usuarioId: objetivo, nombreComercial: 'Lácteos Lupe', estado: 'ACTIVO' });
      const p = await http().post('/api/v1/puestos').set(admin).send({ comercianteId: c.body.id, codigo: 'c-7', nombre: 'Lácteos' }).expect(201);
      expect(p.body).toMatchObject({ codigo: 'C-7', comercianteId: c.body.id });
      const propios = await http().get('/api/v1/puestos').set(bearer(U.OBJETIVO)).expect(200);
      expect(propios.body.map((x: { codigo: string }) => x.codigo)).toEqual(['C-7']);
    });

    it('antes del ascenso un cliente no podía recibir perfil de comerciante (400)', async () => {
      await http().post('/api/v1/comerciantes').set(admin).send({ usuarioId: uid(U.CLIENTE), nombreComercial: 'X' }).expect(400);
    });
  });

  describe('roles y estado de los usuarios', () => {
    it('solo el administrador cambia roles y estados; el cliente no puede ascenderse', async () => {
      await http().patch(`/api/v1/usuarios/${uid(U.CLIENTE)}/rol`).set(bearer(U.CLIENTE)).send({ rol: 'ADMINISTRADOR' }).expect(403);
      await http().patch(`/api/v1/usuarios/${uid(U.CLIENTE)}/estado`).set(bearer(U.CLIENTE)).send({ activo: false }).expect(403);
      await http().patch(`/api/v1/usuarios/${uid(U.CLIENTE)}/rol`).send({ rol: 'ADMINISTRADOR' }).expect(401);
      await http().patch(`/api/v1/usuarios/${uid(U.CLIENTE)}/rol`).set(bearer(U.COM_A)).send({ rol: 'ADMINISTRADOR' }).expect(403);
      expect((await http().get('/api/v1/auth/me').set(bearer(U.CLIENTE)).expect(200)).body.rol).toBe('CLIENTE');
    });

    it('el administrador no puede modificar su propia cuenta', async () => {
      await http().patch(`/api/v1/usuarios/${uid(U.ADMIN)}/rol`).set(admin).send({ rol: 'CLIENTE' }).expect(403);
      await http().patch(`/api/v1/usuarios/${uid(U.ADMIN)}/estado`).set(admin).send({ activo: false }).expect(403);
      await http().get('/api/v1/usuarios').set(admin).expect(200);
    });

    it('un usuario desactivado pierde el acceso de inmediato y lo recupera al reactivarlo', async () => {
      await http().patch(`/api/v1/usuarios/${uid(U.TRABAJADOR)}/estado`).set(admin).send({ activo: false }).expect(200);
      await http().get('/api/v1/auth/me').set(bearer(U.TRABAJADOR)).expect(403);
      await http().patch(`/api/v1/usuarios/${uid(U.TRABAJADOR)}/estado`).set(admin).send({ activo: true }).expect(200);
      await http().get('/api/v1/auth/me').set(bearer(U.TRABAJADOR)).expect(200);
    });

    it('valida rol, estado e identificador', async () => {
      await http().patch(`/api/v1/usuarios/${uid(U.TRABAJADOR)}/rol`).set(admin).send({ rol: 'SUPERADMIN' }).expect(400);
      await http().patch(`/api/v1/usuarios/${uid(U.TRABAJADOR)}/rol`).set(admin).send({}).expect(400);
      await http().patch(`/api/v1/usuarios/${uid(U.TRABAJADOR)}/estado`).set(admin).send({ activo: 'si' }).expect(400);
      await http().patch('/api/v1/usuarios/no-uuid/estado').set(admin).send({ activo: true }).expect(400);
      await http().patch(`/api/v1/usuarios/${uid(999)}/estado`).set(admin).send({ activo: true }).expect(404);
    });

    it('las respuestas no exponen el identificador de Supabase', async () => {
      const r = await http().patch(`/api/v1/usuarios/${uid(U.TRABAJADOR)}/estado`).set(admin).send({ activo: true }).expect(200);
      expect(JSON.stringify(r.body)).not.toMatch(/authId|aaaaaaaa/);
    });
  });

  describe('editar y suspender comerciantes', () => {
    it('el administrador edita el nombre comercial (se normaliza); nombre vacío → 400; otros roles → 403', async () => {
      const r = await http().patch(`/api/v1/comerciantes/${h.ids.comercianteA}`).set(admin).send({ nombreComercial: '  Frutas Don Aldo ' }).expect(200);
      expect(r.body.nombreComercial).toBe('Frutas Don Aldo');
      await http().patch(`/api/v1/comerciantes/${h.ids.comercianteA}`).set(admin).send({ nombreComercial: '   ' }).expect(400);
      for (const n of [U.CLIENTE, U.COM_A, U.COM_B]) {
        await http().patch(`/api/v1/comerciantes/${h.ids.comercianteA}`).set(bearer(n)).send({ nombreComercial: 'Robado' }).expect(403);
      }
      expect((await http().get(`/api/v1/comerciantes/${h.ids.comercianteA}`).set(admin)).body.nombreComercial).toBe('Frutas Don Aldo');
    });

    it('al suspender a un comerciante su puesto deja de ser público; al reactivarlo vuelve', async () => {
      const codigos = async () => (await http().get('/api/v1/puestos/publicos').expect(200)).body.map((p: { codigo: string }) => p.codigo);
      expect(await codigos()).toContain('A-1');
      const s = await http().patch(`/api/v1/comerciantes/${h.ids.comercianteA}/estado`).set(admin).send({ activo: false }).expect(200);
      expect(s.body.estado).toBe('SUSPENDIDO');
      expect(await codigos()).not.toContain('A-1');
      expect(await codigos()).toContain('B-1');
      await http().patch(`/api/v1/comerciantes/${h.ids.comercianteA}/estado`).set(admin).send({ activo: true }).expect(200);
      expect(await codigos()).toContain('A-1');
    });

    it('un comerciante suspendido no puede publicar productos (409) y sí al reactivarlo', async () => {
      const borrador = await http().post('/api/v1/productos').set(bearer(U.COM_A)).send({ puestoId: h.ids.puestoA, categoriaId: h.ids.categoria, nombre: 'Papaya', precio: '4.20', unidadVenta: 'KILOGRAMO' }).expect(201);
      await http().patch(`/api/v1/comerciantes/${h.ids.comercianteA}/estado`).set(admin).send({ activo: false }).expect(200);
      await http().patch(`/api/v1/productos/${borrador.body.id}/estado`).set(bearer(U.COM_A)).send({ accion: 'PUBLICAR' }).expect(409);
      await http().patch(`/api/v1/comerciantes/${h.ids.comercianteA}/estado`).set(admin).send({ activo: true }).expect(200);
      await http().patch(`/api/v1/productos/${borrador.body.id}/estado`).set(bearer(U.COM_A)).send({ accion: 'PUBLICAR' }).expect(200);
    });
  });

  describe('editar, reasignar y desactivar puestos', () => {
    it('edita código y nombre (código en mayúsculas); duplicado → 409; inválido → 400', async () => {
      const r = await http().patch(`/api/v1/puestos/${h.ids.puestoB}`).set(admin).send({ codigo: 'b-9', nombre: ' Verduras frescas ' }).expect(200);
      expect(r.body).toMatchObject({ codigo: 'B-9', nombre: 'Verduras frescas' });
      await http().patch(`/api/v1/puestos/${h.ids.puestoB}`).set(admin).send({ codigo: 'a-1' }).expect(409);
      await http().patch(`/api/v1/puestos/${h.ids.puestoB}`).set(admin).send({ codigo: 'b 9!' }).expect(400);
      await http().patch(`/api/v1/puestos/${uid(998)}`).set(admin).send({ nombre: 'x' }).expect(404);
    });

    it('reasigna un puesto a otro comerciante; el nuevo titular lo ve y el anterior ya no', async () => {
      await http().patch(`/api/v1/puestos/${h.ids.puestoB}`).set(admin).send({ comercianteId: h.ids.comercianteA }).expect(200);
      expect((await http().get('/api/v1/puestos').set(bearer(U.COM_A)).expect(200)).body.map((p: { codigo: string }) => p.codigo)).toContain('B-9');
      expect((await http().get('/api/v1/puestos').set(bearer(U.COM_B)).expect(200)).body).toEqual([]);
      await http().patch(`/api/v1/puestos/${h.ids.puestoB}`).set(admin).send({ comercianteId: uid(997) }).expect(404);
    });

    it('al desactivar un puesto deja de ser público; solo el administrador lo hace', async () => {
      await http().patch(`/api/v1/puestos/${h.ids.puestoB}/estado`).set(bearer(U.COM_A)).send({ activo: false }).expect(403);
      await http().patch(`/api/v1/puestos/${h.ids.puestoB}/estado`).set(admin).send({ activo: false }).expect(200);
      expect((await http().get('/api/v1/puestos/publicos').expect(200)).body.map((p: { codigo: string }) => p.codigo)).not.toContain('B-9');
      await http().patch(`/api/v1/puestos/${h.ids.puestoB}/estado`).set(admin).send({ activo: true }).expect(200);
    });

    it('GET /puestos/publicos es público y solo expone id, código y nombre', async () => {
      const r = await http().get('/api/v1/puestos/publicos').expect(200);
      expect(r.body.length).toBeGreaterThan(0);
      for (const p of r.body) expect(Object.keys(p).sort()).toEqual(['codigo', 'id', 'nombre']);
    });
  });

  describe('un comerciante no puede modificar productos de otro', () => {
    // Puesto A pertenece al comerciante A (tras las pruebas anteriores el puesto B también); se usa un producto nuevo del puesto A
    // y el usuario OBJETIVO (comerciante con su propio puesto C-7) como atacante.
    it('el atacante no modifica, publica, desactiva ni altera las imágenes del producto ajeno, que permanece intacto', async () => {
      const antes = JSON.stringify((await h.productos.buscarPorId(h.ids.producto))!.toProps());
      const atacante = bearer(U.OBJETIVO);
      await http().patch(`/api/v1/productos/${h.ids.producto}`).set(atacante).send({ nombre: 'Robado', precio: '0.01' }).expect(403);
      await http().patch(`/api/v1/productos/${h.ids.producto}/estado`).set(atacante).send({ accion: 'DESACTIVAR' }).expect(403);
      await http().post(`/api/v1/productos/${h.ids.producto}/imagenes`).set(atacante).expect(403);
      await http().delete(`/api/v1/productos/${h.ids.producto}/imagenes/${h.ids.imagen}`).set(atacante).expect(403);
      await http().get(`/api/v1/productos/${h.ids.producto}`).set(atacante).expect(403);
      expect(JSON.stringify((await h.productos.buscarPorId(h.ids.producto))!.toProps())).toBe(antes);
    });

    it('tampoco puede crear productos en un puesto ajeno', async () => {
      await http().post('/api/v1/productos').set(bearer(U.OBJETIVO)).send({ puestoId: h.ids.puestoA, categoriaId: h.ids.categoria, nombre: 'Intruso', precio: '1', unidadVenta: 'UNIDAD' }).expect(403);
    });

    it('el titular sí edita su producto: precio exacto', async () => {
      const r = await http().patch(`/api/v1/productos/${h.ids.producto}`).set(bearer(U.COM_A)).send({ precio: '7.25' }).expect(200);
      expect(r.body.precio).toBe('7.25');
    });
  });
});
