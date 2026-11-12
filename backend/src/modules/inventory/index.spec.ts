import { describe, expect, it } from 'vitest';
import { StockInsuficienteError as ErrorInterno } from './domain/errors.js';
import * as apiPublica from './index.js';

describe('API pública de Inventario (inventory/index.ts)', () => {
  it('exporta los casos de uso que otros módulos pueden usar', () => {
    for (const nombre of ['ReservarInventario', 'LiberarReserva', 'ConfirmarVentaReservada', 'ExpirarReservasVencidas', 'ConsultarDisponibilidad']) {
      expect(typeof (apiPublica as Record<string, unknown>)[nombre], nombre).toBe('function');
    }
  });

  it('exporta `StockInsuficienteError` (misma clase que usa el dominio) para que Pedidos identifique el producto sin stock', () => {
    expect(apiPublica.StockInsuficienteError).toBe(ErrorInterno);
    const e = new apiPublica.StockInsuficienteError('00000000-0000-4000-8000-000000000001');
    expect(e.productoId).toBe('00000000-0000-4000-8000-000000000001');
    expect(e.codigo).toBe('CONFLICTO');
  });
});
