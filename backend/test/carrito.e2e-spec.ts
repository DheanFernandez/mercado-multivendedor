/**
 * Carrito multivendedor por HTTP (HU04–HU06; RF20–RF24; AC04): aplicación real con repositorios en memoria.
 * Catálogo, inventario y carrito se integran por sus APIs públicas (adaptadores reales). Sin base de datos ni Supabase.
 */
import { type INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Producto } from '../src/modules/products/domain/producto.entity.js';
import { U, bearer, crearAppEnMemoria, uid } from './helpers/app-en-memoria.js';

describe('Carrito multivendedor (HTTP)', () => {
  let app: INestApplication;
  let h: Awaited<ReturnType<typeof crearAppEnMemoria>>;
  const http = () => request(app.getHttpServer());
  const cliente = bearer(U.CLIENTE);
  const otroCliente = bearer(U.OBJETIVO); // segundo usuario con rol CLIENTE
  const MANGO = uid(501);
  const PAPA = uid(502);   // puesto B, 2.25
  const BORRADOR = uid(503);
  const SIN_STOCK = uid(504);

  const publicar = async (id: string, puestoId: string, nombre: string, precio: string) => {
    const p = Producto.crear({ id, puestoId, categoriaId: h.ids.categoria, nombre, precio, unidadVenta: 'KILOGRAMO' });
    p.publicar();
    await h.productos.guardar(p);
  };
  const stock = (productoId: string, puestoId: string, delta: number) =>
    h.inventario.variarStock({ productoId, puestoId, tipo: 'INGRESO', delta, motivo: null, actorId: uid(U.COM_A) });

  beforeAll(async () => {
    h = await crearAppEnMemoria();
    app = h.app;
    const mango = (await h.productos.buscarPorId(MANGO))!;
    mango.publicar();
    await h.productos.guardar(mango);
    await publicar(PAPA, h.ids.puestoB, 'Papa', '2.25');
    await publicar(SIN_STOCK, h.ids.puestoB, 'Palta', '12.00');
    await h.productos.guardar(Producto.crear({ id: BORRADOR, puestoId: h.ids.puestoA, categoriaId: h.ids.categoria, nombre: 'Borrador', precio: '1.00', unidadVenta: 'UNIDAD' }));
    await stock(MANGO, h.ids.puestoA, 10);
    await stock(PAPA, h.ids.puestoB, 20);
    await stock(BORRADOR, h.ids.puestoA, 5);
  });
  afterAll(() => app.close());

  it('sin autenticar: 401 en todas las rutas', async () => {
    await http().get('/api/v1/carrito').expect(401);
    await http().post('/api/v1/carrito/items').send({ productoId: MANGO, cantidad: 1 }).expect(401);
    await http().patch(`/api/v1/carrito/items/${MANGO}`).send({ cantidad: 1 }).expect(401);
    await http().delete(`/api/v1/carrito/items/${MANGO}`).expect(401);
    await http().delete('/api/v1/carrito').expect(401);
  });

  it('permisos: comerciante, trabajador y administrador reciben 403', async () => {
    for (const n of [U.COM_A, U.COM_B, U.TRABAJADOR, U.ADMIN]) {
      await http().get('/api/v1/carrito').set(bearer(n)).expect(403);
      await http().post('/api/v1/carrito/items').set(bearer(n)).send({ productoId: MANGO, cantidad: 1 }).expect(403);
    }
  });

  it('un carrito nuevo está vacío', async () => {
    const r = await http().get('/api/v1/carrito').set(cliente).expect(200);
    expect(r.body).toEqual({ puestos: [], total: '0.00', totalProductos: 0, requiereRevision: false });
  });

  it('agrega productos de dos puestos: identifica el puesto, calcula subtotales y total', async () => {
    await http().post('/api/v1/carrito/items').set(cliente).send({ productoId: MANGO, cantidad: 3 }).expect(201);
    const r = await http().post('/api/v1/carrito/items').set(cliente).send({ productoId: PAPA, cantidad: 4 }).expect(201);
    expect(r.body.puestos).toHaveLength(2);
    expect(r.body.puestos[0]).toMatchObject({ puesto: { id: h.ids.puestoA, codigo: 'A-1' }, subtotal: '19.50' });
    expect(r.body.puestos[0].items[0]).toMatchObject({ productoId: MANGO, nombre: 'Mango', cantidad: 3, precioUnitario: '6.50', subtotal: '19.50', estado: 'OK' });
    expect(r.body.puestos[1]).toMatchObject({ puesto: { id: h.ids.puestoB, codigo: 'B-1' }, subtotal: '9.00' });
    expect(r.body).toMatchObject({ total: '28.50', totalProductos: 7, requiereRevision: false });
    const g = await http().get('/api/v1/carrito').set(cliente).expect(200);
    expect(g.body).toEqual(r.body);
  });

  it('el carrito es privado: otro cliente ve el suyo vacío y no puede tocar el ajeno', async () => {
    const r = await http().get('/api/v1/carrito').set(otroCliente).expect(200);
    expect(r.body.puestos).toEqual([]);
    await http().delete(`/api/v1/carrito/items/${MANGO}`).set(otroCliente).expect(404);
    await http().patch(`/api/v1/carrito/items/${MANGO}`).set(otroCliente).send({ cantidad: 1 }).expect(404);
    expect((await http().get('/api/v1/carrito').set(cliente)).body.totalProductos).toBe(7);
  });

  it('stock insuficiente: 409 y el carrito no cambia (incluye lo ya agregado)', async () => {
    const r = await http().post('/api/v1/carrito/items').set(cliente).send({ productoId: MANGO, cantidad: 8 }).expect(409);
    expect(r.body).toMatchObject({ codigo: 'CONFLICTO' });
    expect(r.body.mensaje).toMatch(/stock/i);
    await http().post('/api/v1/carrito/items').set(cliente).send({ productoId: SIN_STOCK, cantidad: 1 }).expect(409);
    await http().patch(`/api/v1/carrito/items/${MANGO}`).set(cliente).send({ cantidad: 11 }).expect(409);
    expect((await http().get('/api/v1/carrito').set(cliente)).body.total).toBe('28.50');
  });

  it('productos no disponibles (borrador, inexistente): 404', async () => {
    await http().post('/api/v1/carrito/items').set(cliente).send({ productoId: BORRADOR, cantidad: 1 }).expect(404);
    await http().post('/api/v1/carrito/items').set(cliente).send({ productoId: uid(999), cantidad: 1 }).expect(404);
  });

  it('un puesto inactivo o una categoría inactiva hacen no disponible al producto', async () => {
    const puesto = h.puestos.find((p) => p.id === h.ids.puestoB)!;
    puesto.cambiarEstado(false);
    await http().post('/api/v1/carrito/items').set(cliente).send({ productoId: PAPA, cantidad: 1 }).expect(404);
    const g = await http().get('/api/v1/carrito').set(cliente).expect(200);
    const linea = g.body.puestos.find((x: { puesto: { id: string } }) => x.puesto.id === h.ids.puestoB).items[0];
    expect(linea).toMatchObject({ productoId: PAPA, estado: 'NO_DISPONIBLE' });
    expect(g.body).toMatchObject({ total: '19.50', requiereRevision: true });
    puesto.cambiarEstado(true);
    expect((await http().get('/api/v1/carrito').set(cliente)).body).toMatchObject({ total: '28.50', requiereRevision: false });
  });

  it('entradas inválidas: 400', async () => {
    const post = (b: object) => http().post('/api/v1/carrito/items').set(cliente).send(b);
    await post({}).expect(400);
    await post({ productoId: 'abc', cantidad: 1 }).expect(400);
    await post({ productoId: MANGO }).expect(400);
    await post({ productoId: MANGO, cantidad: 0 }).expect(400);
    await post({ productoId: MANGO, cantidad: -1 }).expect(400);
    await post({ productoId: MANGO, cantidad: 1.5 }).expect(400);
    await post({ productoId: MANGO, cantidad: '2' }).expect(400);
    await http().patch(`/api/v1/carrito/items/${MANGO}`).set(cliente).send({}).expect(400);
    await http().patch('/api/v1/carrito/items/no-uuid').set(cliente).send({ cantidad: 1 }).expect(400);
  });

  it('modifica la cantidad y recalcula; quita un producto; el puesto sin productos desaparece', async () => {
    const m = await http().patch(`/api/v1/carrito/items/${MANGO}`).set(cliente).send({ cantidad: 10 }).expect(200);
    expect(m.body).toMatchObject({ total: '74.00', totalProductos: 14 });
    const q = await http().delete(`/api/v1/carrito/items/${MANGO}`).set(cliente).expect(200);
    expect(q.body.puestos.map((p: { puesto: { codigo: string } }) => p.puesto.codigo)).toEqual(['B-1']);
    expect(q.body.total).toBe('9.00');
    await http().delete(`/api/v1/carrito/items/${MANGO}`).set(cliente).expect(404);
  });

  it('el stock que baja después se refleja: la línea queda STOCK_INSUFICIENTE y no suma hasta ajustarla', async () => {
    await h.inventario.variarStock({ productoId: PAPA, puestoId: h.ids.puestoB, tipo: 'AJUSTE', delta: -18, motivo: 'merma', actorId: uid(U.COM_B) });
    const g = await http().get('/api/v1/carrito').set(cliente).expect(200);
    expect(g.body.puestos[0].items[0]).toMatchObject({ estado: 'STOCK_INSUFICIENTE', disponible: 2, cantidad: 4 });
    expect(g.body).toMatchObject({ total: '0.00', requiereRevision: true });
    const ok = await http().patch(`/api/v1/carrito/items/${PAPA}`).set(cliente).send({ cantidad: 2 }).expect(200);
    expect(ok.body).toMatchObject({ total: '4.50', requiereRevision: false });
  });

  it('las reservas de otros pedidos reducen lo que se puede agregar (disponible = físico − reservado)', async () => {
    await h.inventario.reservar({ claveOperacion: 'pedido-ajeno', items: [{ productoId: MANGO, cantidad: 8 }], expiraEn: new Date(Date.now() + 60_000) });
    await http().post('/api/v1/carrito/items').set(cliente).send({ productoId: MANGO, cantidad: 3 }).expect(409);
    await http().post('/api/v1/carrito/items').set(cliente).send({ productoId: MANGO, cantidad: 2 }).expect(201);
    await h.inventario.liberar({ claveOperacion: 'pedido-ajeno', motivo: 'CANCELACION' });
  });

  it('vaciar deja el carrito en cero', async () => {
    const r = await http().delete('/api/v1/carrito').set(cliente).expect(200);
    expect(r.body).toEqual({ puestos: [], total: '0.00', totalProductos: 0, requiereRevision: false });
    expect((await http().get('/api/v1/carrito').set(cliente)).body.puestos).toEqual([]);
  });

  it('solicitudes simultáneas no superan el stock disponible (último producto)', async () => {
    const ULTIMO = uid(505);
    await publicar(ULTIMO, h.ids.puestoA, 'Último', '3.10');
    await stock(ULTIMO, h.ids.puestoA, 5);
    const rs = await Promise.all(Array.from({ length: 12 }, () => http().post('/api/v1/carrito/items').set(cliente).send({ productoId: ULTIMO, cantidad: 1 })));
    expect(rs.filter((r) => r.status === 201)).toHaveLength(5);
    expect(rs.filter((r) => r.status === 409)).toHaveLength(7);
    const g = await http().get('/api/v1/carrito').set(cliente).expect(200);
    expect(g.body).toMatchObject({ total: '15.50', totalProductos: 5 });
  });
});
