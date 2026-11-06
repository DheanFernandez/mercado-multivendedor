/**
 * Inventario por HTTP (HU14, HU15; RF12–RF15; AC04/AC12): aplicación real con repositorios en memoria.
 * No usa la base de datos ni Supabase. La concurrencia real se prueba en inventario.db-spec.ts.
 */
import { type INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { U, bearer, crearAppEnMemoria } from './helpers/app-en-memoria.js';

describe('Inventario (HTTP)', () => {
  let app: INestApplication;
  let h: Awaited<ReturnType<typeof crearAppEnMemoria>>;
  const http = () => request(app.getHttpServer());
  const base = () => `/api/v1/inventario/productos/${h.ids.producto}`;
  const titular = bearer(U.COM_A);
  const ajeno = bearer(U.COM_B);

  beforeAll(async () => {
    h = await crearAppEnMemoria();
    app = h.app;
  });
  afterAll(() => app.close());

  it('sin autenticar: 401', async () => {
    await http().get(base()).expect(401);
    await http().post(`${base()}/movimientos`).send({ tipo: 'INGRESO', cantidad: 1 }).expect(401);
  });

  it('un producto sin existencias registradas se muestra con ceros', async () => {
    const r = await http().get(base()).set(titular).expect(200);
    expect(r.body).toMatchObject({ stockFisico: 0, stockReservado: 0, stockDisponible: 0 });
  });

  it('el titular registra un ingreso y un ajuste; el stock y los movimientos se actualizan', async () => {
    const i = await http().post(`${base()}/movimientos`).set(titular).send({ tipo: 'INGRESO', cantidad: 20 }).expect(201);
    expect(i.body).toMatchObject({ stockFisico: 20, stockReservado: 0, stockDisponible: 20 });
    const a = await http().post(`${base()}/movimientos`).set(titular).send({ tipo: 'AJUSTE', cantidad: -2, motivo: 'merma' }).expect(201);
    expect(a.body.stockFisico).toBe(18);
    const m = await http().get(`${base()}/movimientos`).set(titular).expect(200);
    expect(m.body.total).toBe(2);
    expect(m.body.datos[0]).toMatchObject({ tipo: 'AJUSTE', variacionFisica: -2, stockFisicoDespues: 18, motivo: 'merma' });
  });

  it('entradas inválidas: 400 (tipo, cantidad no entera, ajuste sin motivo) y stock físico por debajo de lo reservado: 409', async () => {
    await http().post(`${base()}/movimientos`).set(titular).send({ tipo: 'VENTA', cantidad: 1 }).expect(400);
    await http().post(`${base()}/movimientos`).set(titular).send({ tipo: 'INGRESO', cantidad: 1.5 }).expect(400);
    await http().post(`${base()}/movimientos`).set(titular).send({ tipo: 'AJUSTE', cantidad: -1 }).expect(400);
    await http().post(`${base()}/movimientos`).set(titular).send({}).expect(400);
    const r = await http().post(`${base()}/movimientos`).set(titular).send({ tipo: 'AJUSTE', cantidad: -999, motivo: 'x' }).expect(409);
    expect(r.body.mensaje ?? r.body.message).toMatch(/stock físico/i);
  });

  it('el stock reservado y el disponible se reflejan en la consulta', async () => {
    await h.inventario.reservar({ claveOperacion: 'pedido-http', items: [{ productoId: h.ids.producto, cantidad: 5 }], expiraEn: new Date(Date.now() + 60_000) });
    const r = await http().get(base()).set(titular).expect(200);
    expect(r.body).toMatchObject({ stockFisico: 18, stockReservado: 5, stockDisponible: 13 });
    await http().post(`${base()}/movimientos`).set(titular).send({ tipo: 'AJUSTE', cantidad: -14, motivo: 'x' }).expect(409);
  });

  it('acceso cruzado (AC12): el comerciante B no lee ni modifica el inventario de A', async () => {
    await http().get(base()).set(ajeno).expect(403);
    await http().get(`${base()}/movimientos`).set(ajeno).expect(403);
    await http().post(`${base()}/movimientos`).set(ajeno).send({ tipo: 'INGRESO', cantidad: 1000 }).expect(403);
    expect((await http().get(base()).set(titular).expect(200)).body.stockFisico).toBe(18);
    const lista = await http().get('/api/v1/inventario').set(ajeno).expect(200);
    expect(lista.body.total).toBe(0);
    await http().get(`/api/v1/inventario?puestoId=${h.ids.puestoA}`).set(ajeno).expect(403);
  });

  it('roles sin permiso: cliente y trabajador 403; el administrador lee pero no escribe', async () => {
    for (const n of [U.CLIENTE, U.TRABAJADOR]) {
      await http().get(base()).set(bearer(n)).expect(403);
      await http().get('/api/v1/inventario').set(bearer(n)).expect(403);
      await http().post(`${base()}/movimientos`).set(bearer(n)).send({ tipo: 'INGRESO', cantidad: 1 }).expect(403);
    }
    await http().get(base()).set(bearer(U.ADMIN)).expect(200);
    expect((await http().get('/api/v1/inventario').set(bearer(U.ADMIN)).expect(200)).body.total).toBe(1);
    await http().post(`${base()}/movimientos`).set(bearer(U.ADMIN)).send({ tipo: 'INGRESO', cantidad: 1 }).expect(403);
  });

  it('producto inexistente o identificador malformado: 404', async () => {
    await http().get('/api/v1/inventario/productos/00000000-0000-4000-8000-0000000009ff').set(titular).expect(404);
    await http().get('/api/v1/inventario/productos/abc').set(titular).expect(404);
  });
});
