import { describe, expect, it } from 'vitest';
import { ErrorDeValidacion } from '../../../shared/domain/errors.js';
import { CarritoVacioError, TransicionEstadoInvalidaError } from './errors.js';
import { EstadoSubpedido } from './estado-subpedido.js';
import { Pedido, type DatosNuevoPedido, type LineaNueva } from './pedido.entity.js';

const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const CLIENTE = uuid(1);
const AHORA = new Date('2026-11-06T10:00:00.000Z');
const VENCE = new Date('2026-11-06T10:30:00.000Z');
const HUELLA = 'a'.repeat(64);

const puesto = (n: number) => ({ id: uuid(100 + n), codigo: `P-${n}`, nombre: `Puesto ${n}` });
const linea = (n: number, p: number, cantidad: number, precioUnitarioCentimos: number, extra: Partial<LineaNueva> = {}): LineaNueva => ({
  productoId: uuid(200 + n),
  puesto: puesto(p),
  nombre: `Producto ${n}`,
  unidadVenta: 'KILOGRAMO',
  presentacion: null,
  cantidad,
  precioUnitarioCentimos,
  ...extra,
});

function generadorIds() {
  let n = 1000;
  return () => uuid(++n);
}
function datos(lineas: LineaNueva[], extra: Partial<DatosNuevoPedido> = {}): DatosNuevoPedido {
  return { id: uuid(9), clienteId: CLIENTE, claveIdempotencia: 'clave-1', carritoId: uuid(8), huellaCarrito: HUELLA, lineas, reservaVenceEn: VENCE, creadoEn: AHORA, generarId: generadorIds(), ...extra };
}
const crear = (lineas: LineaNueva[], extra: Partial<DatosNuevoPedido> = {}) => Pedido.crear(datos(lineas, extra));

describe('Pedido.crear · estructura (CA-O1, CA-O3)', () => {
  it('un pedido con una sola línea tiene un subpedido en ESPERANDO_PAGO con su historial inicial', () => {
    const p = crear([linea(1, 1, 2, 650)]);
    expect(p.id).toBe(uuid(9));
    expect(p.clienteId).toBe(CLIENTE);
    expect(p.claveIdempotencia).toBe('clave-1');
    expect(p.carritoId).toBe(uuid(8));
    expect(p.huellaCarrito).toBe(HUELLA);
    expect(p.reservaVenceEn).toEqual(VENCE);
    expect(p.creadoEn).toEqual(AHORA);
    expect(p.codigo).toBeNull(); // se asigna al insertar
    expect(p.subpedidos).toHaveLength(1);
    const s = p.subpedidos[0]!;
    expect(s.estado).toBe(EstadoSubpedido.ESPERANDO_PAGO);
    expect(s.puestoId).toBe(puesto(1).id);
    expect(s.puesto).toEqual({ codigo: 'P-1', nombre: 'Puesto 1' });
    expect(s.historial).toEqual([{ estadoAnterior: null, estadoNuevo: 'ESPERANDO_PAGO', origen: 'CREAR_PEDIDO', actorId: CLIENTE, creadoEn: AHORA }]);
  });

  it('agrupa las líneas en un subpedido por puesto: cada línea en exactamente uno, el de su puesto (3 puestos)', () => {
    const lineas = [linea(1, 2, 1, 100), linea(2, 1, 1, 100), linea(3, 3, 1, 100), linea(4, 1, 2, 100), linea(5, 3, 1, 100), linea(6, 2, 1, 100)];
    const p = crear(lineas);
    expect(p.subpedidos).toHaveLength(3);
    expect(new Set(p.subpedidos.map((s) => s.puestoId)).size).toBe(3);
    const porProducto = new Map<string, string>();
    for (const s of p.subpedidos) for (const l of s.lineas) {
      expect(porProducto.has(l.productoId)).toBe(false);
      porProducto.set(l.productoId, s.puestoId);
    }
    expect(porProducto.size).toBe(6);
    for (const l of lineas) expect(porProducto.get(l.productoId)).toBe(l.puesto.id);
    expect(p.subpedidos.map((s) => s.lineas.length).sort((a, b) => a - b)).toEqual([2, 2, 2]);
  });

  it('el orden es estable: subpedidos por puesto y líneas por producto, sin depender del orden de entrada', () => {
    const a = crear([linea(5, 3, 1, 100), linea(1, 2, 1, 100), linea(4, 1, 1, 100), linea(2, 2, 1, 100)]);
    const b = crear([linea(2, 2, 1, 100), linea(4, 1, 1, 100), linea(1, 2, 1, 100), linea(5, 3, 1, 100)]);
    expect(a.subpedidos.map((s) => s.puestoId)).toEqual([puesto(1).id, puesto(2).id, puesto(3).id]);
    expect(a.subpedidos[1]!.lineas.map((l) => l.productoId)).toEqual([uuid(201), uuid(202)]);
    expect(b.subpedidos.map((s) => [s.puestoId, s.lineas.map((l) => l.productoId)])).toEqual(a.subpedidos.map((s) => [s.puestoId, s.lineas.map((l) => l.productoId)]));
  });

  it('conserva en cada línea los datos históricos: nombre, unidad, presentación, cantidad y precio unitario', () => {
    const p = crear([linea(1, 1, 3, 1999, { nombre: 'Palta Hass', unidadVenta: 'UNIDAD', presentacion: 'Bolsa 500 g' })]);
    expect(p.subpedidos[0]!.lineas[0]).toMatchObject({
      productoId: uuid(201), nombre: 'Palta Hass', unidadVenta: 'UNIDAD', presentacion: 'Bolsa 500 g', cantidad: 3, precioUnitarioCentimos: 1999, subtotalCentimos: 5997,
    });
  });

  it('genera identificadores distintos para subpedidos y líneas, usando solo el generador inyectado', () => {
    const p = crear([linea(1, 1, 1, 100), linea(2, 1, 1, 100), linea(3, 2, 1, 100)]);
    const ids = [p.id, ...p.subpedidos.flatMap((s) => [s.id, ...s.lineas.map((l) => l.id)])];
    expect(ids).toHaveLength(1 + 2 + 3);
    expect(new Set(ids).size).toBe(ids.length);
    for (const s of p.subpedidos) {
      expect(s.id.startsWith('00000000-0000-4000-8000-000000001')).toBe(true);
      for (const l of s.lineas) expect(l.id.startsWith('00000000-0000-4000-8000-000000001')).toBe(true);
    }
  });

  it('un generador de identificadores que repite valores es un error (no se aceptan identificadores duplicados)', () => {
    expect(() => crear([linea(1, 1, 1, 100), linea(2, 2, 1, 100)], { generarId: () => uuid(7) })).toThrow(ErrorDeValidacion);
  });
});

