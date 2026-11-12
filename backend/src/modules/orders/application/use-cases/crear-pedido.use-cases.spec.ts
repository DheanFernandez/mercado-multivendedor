/**
 * T007 · `CrearPedido` con dobles (spec 003-pedidos-subpedidos; RF25, RF26 · CA-O6, O7, O8, O10, O24, O26).
 * Los dobles reproducen el contrato de la unidad de trabajo (rollback, reintento del bloque completo, operaciones que exigen
 * unidad). Estas pruebas NO demuestran el bloqueo por cliente ni las restricciones reales de PostgreSQL (T016–T019).
 */
import { describe, expect, it } from 'vitest';
import { Rol, type Actor } from '../../../../shared/domain/actor.js';
import { ErrorDeValidacion, ErrorProhibido, ErrorServicioNoDisponible } from '../../../../shared/domain/errors.js';
import { esCodigoPedidoValido } from '../../domain/codigo-pedido.js';
import { CarritoVacioError, LineasNoVigentesError } from '../../domain/errors.js';
import { huellaCarrito } from '../../domain/huella-carrito.js';
import type { LineaParaPedido } from '../ports/carrito.port.js';
import { ConfiguracionReservaNoDisponibleError } from '../ports/configuracion-reserva.port.js';
import { CodigoPedidoNoGenerableError } from '../ports/pedido.repository.js';
import { StockInsuficientePedidoError } from '../ports/reserva-inventario.port.js';
import { CrearPedido } from './crear-pedido.use-case.js';
import { ErrorTransitorioSimulado, montarDobles, type Paso } from './test-doubles.js';

const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const CLIENTE = uuid(1);
const OTRO = uuid(2);
const CARRITO = uuid(3);
const AHORA = new Date('2026-11-06T10:00:00.000Z');
const cliente = (id = CLIENTE): Actor => ({ id, rol: Rol.CLIENTE });
const PUESTOS = [1, 2, 3].map((n) => ({ id: uuid(100 + n), codigo: `P-${n}`, nombre: `Puesto ${n}` }));

const linea = (n: number, p: number, cantidad: number, precio: number, comprable = true): LineaParaPedido =>
  comprable
    ? { productoId: uuid(200 + n), puesto: { ...PUESTOS[p - 1]! }, nombre: `Producto ${n}`, unidadVenta: 'KILOGRAMO', presentacion: null, cantidad, precioUnitarioCentimos: precio, comprable: true }
    : { productoId: uuid(200 + n), puesto: null, nombre: null, unidadVenta: null, presentacion: null, cantidad, precioUnitarioCentimos: null, comprable: false };

/** Carrito de 3 puestos: 0.10 × 3, 19.99 × 3, 6.50 × 2 y 1.00 × 10. */
const CARRITO_TRES_PUESTOS = [linea(1, 1, 3, 10), linea(2, 2, 3, 1999), linea(3, 3, 2, 650), linea(4, 1, 10, 100)];

function montar(o: Parameters<typeof montarDobles>[0] = {}, lineas = CARRITO_TRES_PUESTOS, stock = 100) {
  const d = montarDobles({ ahora: AHORA, ...o });
  d.carrito.poner(CLIENTE, CARRITO, lineas);
  for (let n = 1; n <= 12; n++) d.inventario.fijarDisponible(uuid(200 + n), stock);
  const uc = new CrearPedido({ uow: d.uow, pedidos: d.pedidos, carrito: d.carrito, inventario: d.inventario, configuracion: d.configuracion, reloj: d.reloj });
  /** Estado completo de todos los almacenes (para comprobar que un fallo no deja rastro). */
  const foto = () => [d.pedidos.instantanea(), d.carrito.instantanea(), d.inventario.instantanea()];
  const crear = (clave = 'compra-1', actor = cliente()) => uc.ejecutar(actor, { claveIdempotencia: clave });
  return { ...d, uc, foto, crear };
}
const cuenta = (pasos: Paso[], p: Paso) => pasos.filter((x) => x === p).length;

