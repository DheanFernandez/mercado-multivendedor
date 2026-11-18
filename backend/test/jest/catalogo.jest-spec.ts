/**
 * Suite representativa con Jest (spec 006): catálogo público (RF16–RF19). Validación de filtros, orden, precios y paginación.
 * Repositorio simulado: sin red, PostgreSQL ni Supabase.
 */
import { describe, expect, it } from '@jest/globals';
import { ErrorDeValidacion } from '../../src/shared/domain/errors.js';
import type { CatalogoRepository, FiltroCatalogo, ProductoCatalogo } from '../../src/modules/catalog/application/ports/catalogo.repository.js';
import { CatalogoProductoNoEncontradoError, ConsultarCatalogo, ObtenerDetalleCatalogo } from '../../src/modules/catalog/application/use-cases/catalogo.use-cases.js';

const UUID = '00000000-0000-4000-8000-000000000001';
const item: ProductoCatalogo = {
  id: UUID,
  nombre: 'Papa',
  descripcion: null,
  precio: '3.50',
  unidadVenta: 'KILOGRAMO',
  presentacion: null,
  categoria: { id: UUID, nombre: 'Verduras', slug: 'verduras' },
  puesto: { id: UUID, codigo: 'A-1', nombre: 'Verduras' },
  imagenes: [],
};

function repositorio(total = 45) {
  const llamadas: FiltroCatalogo[] = [];
  const r: CatalogoRepository = {
    async buscar(f) {
      llamadas.push(f);
      return { items: [item], total };
    },
    async detalle(id) {
      return id === UUID ? item : null;
    },
  };
  return { r, llamadas };
}

describe('ConsultarCatalogo', () => {
  it('aplica valores por defecto y calcula la paginación', async () => {
    const { r, llamadas } = repositorio(45);
    const res = await new ConsultarCatalogo(r).ejecutar();
    expect(llamadas[0]).toMatchObject({ orden: 'recientes', limite: 20, desplazamiento: 0 });
    expect(res).toMatchObject({ pagina: 1, limite: 20, total: 45, totalPaginas: 3 });
  });

  it('traduce página y límite a desplazamiento', async () => {
    const { r, llamadas } = repositorio();
    await new ConsultarCatalogo(r).ejecutar({ pagina: 3, limite: 10 });
    expect(llamadas[0]).toMatchObject({ limite: 10, desplazamiento: 20 });
  });

  it.each([
    [{ pagina: 0 }],
    [{ pagina: 1.5 }],
    [{ limite: 0 }],
    [{ limite: 51 }],
  ])('rechaza una paginación inválida %j', async (consulta) => {
    await expect(new ConsultarCatalogo(repositorio().r).ejecutar(consulta)).rejects.toThrow(ErrorDeValidacion);
  });

  it('recorta el texto y limita su longitud a 100 caracteres', async () => {
    const { r, llamadas } = repositorio();
    await new ConsultarCatalogo(r).ejecutar({ q: '  papa  ' });
    expect(llamadas[0]?.texto).toBe('papa');
    await expect(new ConsultarCatalogo(r).ejecutar({ q: 'x'.repeat(101) })).rejects.toThrow('100 caracteres');
    await expect(new ConsultarCatalogo(r).ejecutar({ q: 5 as unknown as string })).rejects.toThrow(ErrorDeValidacion);
  });

  it('valida los identificadores de categoría y puesto', async () => {
    const { r, llamadas } = repositorio();
    await new ConsultarCatalogo(r).ejecutar({ categoriaId: UUID, puestoId: UUID });
    expect(llamadas[0]).toMatchObject({ categoriaId: UUID, puestoId: UUID });
    await expect(new ConsultarCatalogo(r).ejecutar({ categoriaId: 'x' })).rejects.toThrow(ErrorDeValidacion);
    await expect(new ConsultarCatalogo(r).ejecutar({ puestoId: 'x' })).rejects.toThrow(ErrorDeValidacion);
  });

  it.each(['recientes', 'precio_asc', 'precio_desc', 'nombre'])('acepta el orden %s', async (orden) => {
    const { r, llamadas } = repositorio();
    await new ConsultarCatalogo(r).ejecutar({ orden });
    expect(llamadas[0]?.orden).toBe(orden);
  });

  it('rechaza un orden desconocido', async () => {
    await expect(new ConsultarCatalogo(repositorio().r).ejecutar({ orden: 'aleatorio' })).rejects.toThrow('El orden debe ser uno de');
  });

  it('convierte los precios a céntimos y exige que el mínimo no supere al máximo', async () => {
    const { r, llamadas } = repositorio();
    await new ConsultarCatalogo(r).ejecutar({ precioMin: '2.50', precioMax: '10' });
    expect(llamadas[0]).toMatchObject({ precioMinCentimos: 250, precioMaxCentimos: 1000 });
    await new ConsultarCatalogo(r).ejecutar({ precioMin: '', precioMax: '' });
    expect(llamadas[1]?.precioMinCentimos).toBeUndefined();
    await expect(new ConsultarCatalogo(r).ejecutar({ precioMin: '10', precioMax: '2' })).rejects.toThrow('El precio mínimo no puede superar al máximo');
    await expect(new ConsultarCatalogo(r).ejecutar({ precioMin: 'barato' })).rejects.toThrow(ErrorDeValidacion);
  });
});

describe('ObtenerDetalleCatalogo', () => {
  it('devuelve el producto publicado', async () => {
    expect(await new ObtenerDetalleCatalogo(repositorio().r).ejecutar(UUID)).toEqual(item);
  });

  it('un producto inexistente o no publicado es «no encontrado»', async () => {
    await expect(new ObtenerDetalleCatalogo(repositorio().r).ejecutar('00000000-0000-4000-8000-0000000000ff')).rejects.toThrow(CatalogoProductoNoEncontradoError);
  });
});
