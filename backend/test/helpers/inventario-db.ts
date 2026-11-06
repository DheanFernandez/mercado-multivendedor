/**
 * Apoyo de las pruebas de inventario contra PostgreSQL. SOLO la base local aislada (guarda de seguridad).
 * Los datos se crean con una etiqueta única y se borran al terminar (únicamente las filas que esta prueba creó).
 */
import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../src/generated/prisma/client.js';
import { ReservarInventario } from '../../src/modules/inventory/application/use-cases/inventario.use-cases.js';
import { PrismaInventarioRepository } from '../../src/modules/inventory/infrastructure/prisma-inventario.repository.js';
import type { PrismaService } from '../../src/shared/infrastructure/prisma/prisma.service.js';
import { exigirBaseAislada } from '../../scripts/base-aislada.mjs';

export function abrirBase(poolMax = 10) {
  const url = exigirBaseAislada(process.env['DATABASE_URL']);
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url, max: poolMax }) });
  const repo = new PrismaInventarioRepository(prisma as unknown as PrismaService);
  return { prisma, repo, reservar: new ReservarInventario(repo), url };
}
export type Base = ReturnType<typeof abrirBase>;

export const etiqueta = () => `t${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
export const manana = () => new Date(Date.now() + 3_600_000);

/** Registro de lo creado para poder borrarlo después. */
export class Fixtures {
  private productos: string[] = [];
  private puestos: string[] = [];
  private comerciantes: string[] = [];
  private usuarios: string[] = [];
  private categorias: string[] = [];
  private n = 0;
  constructor(private readonly prisma: PrismaClient, private readonly tag: string) {}

  async puesto() {
    const k = ++this.n;
    const u = await this.prisma.usuario.create({ data: { email: `${this.tag}-${k}@prueba.test`, nombres: 'N', apellidos: 'A', rol: 'COMERCIANTE' } });
    const c = await this.prisma.comerciante.create({ data: { usuarioId: u.id, nombreComercial: `Com ${this.tag} ${k}` } });
    const p = await this.prisma.puesto.create({ data: { comercianteId: c.id, codigo: `${this.tag}-${k}`.toUpperCase(), nombre: `Puesto ${k}` } });
    this.usuarios.push(u.id); this.comerciantes.push(c.id); this.puestos.push(p.id);
    return { usuarioId: u.id, puestoId: p.id };
  }

  async producto(puestoId: string, stock = 0) {
    if (this.categorias.length === 0) {
      const cat = await this.prisma.categoria.create({ data: { nombre: `Cat ${this.tag}`, slug: `${this.tag}-cat` } });
      this.categorias.push(cat.id);
    }
    const p = await this.prisma.producto.create({ data: { puestoId, categoriaId: this.categorias[0]!, nombre: `Prod ${++this.n}`, precio: '5.00', unidadVenta: 'UNIDAD' } });
    this.productos.push(p.id);
    if (stock > 0) await this.prisma.inventario.create({ data: { productoId: p.id, puestoId, stockFisico: stock } });
    return p.id;
  }

  /** Producto con stock físico `stock`, listo para reservar. */
  async productoConStock(stock: number, puestoId?: string) {
    const pid = puestoId ?? (await this.puesto()).puestoId;
    return { productoId: await this.producto(pid, stock), puestoId: pid };
  }

  async limpiar() {
    const inv = { inventario: { productoId: { in: this.productos } } };
    await this.prisma.movimientoInventario.deleteMany({ where: inv });
    await this.prisma.reservaInventario.deleteMany({ where: inv });
    await this.prisma.inventario.deleteMany({ where: { productoId: { in: this.productos } } });
    await this.prisma.producto.deleteMany({ where: { id: { in: this.productos } } });
    await this.prisma.categoria.deleteMany({ where: { id: { in: this.categorias } } });
    await this.prisma.puesto.deleteMany({ where: { id: { in: this.puestos } } });
    await this.prisma.comerciante.deleteMany({ where: { id: { in: this.comerciantes } } });
    await this.prisma.usuario.deleteMany({ where: { id: { in: this.usuarios } } });
  }
}

export const clave = (prefijo: string) => `${prefijo}-${randomUUID()}`;

/** Resultado de lanzar una operación: éxito o el error capturado. */
export async function intentar<T>(op: () => Promise<T>): Promise<{ ok: true; valor: T } | { ok: false; error: unknown }> {
  try {
    return { ok: true, valor: await op() };
  } catch (error) {
    return { ok: false, error };
  }
}

/** La consulta SQL que exige EQ-03: filas cuyo reservado supera al físico (debe ser 0). */
export async function reservadoSuperaFisico(prisma: PrismaClient): Promise<number> {
  const r = await prisma.$queryRaw<{ n: bigint }[]>`SELECT count(*) AS n FROM inventarios WHERE stock_reservado > stock_fisico`;
  return Number(r[0]!.n);
}
