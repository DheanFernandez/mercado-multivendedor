import { describe, expect, it } from 'vitest';
import { ErrorDeValidacion } from '../../../../shared/domain/errors.js';
import type { CatalogoRepository, FiltroCatalogo, ProductoCatalogo } from '../ports/catalogo.repository.js';
import { CatalogoProductoNoEncontradoError, ConsultarCatalogo, ObtenerDetalleCatalogo } from './catalogo.use-cases.js';

const UUID = '00000000-0000-4000-8000-000000000001';
const item: ProductoCatalogo = {
  id: UUID, nombre: 'Papa', descripcion: null, precio: '3.50', unidadVenta: 'KILOGRAMO', presentacion: null,
  categoria: { id: UUID, nombre: 'Verduras', slug: 'verduras' }, puesto: { id: UUID, codigo: 'A-1', nombre: 'Verduras' }, imagenes: [],
};

function repo(total = 45) {
  const llamadas: FiltroCatalogo[] = [];
  const r: CatalogoRepository = {
    async buscar(f) { llamadas.push(f); return { items: [item], total }; },
    async detalle(id) { return id === UUID ? item : null; },
  };
  return { r, llamadas };
}

describe('ConsultarCatalogo', () => {
  it('aplica valores por defecto y calcula la paginación', async () => {
    const { r, llamadas } = repo(45);
    const res = await new ConsultarCatalogo(r).ejecutar();
    expect(llamadas[0]).toMatchObject({ orden: 'recientes', limite: 20, desplazamiento: 0 });
    expect(res).toMatchObject({ pagina: 1, limite: 20, total: 45, totalPaginas: 3 });
  });

  it('traduce página y límite a desplazamiento', async () => {
    const { r, llamadas } = repo();
    await new ConsultarCatalogo(r).ejecutar({ pagina: 3, limite: 10 });
    expect(llamadas[0]).toMatchObject({ limite: 10, desplazamiento: 20 });
  });

  it('convierte los filtros de precio a céntimos exactos', async () => {
    const { r, llamadas } = repo();
    await new ConsultarCatalogo(r).ejecutar({ precioMin: '1.10', precioMax: '9.99', q: '  papa ', categoriaId: UUID, puestoId: UUID, orden: 'precio_asc' });
    expect(llamadas[0]).toMatchObject({ precioMinCentimos: 110, precioMaxCentimos: 999, texto: 'papa', categoriaId: UUID, puestoId: UUID, orden: 'precio_asc' });
  });

  it.each([
    [{ limite: 51 }], [{ limite: 0 }], [{ pagina: 0 }], [{ pagina: 1.5 }], [{ pagina: NaN }],
    [{ precioMin: '-1' }], [{ precioMax: 'abc' }], [{ precioMin: '10', precioMax: '5' }],
    [{ categoriaId: 'no-uuid' }], [{ puestoId: "1' OR '1'='1" }], [{ orden: 'aleatorio' }], [{ q: 'x'.repeat(101) }],
  ])('rechaza consultas inválidas %j', async (consulta) => {
    const { r, llamadas } = repo();
    await expect(new ConsultarCatalogo(r).ejecutar(consulta as never)).rejects.toBeInstanceOf(ErrorDeValidacion);
    expect(llamadas).toHaveLength(0);
  });
});

describe('ObtenerDetalleCatalogo', () => {
  it('devuelve el producto visible y trata lo demás como inexistente', async () => {
    const { r } = repo();
    const caso = new ObtenerDetalleCatalogo(r);
    await expect(caso.ejecutar(UUID)).resolves.toBe(item);
    await expect(caso.ejecutar('00000000-0000-4000-8000-0000000000ff')).rejects.toBeInstanceOf(CatalogoProductoNoEncontradoError);
    await expect(caso.ejecutar('no-uuid')).rejects.toBeInstanceOf(CatalogoProductoNoEncontradoError);
  });
});
