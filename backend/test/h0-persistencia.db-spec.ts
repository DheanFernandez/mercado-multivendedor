/**
 * Persistencia de las operaciones H0 (cambio de rol/estado, edición, suspensión, reasignación, puestos operativos y su
 * efecto en el catálogo) contra PostgreSQL. SOLO para la base local de Docker: se niega a correr contra Supabase u otra base remota.
 *   npm run test:db   (levanta la base local, migra y ejecuta; ver ops/medicion/README.md)
 */
import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { PrismaPg } from '@prisma/adapter-pg';
import { afterAll, describe, expect, it } from 'vitest';
import { PrismaClient } from '../src/generated/prisma/client.js';
import { PrismaCatalogoRepository } from '../src/modules/catalog/infrastructure/prisma-catalogo.repository.js';
import { Comerciante } from '../src/modules/merchants/domain/comerciante.entity.js';
import { CodigoPuestoDuplicadoError, ComercianteYaRegistradoError } from '../src/modules/merchants/domain/errors.js';
import { Puesto } from '../src/modules/merchants/domain/puesto.entity.js';
import { PrismaComercianteRepository, PrismaPuestoRepository } from '../src/modules/merchants/infrastructure/persistence/prisma-merchants.repositories.js';
import { PrismaCategoriaRepository, PrismaProductoRepository } from '../src/modules/products/infrastructure/prisma-products.repositories.js';
import { Categoria } from '../src/modules/products/domain/categoria.entity.js';
import { Producto } from '../src/modules/products/domain/producto.entity.js';
import { EmailYaRegistradoError } from '../src/modules/users/domain/errors.js';
import { Usuario } from '../src/modules/users/domain/usuario.entity.js';
import { PrismaUsuarioRepository } from '../src/modules/users/infrastructure/persistence/prisma-usuario.repository.js';
import type { PrismaService } from '../src/shared/infrastructure/prisma/prisma.service.js';
import { exigirBaseAislada } from '../scripts/base-aislada.mjs';

const url = exigirBaseAislada(process.env['DATABASE_URL']); // solo la base local de Docker
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url, max: 3 }) });
const servicio = prisma as unknown as PrismaService;
const TAG = `h0${Date.now().toString(36)}`;
const usuarios = new PrismaUsuarioRepository(servicio);
const comerciantes = new PrismaComercianteRepository(servicio);
const puestos = new PrismaPuestoRepository(servicio);
const categorias = new PrismaCategoriaRepository(servicio);
const productos = new PrismaProductoRepository(servicio);
const catalogo = new PrismaCatalogoRepository(servicio);

const nuevoUsuario = (n: string, rol: 'CLIENTE' | 'COMERCIANTE' = 'COMERCIANTE') =>
  Usuario.crear({ id: randomUUID(), email: `${TAG}-${n}@prueba.test`, nombres: 'N', apellidos: 'A', rol, authId: randomUUID() });

afterAll(async () => {
  const ps = await prisma.puesto.findMany({ where: { codigo: { startsWith: TAG.toUpperCase() } }, select: { id: true, comercianteId: true } });
  await prisma.producto.deleteMany({ where: { puestoId: { in: ps.map((p) => p.id) } } });
  await prisma.puesto.deleteMany({ where: { id: { in: ps.map((p) => p.id) } } });
  await prisma.comerciante.deleteMany({ where: { nombreComercial: { startsWith: TAG } } });
  await prisma.usuario.deleteMany({ where: { email: { startsWith: `${TAG}-` } } });
  await prisma.categoria.deleteMany({ where: { slug: { startsWith: TAG } } });
  await prisma.$disconnect();
});