describe('autorización y entrada: se rechaza antes de tocar nada', () => {
  it.each([Rol.COMERCIANTE, Rol.TRABAJADOR_PUESTO, Rol.ADMINISTRADOR])('el rol %s no puede crear pedidos (403)', async (rol) => {
    const t = montar();
    await expect(t.uc.ejecutar({ id: CLIENTE, rol }, { claveIdempotencia: 'compra-1' })).rejects.toBeInstanceOf(ErrorProhibido);
    expect(t.entorno.pasos).toEqual([]);
    expect(t.uow.unidades).toBe(0);
    expect(t.configuracion.lecturas).toBe(0);
  });

  it.each([['ausente', undefined], ['vacía', ''], ['con espacios', 'a b'], ['con barra', 'a/b'], ['de 101 caracteres', 'k'.repeat(101)], ['numérica', 123]])(
    'rechaza la clave %s (400)',
    async (_n, clave) => {
      const t = montar();
      await expect(t.uc.ejecutar(cliente(), { claveIdempotencia: clave })).rejects.toBeInstanceOf(ErrorDeValidacion);
      expect(t.entorno.pasos).toEqual([]);
      expect(t.uow.unidades).toBe(0);
    },
  );

  it('acepta claves de 1 y de 100 caracteres con el alfabeto permitido', async () => {
    const t = montar();
    expect((await t.crear('a')).creado).toBe(true);
    t.carrito.poner(CLIENTE, CARRITO, [linea(5, 1, 1, 100)]);
    expect((await t.crear('Az09:_.-'.padEnd(100, 'x'))).creado).toBe(true);
  });
});