describe('Pedido.crear · importes exactos en céntimos (CA-O5)', () => {
  it('0.10 × 3 = 0.30 y 19.99 × 3 = 59.97 exactos (sin error de coma flotante)', () => {
    const p = crear([linea(1, 1, 3, 10), linea(2, 2, 3, 1999)]);
    const [s1, s2] = p.subpedidos;
    expect(s1!.lineas[0]!.subtotalCentimos).toBe(30);
    expect(s1!.subtotalCentimos).toBe(30);
    expect(s2!.lineas[0]!.subtotalCentimos).toBe(5997);
    expect(s2!.subtotalCentimos).toBe(5997);
    expect(p.totalCentimos).toBe(6027);
  });

  it('subtotal de la línea = precio × cantidad; del subpedido = suma de líneas; del pedido = suma de subpedidos', () => {
    const lineas = [linea(1, 1, 7, 333), linea(2, 1, 2, 1250), linea(3, 2, 10, 99), linea(4, 3, 1, 1), linea(5, 3, 4, 2501)];
    const p = crear(lineas);
    for (const s of p.subpedidos) {
      for (const l of s.lineas) expect(l.subtotalCentimos).toBe(l.precioUnitarioCentimos * l.cantidad);
      expect(s.subtotalCentimos).toBe(s.lineas.reduce((a, l) => a + l.subtotalCentimos, 0));
    }
    expect(p.totalCentimos).toBe(p.subpedidos.reduce((a, s) => a + s.subtotalCentimos, 0));
    expect(p.totalCentimos).toBe(7 * 333 + 2 * 1250 + 10 * 99 + 1 + 4 * 2501);
  });

  it('50 líneas al precio y la cantidad máximos suman exactamente, sin perder precisión', () => {
    const MAX_PRECIO = 9_999_999_999; // 99 999 999.99
    const lineas = Array.from({ length: 50 }, (_, i) => linea(i + 1, (i % 5) + 1, 10_000, MAX_PRECIO));
    const p = crear(lineas);
    const esperado = BigInt(MAX_PRECIO) * 10_000n * 50n;
    expect(BigInt(p.totalCentimos)).toBe(esperado);
    expect(Number.isSafeInteger(p.totalCentimos)).toBe(true);
    for (const s of p.subpedidos) expect(BigInt(s.subtotalCentimos)).toBe(BigInt(MAX_PRECIO) * 10_000n * 10n);
  });

  it('el mínimo: una unidad a un céntimo', () => {
    const p = crear([linea(1, 1, 1, 1)]);
    expect(p.totalCentimos).toBe(1);
  });
});