describe('H0 · persistencia de administración (base aislada)', { timeout: 60_000 }, () => {
  it('usuarios: el rol y el estado se actualizan; correo y authId no cambian; correo duplicado se rechaza', async () => {
    const u = nuevoUsuario('u1', 'CLIENTE');
    await usuarios.guardar(u);
    const leido = (await usuarios.buscarPorId(u.id))!;
    leido.cambiarRol('COMERCIANTE');
    leido.cambiarEstado(false);
    await usuarios.guardar(leido);
    const tras = (await usuarios.buscarPorId(u.id))!;
    expect(tras).toMatchObject({ rol: 'COMERCIANTE', estado: 'INACTIVO', email: u.email, authId: u.authId });
    const otro = Usuario.crear({ id: randomUUID(), email: u.email, nombres: 'X', apellidos: 'Y', rol: 'CLIENTE' });
    await expect(usuarios.guardar(otro)).rejects.toBeInstanceOf(EmailYaRegistradoError);
  });

  it('comerciantes: nombre y estado se actualizan; un segundo perfil para el mismo usuario se rechaza', async () => {
    const u = nuevoUsuario('c1');
    await usuarios.guardar(u);
    const c = Comerciante.crear({ id: randomUUID(), usuarioId: u.id, nombreComercial: `${TAG} Frutas` });
    await comerciantes.guardar(c);
    const leido = (await comerciantes.buscarPorId(c.id))!;
    leido.renombrar(`${TAG} Frutas Finas`);
    leido.cambiarEstado(false);
    await comerciantes.guardar(leido);
    expect(await comerciantes.buscarPorId(c.id)).toMatchObject({ nombreComercial: `${TAG} Frutas Finas`, estado: 'SUSPENDIDO', usuarioId: u.id });
    await expect(comerciantes.guardar(Comerciante.crear({ id: randomUUID(), usuarioId: u.id, nombreComercial: `${TAG} Otro` }))).rejects.toBeInstanceOf(ComercianteYaRegistradoError);
  });

  it('puestos: edición, reasignación y estado se persisten; código duplicado se rechaza; listarOperativos filtra por estado', async () => {
    const [u1, u2] = [nuevoUsuario('p1'), nuevoUsuario('p2')];
    await usuarios.guardar(u1);
    await usuarios.guardar(u2);
    const [c1, c2] = [Comerciante.crear({ id: randomUUID(), usuarioId: u1.id, nombreComercial: `${TAG} P1` }), Comerciante.crear({ id: randomUUID(), usuarioId: u2.id, nombreComercial: `${TAG} P2` })];
    await comerciantes.guardar(c1);
    await comerciantes.guardar(c2);
    const p = Puesto.crear({ id: randomUUID(), comercianteId: c1.id, codigo: `${TAG}-1`, nombre: 'Uno' });
    const q = Puesto.crear({ id: randomUUID(), comercianteId: c2.id, codigo: `${TAG}-2`, nombre: 'Dos' });
    await puestos.guardar(p);
    await puestos.guardar(q);

    const leido = (await puestos.buscarPorId(p.id))!;
    leido.actualizar({ codigo: `${TAG}-9`, nombre: 'Uno editado', comercianteId: c2.id });
    await puestos.guardar(leido);
    expect(await puestos.buscarPorId(p.id)).toMatchObject({ codigo: `${TAG}-9`.toUpperCase(), nombre: 'Uno editado', comercianteId: c2.id });

    const duplicado = Puesto.crear({ id: randomUUID(), comercianteId: c1.id, codigo: `${TAG}-9`, nombre: 'Dup' });
    await expect(puestos.guardar(duplicado)).rejects.toBeInstanceOf(CodigoPuestoDuplicadoError);

    const operativos = async () => (await puestos.listarOperativos({ limite: 100, desplazamiento: 0 })).filter((x) => x.codigo.startsWith(TAG.toUpperCase())).map((x) => x.id);
    expect(await operativos()).toEqual(expect.arrayContaining([p.id, q.id]));
    const inactivo = (await puestos.buscarPorId(q.id))!;
    inactivo.cambiarEstado(false);
    await puestos.guardar(inactivo);
    expect(await operativos()).toEqual([p.id]);
    const suspendido = (await comerciantes.buscarPorId(c2.id))!; // titular del puesto p tras la reasignación
    suspendido.cambiarEstado(false);
    await comerciantes.guardar(suspendido);
    expect(await operativos()).toEqual([]);
  });

  it('catálogo: suspender al comerciante oculta sus productos y reactivarlo los vuelve a mostrar (en la base real)', async () => {
    const u = nuevoUsuario('v1');
    await usuarios.guardar(u);
    const c = Comerciante.crear({ id: randomUUID(), usuarioId: u.id, nombreComercial: `${TAG} Vis` });
    await comerciantes.guardar(c);
    const pu = Puesto.crear({ id: randomUUID(), comercianteId: c.id, codigo: `${TAG}-V`, nombre: 'Visible' });
    await puestos.guardar(pu);
    const cat = Categoria.crear({ id: randomUUID(), nombre: `${TAG} cat` });
    await categorias.guardar(cat);
    const prod = Producto.crear({ id: randomUUID(), puestoId: pu.id, categoriaId: cat.id, nombre: `${TAG} producto`, precio: '3.50', unidadVenta: 'UNIDAD' });
    prod.publicar();
    await productos.guardar(prod);

    const visible = async () => (await catalogo.buscar({ texto: TAG, orden: 'nombre', limite: 10, desplazamiento: 0 })).items.map((i) => i.id).includes(prod.id);
    expect(await visible()).toBe(true);
    const susp = (await comerciantes.buscarPorId(c.id))!;
    susp.cambiarEstado(false);
    await comerciantes.guardar(susp);
    expect(await visible()).toBe(false);
    const react = (await comerciantes.buscarPorId(c.id))!;
    react.cambiarEstado(true);
    await comerciantes.guardar(react);
    expect(await visible()).toBe(true);
    const off = (await puestos.buscarPorId(pu.id))!;
    off.cambiarEstado(false);
    await puestos.guardar(off);
    expect(await visible()).toBe(false);
  });
});