describe('creación desde el carrito (CA-O1, O3, O5, O6)', () => {
  it('crea un pedido con un subpedido por puesto, importes exactos y precios del carrito leído', async () => {
    const t = montar();
    const { pedido, creado } = await t.crear();
    expect(creado).toBe(true);
    expect(esCodigoPedidoValido(pedido.codigo)).toBe(true);
    expect(pedido.clienteId).toBe(CLIENTE);
    expect(pedido.claveIdempotencia).toBe('compra-1');
    expect(pedido.subpedidos.map((s) => [s.puestoId, s.estado, s.subtotalCentimos])).toEqual([
      [PUESTOS[0]!.id, 'ESPERANDO_PAGO', 30 + 1000],
      [PUESTOS[1]!.id, 'ESPERANDO_PAGO', 5997],
      [PUESTOS[2]!.id, 'ESPERANDO_PAGO', 1300],
    ]);
    expect(pedido.totalCentimos).toBe(30 + 1000 + 5997 + 1300);
    const lineas = pedido.subpedidos.flatMap((s) => s.lineas);
    for (const l of CARRITO_TRES_PUESTOS) {
      expect(lineas.find((x) => x.productoId === l.productoId)).toMatchObject({ cantidad: l.cantidad, precioUnitarioCentimos: l.precioUnitarioCentimos, nombre: l.nombre, unidadVenta: l.unidadVenta });
    }
    expect(pedido.subpedidos[0]!.puesto).toEqual({ codigo: 'P-1', nombre: 'Puesto 1' });
  });

  it('guarda la trazabilidad del carrito procesado (identidad y huella) y las fechas de creación y vencimiento', async () => {
    const t = montar({ duracionMinutos: 15 });
    const { pedido } = await t.crear();
    expect(pedido.carritoId).toBe(CARRITO);
    expect(pedido.huellaCarrito).toBe(huellaCarrito(CARRITO_TRES_PUESTOS));
    expect(pedido.creadoEn).toEqual(AHORA);
    expect(pedido.reservaVenceEn).toEqual(new Date(AHORA.getTime() + 15 * 60_000));
  });

  it('persiste raíz y detalle, vacía el carrito y reserva exactamente lo pedido con la clave `pedido:<id>`', async () => {
    const t = montar({ duracionMinutos: 15 }, CARRITO_TRES_PUESTOS, 20);
    const { pedido } = await t.crear();
    expect(t.pedidos.todos().map((p) => p.id)).toEqual([pedido.id]);
    expect(t.pedidos.tieneDetalle(pedido.id)).toBe(true);
    expect(t.carrito.lineasDe(CLIENTE)).toEqual([]);
    expect(t.inventario.listaReservas()).toEqual([
      {
        claveOperacion: `pedido:${pedido.id}`,
        items: [...CARRITO_TRES_PUESTOS].sort((a, b) => (a.productoId < b.productoId ? -1 : 1)).map((l) => ({ productoId: l.productoId, cantidad: l.cantidad })),
        expiraEn: new Date(AHORA.getTime() + 15 * 60_000),
      },
    ]);
    for (const l of CARRITO_TRES_PUESTOS) expect(t.inventario.disponibleDe(l.productoId)).toBe(20 - l.cantidad);
    expect(t.uow.intentos).toBe(1);
  });

  it('los productos se reservan ordenados por producto aunque el carrito llegue en otro orden', async () => {
    const t = montar({}, [linea(9, 2, 1, 100), linea(3, 1, 1, 100), linea(6, 3, 1, 100)]);
    await t.crear();
    expect(t.inventario.listaReservas()[0]!.items.map((i) => i.productoId)).toEqual([uuid(203), uuid(206), uuid(209)]);
  });

  it('flujo del plan: consulta previa fuera; dentro de UNA unidad bloqueo, repetición, carrito, inserción, detalle, vaciado y la reserva al final', async () => {
    const t = montar();
    await t.crear();
    expect(t.entorno.pasos).toEqual([
      { paso: 'pedidos.buscarPorClave', enUnidad: false },
      { paso: 'pedidos.bloquearCliente', enUnidad: true },
      { paso: 'pedidos.buscarPorClave', enUnidad: true },
      { paso: 'carrito.obtenerParaPedido', enUnidad: true },
      { paso: 'pedidos.insertar', enUnidad: true },
      { paso: 'pedidos.guardarDetalle', enUnidad: true },
      { paso: 'carrito.vaciar', enUnidad: true },
      { paso: 'inventario.reservar', enUnidad: true },
    ]);
    expect(t.pedidos.bloqueos).toEqual([CLIENTE]);
    expect(t.uow.unidades).toBe(1);
  });

  it('un carrito de un solo puesto produce un único subpedido', async () => {
    const t = montar({}, [linea(1, 2, 1, 100), linea(2, 2, 4, 250)]);
    const { pedido } = await t.crear();
    expect(pedido.subpedidos).toHaveLength(1);
    expect(pedido.totalCentimos).toBe(1100);
  });

  it('lee la duración en cada creación (sin valor guardado) y admite los límites 1 y 99 999 999', async () => {
    const t = montar({ duracionMinutos: 1 });
    const a = await t.crear('c-1');
    t.configuracion.valor = 99_999_999;
    t.carrito.poner(CLIENTE, CARRITO, [linea(5, 1, 1, 100)]);
    const b = await t.crear('c-2');
    expect(a.pedido.reservaVenceEn).toEqual(new Date(AHORA.getTime() + 60_000));
    expect(b.pedido.reservaVenceEn).toEqual(new Date(AHORA.getTime() + 99_999_999 * 60_000));
    expect(t.configuracion.lecturas).toBe(2);
  });
});

