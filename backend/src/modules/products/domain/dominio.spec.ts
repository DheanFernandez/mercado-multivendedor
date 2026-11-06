import { describe, expect, it } from 'vitest';
import { ErrorDeValidacion } from '../../../shared/domain/errors.js';
import { Precio } from '../../../shared/domain/precio.js';
import { Categoria, generarSlug } from './categoria.entity.js';
import { ImagenNoEncontradaError, LimiteImagenesError, TransicionProductoInvalidaError } from './errors.js';
import { Producto } from './producto.entity.js';

describe('Precio (sin coma flotante)', () => {
  it.each([
    ['12', '12.00'], ['12.5', '12.50'], ['0.01', '0.01'], [' 3.05 ', '3.05'], [12.5, '12.50'], [99999999.99, '99999999.99'], ['0.10', '0.10'],
  ])('acepta %s → %s', (entrada, esperado) => {
    expect(Precio.desde(entrada).toString()).toBe(esperado);
  });

  it('calcula en céntimos enteros, sin errores de redondeo', () => {
    expect(Precio.desde('0.10').centimos + Precio.desde('0.20').centimos).toBe(30);
    expect(Precio.desde('19.99').centimos).toBe(1999);
  });

  it.each([['0'], ['0.00'], ['-1'], ['1.234'], ['abc'], [''], ['1e3'], ['100000000'], [0.1 + 0.2], [NaN], [Infinity], [null], [undefined], [{}], ['1,50']])('rechaza %s', (entrada) => {
    expect(() => Precio.desde(entrada)).toThrow(ErrorDeValidacion);
  });
});

describe('Categoria', () => {
  it('genera el slug sin tildes ni símbolos', () => {
    expect(generarSlug('Frutas y Verduras')).toBe('frutas-y-verduras');
    expect(generarSlug('  Lácteos & Huevos!! ')).toBe('lacteos-huevos');
    expect(generarSlug('!!!')).toBe('');
  });

  it('valida nombre y descripción', () => {
    expect(() => Categoria.crear({ id: 'x', nombre: '   ' })).toThrow(ErrorDeValidacion);
    expect(() => Categoria.crear({ id: 'x', nombre: '###' })).toThrow(ErrorDeValidacion);
    expect(() => Categoria.crear({ id: 'x', nombre: 'a'.repeat(81) })).toThrow(ErrorDeValidacion);
    expect(() => Categoria.crear({ id: 'x', nombre: 'Ok', descripcion: 'd'.repeat(501) })).toThrow(ErrorDeValidacion);
    expect(Categoria.crear({ id: 'x', nombre: '  Carnes   rojas ' }).nombre).toBe('Carnes rojas');
  });

  it('al renombrar recalcula el slug y puede desactivarse', () => {
    const c = Categoria.crear({ id: 'x', nombre: 'Frutas' });
    c.actualizar({ nombre: 'Frutas Tropicales' });
    expect(c.slug).toBe('frutas-tropicales');
    c.cambiarDisponibilidad(false);
    expect(c.activa).toBe(false);
    expect(() => c.cambiarDisponibilidad('no' as never)).toThrow(ErrorDeValidacion);
  });
});

const base = { id: 'p1', puestoId: 'pu1', categoriaId: 'c1', nombre: ' Papa  amarilla ', precio: '4.5', unidadVenta: 'KILOGRAMO' };

describe('Producto', () => {
  it('nace como BORRADOR con datos normalizados', () => {
    const p = Producto.crear(base);
    expect(p.estado).toBe('BORRADOR');
    expect(p.nombre).toBe('Papa amarilla');
    expect(p.precio.toString()).toBe('4.50');
    expect(p.imagenes).toEqual([]);
  });

  it.each([
    [{ nombre: '  ' }], [{ nombre: 'n'.repeat(151) }], [{ precio: '0' }], [{ precio: '1.999' }], [{ unidadVenta: 'TONELADA' }],
    [{ unidadVenta: undefined }], [{ descripcion: 'd'.repeat(2001) }], [{ presentacion: 'p'.repeat(101) }], [{ nombre: 123 }],
  ])('rechaza datos inválidos %j', (cambio) => {
    expect(() => Producto.crear({ ...base, ...(cambio as object) } as never)).toThrow(ErrorDeValidacion);
  });

  it('actualiza solo los campos recibidos y nunca el puesto', () => {
    const p = Producto.crear(base);
    p.actualizar({ precio: '5', presentacion: 'bolsa de 1 kg' });
    expect(p.precio.toString()).toBe('5.00');
    expect(p.nombre).toBe('Papa amarilla');
    expect(p.presentacion).toBe('bolsa de 1 kg');
    expect(p.puestoId).toBe('pu1');
    expect(() => p.actualizar({ precio: '-3' })).toThrow(ErrorDeValidacion);
    expect(p.precio.toString()).toBe('5.00'); // un cambio inválido no modifica nada
  });

  it('transiciones de estado', () => {
    const p = Producto.crear(base);
    p.publicar();
    expect(p.estado).toBe('PUBLICADO');
    expect(() => p.publicar()).toThrow(TransicionProductoInvalidaError);
    p.desactivar();
    expect(p.estado).toBe('DESACTIVADO');
    expect(() => p.desactivar()).toThrow(TransicionProductoInvalidaError);
    p.publicar(); // reactivar
    expect(p.estado).toBe('PUBLICADO');
  });

  it('imágenes: orden incremental, máximo 5 y quitar inexistente falla', () => {
    const p = Producto.crear(base);
    for (let i = 0; i < 5; i++) p.agregarImagen({ id: `i${i}`, ruta: `r${i}` });
    expect(p.imagenes.map((i) => i.orden)).toEqual([0, 1, 2, 3, 4]);
    expect(() => p.agregarImagen({ id: 'i9', ruta: 'r9' })).toThrow(LimiteImagenesError);
    p.quitarImagen('i2');
    expect(p.agregarImagen({ id: 'i10', ruta: 'r10' }).orden).toBe(5);
    expect(() => p.quitarImagen('no-existe')).toThrow(ImagenNoEncontradaError);
  });
});
