/**
 * Compatibilidad de Jest con el resto de la pila (spec 006, §4): decoradores de NestJS y cliente de Prisma.
 * No abre conexiones ni usa red: solo comprueba que ambas piezas se cargan y funcionan bajo Jest + ts-jest (ESM).
 */
import { describe, expect, it } from '@jest/globals';

describe('Jest frente a NestJS y Prisma', () => {
  it('carga y ejecuta un controlador de NestJS con decoradores (metadatos incluidos)', async () => {
    const { CarritoController } = await import('../../src/modules/cart/entry-adapters/carrito.controller.js');
    const casoDeUso = { ejecutar: async () => ({ ok: true }) };
    const controlador = new CarritoController(casoDeUso as never, casoDeUso as never, casoDeUso as never, casoDeUso as never, casoDeUso as never);
    expect(await controlador.obtener({ id: 'usuario', rol: 'CLIENTE' })).toEqual({ ok: true });
    expect(Reflect.getMetadata('path', CarritoController)).toBe('api/v1/carrito');
  });

  it('carga el cliente de Prisma generado (sin conectarse a ninguna base)', async () => {
    const prisma = await import('../../src/generated/prisma/client.js');
    expect(Object.keys(prisma).length).toBeGreaterThan(0);
  });
});