describe('rechazos sin crear nada (CA-O7, O8, O24) y sin reintentar errores de dominio', () => {
  it('cliente sin carrito ⇒ carrito vacío (409), sin escribir y en un solo intento', async () => {
    const t = montar();
    const antes = t.foto();
    await expect(t.crear('compra-1', cliente(OTRO))).rejects.toBeInstanceOf(CarritoVacioError);
    expect(t.foto()).toEqual(antes);
    expect(t.uow.intentos).toBe(1);
  });

  it('carrito existente pero vacío ⇒ carrito vacío (409)', async () => {
    const t = montar({}, []);
    const antes = t.foto();
    await expect(t.crear()).rejects.toBeInstanceOf(CarritoVacioError);
    expect(t.foto()).toEqual(antes);
    expect(t.uow.intentos).toBe(1);
  });

  it('líneas no vigentes ⇒ 409 que identifica los productos; el carrito conserva todo y no se reserva nada', async () => {
    const t = montar({}, [linea(1, 1, 1, 100), linea(7, 1, 2, 0, false), linea(4, 2, 1, 100, false)]);
    const antes = t.foto();
    const e = await t.crear().catch((x: unknown) => x);
    expect(e).toBeInstanceOf(LineasNoVigentesError);
    expect((e as LineasNoVigentesError).productoIds).toEqual([uuid(204), uuid(207)]);
    expect((e as LineasNoVigentesError).codigo).toBe('CONFLICTO');
    expect(t.foto()).toEqual(antes);
    expect(t.carrito.lineasDe(CLIENTE)).toHaveLength(3);
    expect(t.uow.intentos).toBe(1);
  });

  it('falta de stock en un producto ⇒ 409 con el producto; sin pedido, sin reservas parciales y con el carrito intacto', async () => {
    const t = montar();
    t.inventario.fijarDisponible(uuid(203), 1); // pide 2
    const antes = t.foto();
    const e = await t.crear().catch((x: unknown) => x);
    expect(e).toBeInstanceOf(StockInsuficientePedidoError);
    expect((e as StockInsuficientePedidoError).productoId).toBe(uuid(203));
    expect(t.foto()).toEqual(antes);
    expect(t.pedidos.todos()).toEqual([]);
    expect(t.inventario.listaReservas()).toEqual([]);
    expect(t.carrito.lineasDe(CLIENTE)).toHaveLength(4);
    expect(t.uow.intentos).toBe(1);
  });

  it('un rechazo no consume la clave: tras corregir, la misma clave crea el pedido (201)', async () => {
    const t = montar();
    t.inventario.fijarDisponible(uuid(203), 1);
    await expect(t.crear()).rejects.toBeInstanceOf(StockInsuficientePedidoError);
    t.inventario.fijarDisponible(uuid(203), 5);
    const r = await t.crear();
    expect(r.creado).toBe(true);
    expect(t.pedidos.todos()).toHaveLength(1);
  });

  it('configuración ausente en una creación NUEVA ⇒ 503 tras comprobar que no hay repetición, sin abrir la unidad (DI-2)', async () => {
    const t = montar({ duracionMinutos: new ConfiguracionReservaNoDisponibleError() });
    const antes = t.foto();
    const e = await t.crear().catch((x: unknown) => x);
    expect(e).toBeInstanceOf(ConfiguracionReservaNoDisponibleError);
    expect(e).toBeInstanceOf(ErrorServicioNoDisponible);
    expect(t.uow.unidades).toBe(0);
    expect(t.entorno.pasos).toEqual([{ paso: 'pedidos.buscarPorClave', enUnidad: false }]);
    expect(t.configuracion.lecturas).toBe(1);
    expect(t.foto()).toEqual(antes);
  });

  it.each([[0], [-1], [1.5], [Number.NaN], [Number.POSITIVE_INFINITY], [100_000_000], ['30']])('duración inválida (%s) ⇒ 503 sin crear nada', async (valor) => {
    const t = montar({ duracionMinutos: valor as number });
    await expect(t.crear()).rejects.toBeInstanceOf(ConfiguracionReservaNoDisponibleError);
    expect(t.uow.unidades).toBe(0);
    expect(t.pedidos.todos()).toEqual([]);
  });
});