describe('Pedido.crear · límites y validaciones', () => {
  it('acepta 1 y 50 líneas; rechaza 51', () => {
    expect(crear([linea(1, 1, 1, 100)]).subpedidos).toHaveLength(1);
    expect(crear(Array.from({ length: 50 }, (_, i) => linea(i + 1, 1, 1, 100))).subpedidos[0]!.lineas).toHaveLength(50);
    expect(() => crear(Array.from({ length: 51 }, (_, i) => linea(i + 1, 1, 1, 100)))).toThrow(ErrorDeValidacion);
  });

  it('sin líneas es un carrito vacío (conflicto, no validación)', () => {
    expect(() => crear([])).toThrow(CarritoVacioError);
    expect(new CarritoVacioError().codigo).toBe('CONFLICTO');
  });

  it.each([[0], [-1], [1.5], [10_001], [Number.NaN], [Number.POSITIVE_INFINITY], ['3'], [null], [undefined]])('rechaza la cantidad %s', (c) => {
    expect(() => crear([linea(1, 1, c as number, 100)])).toThrow(ErrorDeValidacion);
  });

  it('acepta las cantidades límite 1 y 10 000', () => {
    expect(crear([linea(1, 1, 1, 100)]).totalCentimos).toBe(100);
    expect(crear([linea(1, 1, 10_000, 100)]).totalCentimos).toBe(1_000_000);
  });

  it.each([[0], [-5], [1.5], [10_000_000_000], [Number.NaN], [Number.POSITIVE_INFINITY], ['100'], [null]])('rechaza el precio unitario %s', (precio) => {
    expect(() => crear([linea(1, 1, 1, precio as number)])).toThrow(ErrorDeValidacion);
  });

  it('acepta el precio máximo 99 999 999.99 (9 999 999 999 céntimos)', () => {
    expect(crear([linea(1, 1, 1, 9_999_999_999)]).totalCentimos).toBe(9_999_999_999);
  });

  it('rechaza el mismo producto dos veces (una línea por producto)', () => {
    expect(() => crear([linea(1, 1, 1, 100), linea(1, 1, 2, 100)])).toThrow(ErrorDeValidacion);
  });

  it('rechaza un mismo puesto descrito con datos distintos', () => {
    expect(() => crear([linea(1, 1, 1, 100), linea(2, 1, 1, 100, { puesto: { ...puesto(1), nombre: 'Otro nombre' } })])).toThrow(ErrorDeValidacion);
    expect(() => crear([linea(1, 1, 1, 100), linea(2, 1, 1, 100, { puesto: { ...puesto(1), codigo: 'X-9' } })])).toThrow(ErrorDeValidacion);
  });

  it.each([
    ['producto vacío', { productoId: '' }],
    ['puesto sin identificador', { puesto: { id: '', codigo: 'P', nombre: 'N' } }],
    ['puesto sin código', { puesto: { id: uuid(100), codigo: '', nombre: 'N' } }],
    ['puesto sin nombre', { puesto: { id: uuid(100), codigo: 'P', nombre: '' } }],
    ['nombre vacío', { nombre: '   ' }],
    ['unidad de venta vacía', { unidadVenta: '' }],
    ['presentación vacía (debe ser null o texto)', { presentacion: '' }],
  ] as [string, Partial<LineaNueva>][])('rechaza una línea con %s', (_n, extra) => {
    expect(() => crear([linea(1, 1, 1, 100, extra)])).toThrow(ErrorDeValidacion);
  });

  it.each([
    ['identificador del pedido vacío', { id: '' }],
    ['cliente vacío', { clienteId: '' }],
    ['carrito vacío', { carritoId: '' }],
    ['clave vacía', { claveIdempotencia: '' }],
    ['clave de 101 caracteres', { claveIdempotencia: 'a'.repeat(101) }],
    ['clave con espacios', { claveIdempotencia: 'abc def' }],
    ['clave con caracteres no permitidos', { claveIdempotencia: 'abc/def' }],
    ['huella que no es SHA-256 hexadecimal', { huellaCarrito: 'xyz' }],
    ['huella en mayúsculas', { huellaCarrito: 'A'.repeat(64) }],
    ['vencimiento igual a la creación', { reservaVenceEn: AHORA }],
    ['vencimiento anterior a la creación', { reservaVenceEn: new Date('2026-11-06T09:00:00.000Z') }],
    ['fecha de creación inválida', { creadoEn: new Date('nada') }],
    ['vencimiento inválido', { reservaVenceEn: new Date('nada') }],
  ] as [string, Partial<DatosNuevoPedido>][])('rechaza %s', (_n, extra) => {
    expect(() => crear([linea(1, 1, 1, 100)], extra)).toThrow(ErrorDeValidacion);
  });

  it('acepta claves de 1 y 100 caracteres con el alfabeto permitido', () => {
    expect(crear([linea(1, 1, 1, 100)], { claveIdempotencia: 'a' }).claveIdempotencia).toBe('a');
    expect(crear([linea(1, 1, 1, 100)], { claveIdempotencia: 'A-z_0.9:x'.padEnd(100, 'k') }).claveIdempotencia).toHaveLength(100);
  });
});

