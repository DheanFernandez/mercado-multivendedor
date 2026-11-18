import { describe, expect, it } from 'vitest';
import { generarSlug as generarSlugDominio } from '../../src/modules/products/domain/categoria.entity.js';
import { CATEGORIAS, CLIENTE_PRUEBA, DOMINIO_CORREO, IDS, PREFIJO_ID, PRODUCTOS, PUESTOS, UNIDADES_VENTA, generarSlug } from './datos-demo.mjs';

/** Datos de demostración (spec 004, E2; CA-DEMO-03, CA-DEMO-05). Reglas tomadas de las migraciones y del dominio. */
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe('datos de demostración', () => {
  it('8 categorías, 4 puestos y 20 productos', () => {
    expect(CATEGORIAS).toHaveLength(8);
    expect(PUESTOS).toHaveLength(4);
    expect(PRODUCTOS).toHaveLength(20);
  });

  it('cada puesto y cada categoría tienen al menos un producto', () => {
    for (const p of PUESTOS) expect(PRODUCTOS.filter((x) => x.puestoId === p.id).length).toBeGreaterThan(0);
    for (const c of CATEGORIAS) expect(PRODUCTOS.filter((x) => x.categoriaId === c.id).length).toBeGreaterThan(0);
    expect(PRODUCTOS.filter((x) => x.categoriaId === CATEGORIAS.find((c) => c.nombre === 'Frutas')!.id)).toHaveLength(5);
  });

  it('el slug es el que genera el dominio y cumple el CHECK de la migración', () => {
    for (const c of CATEGORIAS) {
      expect(c.slug).toBe(generarSlugDominio(c.nombre));
      expect(c.slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
    }
    expect(generarSlug('Lácteos y huevos')).toBe('lacteos-y-huevos');
    expect(new Set(CATEGORIAS.map((c) => c.slug)).size).toBe(8);
  });

  it('identificadores deterministas, únicos y con formato UUID v4, todos con el prefijo de demostración', () => {
    const todos = [...Object.values(IDS).flat(), ...PRODUCTOS.flatMap((p) => [p.inventarioId, p.movimientoId, p.imagenId])];
    for (const id of todos) {
      expect(id).toMatch(UUID_V4);
      expect(id.startsWith(PREFIJO_ID)).toBe(true);
    }
    expect(new Set(todos).size).toBe(todos.length);
    expect(CLIENTE_PRUEBA.authId).toMatch(UUID_V4);
  });

  it('precios en soles con 2 decimales, > 0 y dentro de NUMERIC(10,2); unidades del enum; textos dentro de los límites del dominio', () => {
    for (const p of PRODUCTOS) {
      expect(p.precio).toMatch(/^\d{1,8}\.\d{2}$/);
      expect(Number(p.precio)).toBeGreaterThan(0);
      expect(UNIDADES_VENTA).toContain(p.unidadVenta);
      expect(p.nombre.trim().length).toBeGreaterThan(0);
      expect(p.nombre.length).toBeLessThanOrEqual(150);
      expect((p.presentacion ?? '').length).toBeLessThanOrEqual(100);
      expect((p.descripcion ?? '').length).toBeLessThanOrEqual(2000);
    }
  });

  it('existencias suficientes para el carrito: stock ≥ 40 en cada producto', () => {
    for (const p of PRODUCTOS) expect(p.stock).toBeGreaterThanOrEqual(40);
  });

  it('puestos y personas ficticios y reconocibles; sin contraseñas ni cuentas de Supabase', () => {
    for (const p of PUESTOS) {
      expect(p.codigo).toMatch(/^DEMO-[A-Z][0-9]$/);
      expect(p.codigo).toMatch(/^[A-Z0-9][A-Z0-9-]{0,19}$/); // regla del dominio de Comerciantes
      expect(p.comerciante.nombreComercial).toMatch(/\(demostración\)$/);
      expect(p.usuario.email).toBe(p.usuario.email.toLowerCase());
      expect(p.usuario.email.endsWith(`@${DOMINIO_CORREO}`)).toBe(true);
      expect(p.usuario).not.toHaveProperty('authId');
    }
    expect(CLIENTE_PRUEBA.email.endsWith(`@${DOMINIO_CORREO}`)).toBe(true);
    expect(JSON.stringify({ PUESTOS, CLIENTE_PRUEBA })).not.toMatch(/contrase|password|clave/i);
  });

  it('el movimiento de ingreso lo registra el usuario comerciante del puesto del producto', () => {
    for (const p of PRODUCTOS) expect(p.actorId).toBe(PUESTOS.find((x) => x.id === p.puestoId)!.usuario.id);
  });

  it('la búsqueda «papa» solo encuentra «Papa amarilla» (nombre, descripción o categoría)', () => {
    const coincide = (t: string | null) => (t ?? '').toLowerCase().includes('papa');
    const hallados = PRODUCTOS.filter((p) => coincide(p.nombre) || coincide(p.descripcion) || coincide(CATEGORIAS.find((c) => c.id === p.categoriaId)!.nombre));
    expect(hallados.map((p) => p.nombre)).toEqual(['Papa amarilla']);
  });
});