describe('idempotencia por (cliente, clave) (CA-O10)', () => {
  it('repetir la clave devuelve el MISMO pedido (200) aunque el carrito ya esté vacío, sin reservar de nuevo ni abrir unidad', async () => {
    const t = montar();
    const primero = await t.crear();
    const reservas = t.inventario.listaReservas();
    const unidades = t.uow.unidades;
    const segundo = await t.crear();
    expect(segundo.creado).toBe(false);
    expect(segundo.pedido).toBe(primero.pedido);
    expect(t.inventario.listaReservas()).toEqual(reservas);
    expect(t.pedidos.todos()).toHaveLength(1);
    expect(t.uow.unidades).toBe(unidades);
  });

  it('repetir la clave con OTRO contenido en el carrito devuelve el pedido anterior y no toca el carrito (no compara contenido)', async () => {
    const t = montar();
    const primero = await t.crear();
    t.carrito.poner(CLIENTE, CARRITO, [linea(8, 2, 1, 500)]);
    const segundo = await t.crear();
    expect(segundo).toEqual({ pedido: primero.pedido, creado: false });
    expect(t.carrito.lineasDe(CLIENTE)).toHaveLength(1);
    expect(t.inventario.listaReservas()).toHaveLength(1);
  });

  it('si la misma clave se confirma entre la consulta previa y la unidad, la unidad devuelve ese pedido sin leer el carrito ni reservar', async () => {
    const t = montar();
    let concurrente: Awaited<ReturnType<typeof t.crear>> | undefined;
    t.entorno.alPasar('pedidos.buscarPorClave', async () => { concurrente = await t.crear(); });
    const r = await t.crear();
    expect(concurrente?.creado).toBe(true);
    expect(r.creado).toBe(false);
    expect(r.pedido).toEqual(concurrente!.pedido);
    expect(t.pedidos.todos()).toHaveLength(1);
    expect(t.inventario.listaReservas()).toHaveLength(1);
    expect(cuenta(t.entorno.nombresDePasos(), 'carrito.obtenerParaPedido')).toBe(1); // solo el concurrente leyó el carrito
    expect(t.pedidos.bloqueos).toEqual([CLIENTE, CLIENTE]); // la segunda pasó por el bloqueo antes de comprobar
  });

  it.each([
    ['ausente', () => new ConfiguracionReservaNoDisponibleError()],
    ['inválida (0)', () => 0],
  ] as [string, () => number | Error][])(
    'repetir una creación exitosa devuelve el MISMO pedido aunque la configuración esté %s: no se lee ni se reserva (DI-2)',
    async (_n, configuracion) => {
      const t = montar();
      const primero = await t.crear();
      const reservas = t.inventario.listaReservas();
      const lecturas = t.configuracion.lecturas;
      t.configuracion.valor = configuracion();
      const segundo = await t.crear();
      expect(segundo).toEqual({ pedido: primero.pedido, creado: false });
      expect(t.configuracion.lecturas).toBe(lecturas); // la configuración solo se consulta para creaciones nuevas
      expect(t.inventario.listaReservas()).toEqual(reservas);
      expect(t.uow.unidades).toBe(1);
      // una clave NUEVA con la configuración no disponible sigue respondiendo 503
      t.carrito.poner(CLIENTE, CARRITO, [linea(5, 1, 1, 100)]);
      await expect(t.crear('compra-2')).rejects.toBeInstanceOf(ConfiguracionReservaNoDisponibleError);
      expect(t.pedidos.todos()).toHaveLength(1);
    },
  );

  it('la clave pertenece al cliente: otro cliente con la misma clave crea su propio pedido; otra clave crea otro pedido', async () => {
    const t = montar();
    t.carrito.poner(OTRO, uuid(4), [linea(5, 2, 1, 300)]);
    const a = await t.crear('misma');
    const b = await t.crear('misma', cliente(OTRO));
    expect(b.creado).toBe(true);
    expect(b.pedido.id).not.toBe(a.pedido.id);
    expect(b.pedido.clienteId).toBe(OTRO);
    t.carrito.poner(CLIENTE, CARRITO, [linea(6, 3, 2, 300)]);
    const c = await t.crear('otra');
    expect(c.creado).toBe(true);
    expect(t.pedidos.todos()).toHaveLength(3);
  });
});

