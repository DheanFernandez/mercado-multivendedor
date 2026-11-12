import { describe, expect, it } from 'vitest';
import { ErrorDeValidacion } from '../../../../shared/domain/errors.js';
import type { CatalogoDetallesRepository, ProductoCatalogo } from '../ports/catalogo.repository.js';
import { MAX_IDS_DETALLES, ObtenerDetallesCatalogo } from './catalogo.use-cases.js';

const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const producto = (n: number, precio = '3.50'): ProductoCatalogo => ({
  id: uuid(n), nombre: `Producto ${n}`, descripcion: null, precio, unidadVenta: 'KILOGRAMO', presentacion: null,
  categoria: { id: uuid(900), nombre: 'Frutas', slug: 'frutas' }, puesto: { id: uuid(800), codigo: 'A-1', nombre: 'Puesto A' }, imagenes: [],
});

/** Repositorio falso: devuelve solo los productos «visibles» (publicados) que existan entre los ids pedidos. */
function repo(visibles: ProductoCatalogo[]) {
  const llamadas: string[][] = [];
  const r: CatalogoDetallesRepository = {
    async detalles(ids) { llamadas.push([...ids]); return visibles.filter((p) => ids.includes(p.id)); },
  };
  return { r, llamadas };
}

describe('ObtenerDetallesCatalogo (lote)', () => {
  it('devuelve un mapa por identificador con los datos del catálogo', async () => {
    const { r } = repo([producto(1, '6.50'), producto(2, '19.99')]);
    const m = await new ObtenerDetallesCatalogo(r).ejecutar([uuid(1), uuid(2)]);
    expect([...m.keys()].sort()).toEqual([uuid(1), uuid(2)]);
    expect(m.get(uuid(2))).toMatchObject({ nombre: 'Producto 2', precio: '19.99', puesto: { codigo: 'A-1' } });
  });

  it('omite los productos que el catálogo no expone (no publicados, puesto o categoría inactivos, inexistentes)', async () => {
    const { r } = repo([producto(1)]);
    const m = await new ObtenerDetallesCatalogo(r).ejecutar([uuid(1), uuid(2), uuid(3)]);
    expect([...m.keys()]).toEqual([uuid(1)]);
    expect(m.has(uuid(2))).toBe(false);
  });

  it('hace UNA sola llamada al repositorio con los identificadores sin repetir, aunque lleguen duplicados', async () => {
    const { r, llamadas } = repo([producto(1), producto(2)]);
    await new ObtenerDetallesCatalogo(r).ejecutar([uuid(1), uuid(2), uuid(1), uuid(2), uuid(1)]);
    expect(llamadas).toEqual([[uuid(1), uuid(2)]]);
  });

  it('una lista vacía devuelve un mapa vacío sin consultar', async () => {
    const { r, llamadas } = repo([producto(1)]);
    const m = await new ObtenerDetallesCatalogo(r).ejecutar([]);
    expect(m.size).toBe(0);
    expect(llamadas).toEqual([]);
  });

  it(`acepta hasta ${MAX_IDS_DETALLES} identificadores distintos y rechaza más`, async () => {
    const ids = Array.from({ length: MAX_IDS_DETALLES }, (_, i) => uuid(i + 1));
    const { r, llamadas } = repo(ids.map((_, i) => producto(i + 1)));
    const m = await new ObtenerDetallesCatalogo(r).ejecutar(ids);
    expect(m.size).toBe(MAX_IDS_DETALLES);
    expect(llamadas).toHaveLength(1);
    await expect(new ObtenerDetallesCatalogo(r).ejecutar([...ids, uuid(999)])).rejects.toThrow(ErrorDeValidacion);
    expect(llamadas).toHaveLength(1); // el rechazo no consulta
  });

  it('los duplicados no cuentan para el máximo', async () => {
    const { r } = repo([producto(1)]);
    const ids = Array.from({ length: MAX_IDS_DETALLES * 2 }, () => uuid(1));
    await expect(new ObtenerDetallesCatalogo(r).ejecutar(ids)).resolves.toBeInstanceOf(Map);
  });

  it.each([
    ['no es una lista', 'abc'],
    ['null', null],
    ['un identificador no UUID', ['no-es-uuid']],
    ['un elemento que no es texto', [123]],
    ['mezcla válidos e inválidos', [uuid(1), 'x']],
  ])('rechaza la entrada inválida sin consultar: %s', async (_n, entrada) => {
    const { r, llamadas } = repo([producto(1)]);
    await expect(new ObtenerDetallesCatalogo(r).ejecutar(entrada)).rejects.toThrow(ErrorDeValidacion);
    expect(llamadas).toEqual([]);
  });
});