describe('inmutabilidad', () => {
  it('modificar la lista de entrada después de crear no altera el pedido', () => {
    const lineas = [linea(1, 1, 2, 100)];
    const p = crear(lineas);
    lineas[0]!.cantidad = 99;
    lineas.push(linea(2, 2, 1, 100));
    expect(p.subpedidos).toHaveLength(1);
    expect(p.totalCentimos).toBe(200);
    expect(p.subpedidos[0]!.lineas[0]!.cantidad).toBe(2);
  });

  it('líneas, subpedidos e historial no se pueden alterar desde fuera', () => {
    const p = crear([linea(1, 1, 2, 100)]);
    const s = p.subpedidos[0]!;
    expect(() => (p.subpedidos as unknown[]).push({})).toThrow(TypeError);
    expect(() => (s.lineas as unknown[]).push({})).toThrow(TypeError);
    expect(() => (s.historial as unknown[]).push({})).toThrow(TypeError);
    expect(() => { (s.lineas[0] as { cantidad: number }).cantidad = 5; }).toThrow(TypeError);
    expect(() => { (s.historial[0] as { estadoNuevo: string }).estadoNuevo = 'ENTREGADO'; }).toThrow(TypeError);
    expect(() => { (p as { totalCentimos: number }).totalCentimos = 1; }).toThrow(TypeError);
    expect(() => { (s as { estado: string }).estado = 'ENTREGADO'; }).toThrow(TypeError);
    expect(p.totalCentimos).toBe(200);
  });
});

describe('código del pedido', () => {
  it('conCodigo devuelve un pedido con el código y no cambia el original', () => {
    const p = crear([linea(1, 1, 1, 100)]);
    const q = p.conCodigo('PED-7K3MQ9XA');
    expect(q.codigo).toBe('PED-7K3MQ9XA');
    expect(p.codigo).toBeNull();
    expect(q.id).toBe(p.id);
    expect(q.totalCentimos).toBe(p.totalCentimos);
    expect(q.subpedidos).toEqual(p.subpedidos);
  });

  it('rechaza un código con formato inválido y una segunda asignación', () => {
    const p = crear([linea(1, 1, 1, 100)]);
    expect(() => p.conCodigo('PED-1234567')).toThrow(ErrorDeValidacion);
    expect(() => p.conCodigo('PED-1234567I')).toThrow(ErrorDeValidacion);
    expect(() => p.conCodigo('abc')).toThrow(ErrorDeValidacion);
    expect(() => p.conCodigo('PED-7K3MQ9XA').conCodigo('PED-7K3MQ9XB')).toThrow(ErrorDeValidacion);
  });
});