describe('reintentos de la unidad completa (FR-010)', () => {
  it('un error transitorio reintenta TODO el bloque (bloqueo, lectura, inserción…) y confirma un único pedido', async () => {
    const t = montar();
    t.entorno.fallarEn('inventario.reservar', new ErrorTransitorioSimulado(), 2);
    const { pedido, creado } = await t.crear();
    expect(creado).toBe(true);
    expect(t.uow.intentos).toBe(3);
    expect(t.uow.unidades).toBe(1);
    const pasos = t.entorno.nombresDePasos();
    expect(cuenta(pasos, 'pedidos.bloquearCliente')).toBe(3);
    expect(cuenta(pasos, 'carrito.obtenerParaPedido')).toBe(3);
    expect(cuenta(pasos, 'pedidos.insertar')).toBe(3);
    expect(t.pedidos.todos().map((p) => p.id)).toEqual([pedido.id]);
    expect(t.inventario.listaReservas().map((r) => r.claveOperacion)).toEqual([`pedido:${pedido.id}`]);
    expect(t.carrito.lineasDe(CLIENTE)).toEqual([]);
  });

  it.each(['pedidos.bloquearCliente', 'carrito.obtenerParaPedido', 'pedidos.insertar', 'pedidos.guardarDetalle', 'carrito.vaciar'] as Paso[])(
    'un transitorio en %s también se recupera con otro intento',
    async (paso) => {
      const t = montar();
      t.entorno.fallarEn(paso, new ErrorTransitorioSimulado());
      expect((await t.crear()).creado).toBe(true);
      expect(t.uow.intentos).toBe(2);
      expect(t.pedidos.todos()).toHaveLength(1);
      expect(t.inventario.listaReservas()).toHaveLength(1);
    },
  );

  it('agotados 5 intentos transitorios ⇒ 503 y ningún rastro', async () => {
    const t = montar();
    t.entorno.fallarEn('inventario.reservar', () => new ErrorTransitorioSimulado(), 5);
    const antes = t.foto();
    const e = await t.crear().catch((x: unknown) => x);
    expect(e).toBeInstanceOf(ErrorServicioNoDisponible);
    expect((e as Error).cause).toBeInstanceOf(ErrorTransitorioSimulado);
    expect(t.uow.intentos).toBe(5);
    expect(t.foto()).toEqual(antes);
  });
});

describe('colisión de código (CA-O26)', () => {
  it('un código ya usado se sustituye dentro de la inserción sin consumir intentos de la transacción', async () => {
    const t = montar({ codigos: ['PED-AAAAAAAA', 'PED-BBBBBBBB'] });
    t.pedidos.codigosOcupados.add('PED-AAAAAAAA');
    const { pedido } = await t.crear();
    expect(pedido.codigo).toBe('PED-BBBBBBBB');
    expect(t.generador.generados).toBe(2);
    expect(t.uow.intentos).toBe(1);
  });

  it('5 colisiones seguidas ⇒ 503 sin reintentar la transacción y sin dejar nada', async () => {
    const t = montar({ codigos: Array(5).fill('PED-AAAAAAAA') });
    t.pedidos.codigosOcupados.add('PED-AAAAAAAA');
    const antes = t.foto();
    await expect(t.crear()).rejects.toBeInstanceOf(CodigoPedidoNoGenerableError);
    expect(t.uow.intentos).toBe(1);
    expect(t.foto()).toEqual(antes);
  });
});

describe('fallo forzado en cada paso: no queda estado parcial (EQ-02)', () => {
  it.each(['pedidos.bloquearCliente', 'carrito.obtenerParaPedido', 'pedidos.insertar', 'pedidos.guardarDetalle', 'carrito.vaciar', 'inventario.reservar'] as Paso[])(
    'un fallo no transitorio tras %s restaura todos los almacenes, se propaga tal cual y no se reintenta',
    async (paso) => {
      const t = montar();
      const fallo = new Error(`fallo forzado en ${paso}`);
      t.entorno.fallarEn(paso, fallo);
      const antes = t.foto();
      await expect(t.crear()).rejects.toBe(fallo);
      expect(t.foto()).toEqual(antes);
      expect(t.uow.intentos).toBe(1);
      expect(t.carrito.lineasDe(CLIENTE)).toHaveLength(4);
      expect((await t.crear()).creado).toBe(true); // la misma clave sigue disponible
    },
  );

  it('un fallo en la consulta previa (fuera de la unidad) se propaga sin abrir la unidad', async () => {
    const t = montar();
    t.entorno.fallarEn('pedidos.buscarPorClave', new Error('caída'));
    await expect(t.crear()).rejects.toThrow('caída');
    expect(t.uow.unidades).toBe(0);
  });
});