describe('estado general del pedido y transiciones de subpedido (CA-O19, CA-O25)', () => {
  const ctx = (n: number) => ({ origen: 'PAGO', actorId: null, creadoEn: new Date(AHORA.getTime() + n * 1000) });

  it('al nacer, todos los subpedidos están en ESPERANDO_PAGO y el estado general es ESPERANDO_PAGO', () => {
    const p = crear([linea(1, 1, 1, 100), linea(2, 2, 1, 100), linea(3, 3, 1, 100)]);
    expect(p.subpedidos.every((s) => s.estado === 'ESPERANDO_PAGO')).toBe(true);
    expect(p.estadoGeneral).toBe('ESPERANDO_PAGO');
  });

  it('una transición válida devuelve un subpedido nuevo con su entrada de historial; el original no cambia', () => {
    const s0 = crear([linea(1, 1, 1, 100)]).subpedidos[0]!;
    const s1 = s0.transicionar(EstadoSubpedido.PAGO_APROBADO, ctx(1));
    expect(s1.estado).toBe('PAGO_APROBADO');
    expect(s1.historial).toHaveLength(2);
    expect(s1.historial[1]).toEqual({ estadoAnterior: 'ESPERANDO_PAGO', estadoNuevo: 'PAGO_APROBADO', origen: 'PAGO', actorId: null, creadoEn: new Date(AHORA.getTime() + 1000) });
    expect(s1.historial[0]).toEqual(s0.historial[0]);
    expect(s0.estado).toBe('ESPERANDO_PAGO');
    expect(s0.historial).toHaveLength(1);
    expect(s1.subtotalCentimos).toBe(s0.subtotalCentimos);
    expect(s1.lineas).toEqual(s0.lineas);
    expect(s1.id).toBe(s0.id);
  });

  it('recorre el camino feliz completo y registra cada paso', () => {
    let s = crear([linea(1, 1, 1, 100)]).subpedidos[0]!;
    const camino = [EstadoSubpedido.PAGO_APROBADO, EstadoSubpedido.EN_PREPARACION, EstadoSubpedido.LISTO_PARA_RETIRO, EstadoSubpedido.ENTREGADO];
    camino.forEach((e, i) => { s = s.transicionar(e, ctx(i + 1)); });
    expect(s.historial.map((h) => h.estadoNuevo)).toEqual(['ESPERANDO_PAGO', ...camino]);
    expect(s.historial.map((h) => h.estadoAnterior)).toEqual([null, 'ESPERANDO_PAGO', ...camino.slice(0, 3)]);
  });

  it.each([
    [EstadoSubpedido.ENTREGADO], [EstadoSubpedido.EN_PREPARACION], [EstadoSubpedido.LISTO_PARA_RETIRO], [EstadoSubpedido.ESPERANDO_PAGO],
  ])('una transición inválida (ESPERANDO_PAGO → %s) lanza TransicionEstadoInvalidaError y no cambia nada', (hacia) => {
    const s = crear([linea(1, 1, 1, 100)]).subpedidos[0]!;
    expect(() => s.transicionar(hacia, ctx(1))).toThrow(TransicionEstadoInvalidaError);
    expect(s.estado).toBe('ESPERANDO_PAGO');
    expect(s.historial).toHaveLength(1);
  });

  it('el error de transición inválida es un conflicto e indica los estados', () => {
    const s = crear([linea(1, 1, 1, 100)]).subpedidos[0]!;
    try {
      s.transicionar(EstadoSubpedido.ENTREGADO, ctx(1));
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(TransicionEstadoInvalidaError);
      expect((e as TransicionEstadoInvalidaError).codigo).toBe('CONFLICTO');
      expect((e as TransicionEstadoInvalidaError).desde).toBe('ESPERANDO_PAGO');
      expect((e as TransicionEstadoInvalidaError).hacia).toBe('ENTREGADO');
    }
  });

  it('un estado terminal no admite ninguna transición', () => {
    const s = crear([linea(1, 1, 1, 100)]).subpedidos[0]!.transicionar(EstadoSubpedido.CANCELADO, ctx(1));
    expect(() => s.transicionar(EstadoSubpedido.PAGO_APROBADO, ctx(2))).toThrow(TransicionEstadoInvalidaError);
    expect(s.estado).toBe('CANCELADO');
  });

  it('rechaza un estado que no existe y un origen vacío o de más de 50 caracteres', () => {
    const s = crear([linea(1, 1, 1, 100)]).subpedidos[0]!;
    expect(() => s.transicionar('MIXTO' as never, ctx(1))).toThrow(TransicionEstadoInvalidaError);
    expect(() => s.transicionar(EstadoSubpedido.PAGO_APROBADO, { ...ctx(1), origen: '' })).toThrow(ErrorDeValidacion);
    expect(() => s.transicionar(EstadoSubpedido.PAGO_APROBADO, { ...ctx(1), origen: 'x'.repeat(51) })).toThrow(ErrorDeValidacion);
    expect(() => s.transicionar(EstadoSubpedido.PAGO_APROBADO, { ...ctx(1), creadoEn: new Date('nada') })).toThrow(ErrorDeValidacion);
  });
});
