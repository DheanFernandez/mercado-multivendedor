/**
 * T011 · Esquema y migración ADITIVA de Pedidos (spec 003-pedidos-subpedidos; data-model §2–§3 · AC08).
 * Verifica, en el catálogo de PostgreSQL de la base local aislada, que la migración creó exactamente lo previsto:
 * tablas y columnas, enumeración, únicos, índices, claves foráneas (incluidas las compuestas), CHECK, triggers de
 * inmutabilidad sin triggers diferidos, RLS sin políticas; que es aditiva; y que `schema.prisma` coincide con la base.
 *
 * El COMPORTAMIENTO de esas restricciones (rechazos de CHECK, únicos, FK compuestas, triggers, RLS) se prueba en T016.
 */
import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { exigirBaseAislada } from '../scripts/base-aislada.mjs';
import { abrirBase } from './helpers/inventario-db.js';

const { prisma, url } = abrirBase(2);
const TABLAS = ['pedidos', 'subpedidos', 'lineas_pedido', 'historial_estados_subpedido'] as const;
const RAIZ = fileURLToPath(new URL('..', import.meta.url));

const filas = <T>(sql: string, ...p: unknown[]) => prisma.$queryRawUnsafe<T[]>(sql, ...p);

beforeAll(async () => { await prisma.$connect(); });
afterAll(async () => { await prisma.$disconnect(); });

describe('enumeración EstadoPedidoPuesto', () => {
  it('tiene los siete estados de C4 N4 §3, en orden, y no incluye MIXTO', async () => {
    const r = await filas<{ e: string }>(`SELECT e.enumlabel AS e FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid WHERE t.typname = 'EstadoPedidoPuesto' ORDER BY e.enumsortorder`);
    expect(r.map((x) => x.e)).toEqual(['ESPERANDO_PAGO', 'PAGO_APROBADO', 'EN_PREPARACION', 'LISTO_PARA_RETIRO', 'ENTREGADO', 'EXPIRADO', 'CANCELADO']);
  });
});

describe('tablas y columnas (data-model §2)', () => {
  type Col = { tabla: string; columna: string; tipo: string; nula: boolean; defecto: string | null };
  let columnas: Col[] = [];
  beforeAll(async () => {
    columnas = await filas<Col>(
      `SELECT c.relname AS tabla, a.attname AS columna, format_type(a.atttypid, a.atttypmod) AS tipo, NOT a.attnotnull AS nula, pg_get_expr(d.adbin, d.adrelid) AS defecto
         FROM pg_attribute a JOIN pg_class c ON c.oid = a.attrelid JOIN pg_namespace n ON n.oid = c.relnamespace
         LEFT JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
        WHERE n.nspname = 'public' AND c.relname = ANY($1) AND a.attnum > 0 AND NOT a.attisdropped`,
      [...TABLAS],
    );
  });
  const de = (t: string) => Object.fromEntries(columnas.filter((c) => c.tabla === t).map((c) => [c.columna, `${c.tipo}${c.nula ? ' NULL' : ''}`]));

  it('pedidos', () => {
    expect(de('pedidos')).toEqual({
      id: 'uuid', codigo: 'text', cliente_id: 'uuid', clave_idempotencia: 'text', carrito_id: 'uuid', huella_carrito: 'character(64)',
      total: 'numeric(16,2)', reserva_vence_en: 'timestamp(3) with time zone', creado_en: 'timestamp(3) with time zone',
    });
  });
  it('subpedidos (con instantánea del puesto)', () => {
    expect(de('subpedidos')).toEqual({
      id: 'uuid', pedido_id: 'uuid', puesto_id: 'uuid', puesto_codigo: 'text', puesto_nombre: 'text', estado: '"EstadoPedidoPuesto"',
      subtotal: 'numeric(16,2)', creado_en: 'timestamp(3) with time zone', actualizado_en: 'timestamp(3) with time zone',
    });
  });
  it('lineas_pedido (instantánea del producto y precio histórico)', () => {
    expect(de('lineas_pedido')).toEqual({
      id: 'uuid', subpedido_id: 'uuid', puesto_id: 'uuid', producto_id: 'uuid', nombre_producto: 'text', unidad_venta: '"UnidadVenta"',
      presentacion: 'text NULL', cantidad: 'integer', precio_unitario: 'numeric(10,2)', subtotal: 'numeric(14,2)',
    });
  });
  it('historial_estados_subpedido', () => {
    expect(de('historial_estados_subpedido')).toEqual({
      id: 'uuid', subpedido_id: 'uuid', estado_anterior: '"EstadoPedidoPuesto" NULL', estado_nuevo: '"EstadoPedidoPuesto"', origen: 'text',
      actor_id: 'uuid NULL', creado_en: 'timestamp(3) with time zone',
    });
  });
  it('valores por defecto: estado inicial ESPERANDO_PAGO y fechas con now()', () => {
    const d = (t: string, c: string) => columnas.find((x) => x.tabla === t && x.columna === c)?.defecto ?? null;
    expect(d('subpedidos', 'estado')).toBe(`'ESPERANDO_PAGO'::"EstadoPedidoPuesto"`);
    for (const [t, c] of [['pedidos', 'creado_en'], ['subpedidos', 'creado_en'], ['subpedidos', 'actualizado_en'], ['historial_estados_subpedido', 'creado_en']]) {
      expect(d(t!, c!), `${t}.${c}`).toBe('CURRENT_TIMESTAMP');
    }
  });
});

describe('únicos e índices', () => {
  it('únicos: código, (cliente, clave), (pedido, puesto), (id, puesto) del subpedido y (subpedido, producto)', async () => {
    const r = await filas<{ t: string; def: string }>(
      `SELECT c.relname AS t, pg_get_indexdef(i.indexrelid) AS def FROM pg_index i JOIN pg_class c ON c.oid = i.indrelid
        WHERE c.relname = ANY($1) AND i.indisunique AND NOT i.indisprimary`,
      [...TABLAS],
    );
    const cols = r.map((x) => `${x.t}(${/\((.*)\)$/.exec(x.def)![1]})`).sort();
    expect(cols).toEqual([
      'lineas_pedido(subpedido_id, producto_id)',
      'pedidos(cliente_id, clave_idempotencia)',
      'pedidos(codigo)',
      'subpedidos(id, puesto_id)',
      'subpedidos(pedido_id, puesto_id)',
    ]);
  });
  it('índices de consulta: lista del cliente, consulta por puesto e historial cronológico', async () => {
    const r = await filas<{ def: string }>(
      `SELECT pg_get_indexdef(i.indexrelid) AS def FROM pg_index i JOIN pg_class c ON c.oid = i.indrelid WHERE c.relname = ANY($1) AND NOT i.indisunique`,
      [...TABLAS],
    );
    const defs = r.map((x) => x.def.replace(/^.* ON public\./, ''));
    expect(defs).toEqual(expect.arrayContaining([
      'pedidos USING btree (cliente_id, creado_en DESC, id)',
      'subpedidos USING btree (puesto_id, estado)',
      'historial_estados_subpedido USING btree (subpedido_id, creado_en)',
    ]));
  });
});

describe('claves foráneas RESTRICT (incluidas las compuestas)', () => {
  it('cada referencia prevista existe con ON DELETE RESTRICT; carrito_id y actor_id no tienen clave foránea', async () => {
    const r = await filas<{ t: string; def: string }>(
      `SELECT c.relname AS t, pg_get_constraintdef(k.oid) AS def FROM pg_constraint k JOIN pg_class c ON c.oid = k.conrelid
        WHERE k.contype = 'f' AND c.relname = ANY($1)`,
      [...TABLAS],
    );
    const fk = r.map((x) => `${x.t}: ${x.def}`).sort();
    expect(fk).toEqual([
      'historial_estados_subpedido: FOREIGN KEY (subpedido_id) REFERENCES subpedidos(id) ON UPDATE RESTRICT ON DELETE RESTRICT',
      'lineas_pedido: FOREIGN KEY (producto_id, puesto_id) REFERENCES productos(id, "puestoId") ON UPDATE RESTRICT ON DELETE RESTRICT',
      'lineas_pedido: FOREIGN KEY (subpedido_id, puesto_id) REFERENCES subpedidos(id, puesto_id) ON UPDATE RESTRICT ON DELETE RESTRICT',
      'pedidos: FOREIGN KEY (cliente_id) REFERENCES usuarios(id) ON UPDATE RESTRICT ON DELETE RESTRICT',
      'subpedidos: FOREIGN KEY (pedido_id) REFERENCES pedidos(id) ON UPDATE RESTRICT ON DELETE RESTRICT',
      'subpedidos: FOREIGN KEY (puesto_id) REFERENCES puestos(id) ON UPDATE RESTRICT ON DELETE RESTRICT',
    ]);
  });
});

describe('restricciones CHECK (data-model §2)', () => {
  it('existen todas las previstas, con las columnas y reglas indicadas', async () => {
    const r = await filas<{ nombre: string; def: string }>(
      `SELECT k.conname AS nombre, pg_get_constraintdef(k.oid) AS def FROM pg_constraint k JOIN pg_class c ON c.oid = k.conrelid
        WHERE k.contype = 'c' AND c.relname = ANY($1) ORDER BY 1`,
      [...TABLAS],
    );
    const def = Object.fromEntries(r.map((x) => [x.nombre, x.def]));
    expect(Object.keys(def).sort()).toEqual([
      'historial_estados_subpedido_estados_chk', 'historial_estados_subpedido_origen_chk',
      'lineas_pedido_cantidad_chk', 'lineas_pedido_precio_chk', 'lineas_pedido_subtotal_chk',
      'pedidos_clave_chk', 'pedidos_codigo_chk', 'pedidos_huella_chk', 'pedidos_total_chk',
      'subpedidos_subtotal_chk',
    ]);
    expect(def['pedidos_codigo_chk']).toContain(`'^PED-[0-9A-HJKMNP-TV-Z]{8}$'`);
    expect(def['pedidos_clave_chk']).toMatch(/length\(clave_idempotencia\) >= 1\).*length\(clave_idempotencia\) <= 100\).*'\^\[A-Za-z0-9:_\.-\]\+\$'/);
    expect(def['pedidos_huella_chk']).toContain(`'^[0-9a-f]{64}$'`);
    expect(def['pedidos_total_chk']).toMatch(/total > \(?0\)?(::numeric)?\)/);
    expect(def['subpedidos_subtotal_chk']).toMatch(/subtotal > \(?0\)?(::numeric)?\)/);
    expect(def['lineas_pedido_cantidad_chk']).toMatch(/cantidad >= 1\).*cantidad <= 10000\)/);
    expect(def['lineas_pedido_precio_chk']).toMatch(/precio_unitario > \(?0\)?(::numeric)?\)/);
    expect(def['lineas_pedido_subtotal_chk']).toMatch(/subtotal = \(precio_unitario \* \(?\(?cantidad\)?::numeric\)?\)/);
    expect(def['historial_estados_subpedido_estados_chk']).toMatch(/estado_anterior IS DISTINCT FROM estado_nuevo/);
    expect(def['historial_estados_subpedido_origen_chk']).toMatch(/length\(origen\) >= 1\).*length\(origen\) <= 50\)/);
  });
});

describe('triggers de inmutabilidad (data-model §3)', () => {
  it('BEFORE UPDATE/DELETE en líneas e historial; BEFORE UPDATE en pedidos y subpedidos; todos por fila', async () => {
    const r = await filas<{ t: string; evento: string; momento: string; orientacion: string }>(
      `SELECT event_object_table AS t, event_manipulation AS evento, action_timing AS momento, action_orientation AS orientacion
         FROM information_schema.triggers WHERE event_object_table = ANY($1)`,
      [...TABLAS],
    );
    expect(r.map((x) => `${x.t} ${x.momento} ${x.evento} ${x.orientacion}`).sort()).toEqual([
      'historial_estados_subpedido BEFORE DELETE ROW',
      'historial_estados_subpedido BEFORE UPDATE ROW',
      'lineas_pedido BEFORE DELETE ROW',
      'lineas_pedido BEFORE UPDATE ROW',
      'pedidos BEFORE UPDATE ROW',
      'subpedidos BEFORE UPDATE ROW',
    ]);
  });

  it('sin triggers diferidos (los totales se garantizan en el dominio, no en la base)', async () => {
    const r = await filas<{ n: number }>(
      `SELECT count(*)::int AS n FROM pg_trigger g JOIN pg_class c ON c.oid = g.tgrelid WHERE c.relname = ANY($1) AND NOT g.tgisinternal AND (g.tgdeferrable OR g.tgconstraint <> 0)`,
      [...TABLAS],
    );
    expect(r[0]!.n).toBe(0);
  });

  it('el trigger de subpedidos solo admite cambiar estado y actualizado_en; el de pedidos protege código, cliente, clave, carrito, huella, total y vencimiento', async () => {
    const r = await filas<{ t: string; fuente: string }>(
      `SELECT c.relname AS t, p.prosrc AS fuente FROM pg_trigger g JOIN pg_class c ON c.oid = g.tgrelid JOIN pg_proc p ON p.oid = g.tgfoid
        WHERE c.relname IN ('pedidos', 'subpedidos') AND NOT g.tgisinternal`,
    );
    const fuente = Object.fromEntries(r.map((x) => [x.t, x.fuente]));
    for (const col of ['codigo', 'cliente_id', 'clave_idempotencia', 'carrito_id', 'huella_carrito', 'total', 'reserva_vence_en']) expect(fuente['pedidos']).toContain(`NEW.${col}`);
    for (const col of ['pedido_id', 'puesto_id', 'puesto_codigo', 'puesto_nombre', 'subtotal']) expect(fuente['subpedidos']).toContain(`NEW.${col}`);
    expect(fuente['subpedidos']).not.toContain('NEW.estado ');
    expect(fuente['subpedidos']).not.toContain('NEW.actualizado_en');
  });
});

describe('RLS', () => {
  it('habilitado en las cuatro tablas y sin políticas (solo el backend con el rol postgres)', async () => {
    const r = await filas<{ t: string; rls: boolean }>(`SELECT relname AS t, relrowsecurity AS rls FROM pg_class WHERE relname = ANY($1) AND relkind = 'r'`, [...TABLAS]);
    expect(r.map((x) => `${x.t}:${x.rls}`).sort()).toEqual(TABLAS.map((t) => `${t}:true`).sort());
    const p = await filas<{ n: number }>(`SELECT count(*)::int AS n FROM pg_policies WHERE tablename = ANY($1)`, [...TABLAS]);
    expect(p[0]!.n).toBe(0);
  });
});

describe('migración aditiva y sincronía con schema.prisma', () => {
  const dir = readdirSync(join(RAIZ, 'prisma', 'migrations')).filter((d) => /^\d{14}_pedidos$/.test(d));

  it('existe UNA migración `<ts>_pedidos`, posterior a las anteriores, y está aplicada en la base aislada', async () => {
    expect(dir).toHaveLength(1);
    const todas = readdirSync(join(RAIZ, 'prisma', 'migrations')).filter((d) => /^\d{14}_/.test(d)).sort();
    expect(todas.at(-1)).toBe(dir[0]);
    const r = await filas<{ ok: boolean }>(`SELECT finished_at IS NOT NULL AND rolled_back_at IS NULL AS ok FROM _prisma_migrations WHERE migration_name = $1`, dir[0]);
    expect(r.map((x) => x.ok)).toEqual([true]);
  });

  it('es aditiva: no elimina ni altera tablas, columnas ni tipos existentes', () => {
    const sql = readFileSync(join(RAIZ, 'prisma', 'migrations', dir[0]!, 'migration.sql'), 'utf-8').replace(/--.*$/gm, '');
    expect(sql).not.toMatch(/\bDROP\s+(TABLE|COLUMN|TYPE|INDEX|CONSTRAINT)\b/i);
    expect(sql).not.toMatch(/\bALTER\s+TYPE\b/i);
    expect(sql).not.toMatch(/\bTRUNCATE\b|\bDELETE\s+FROM\b|\bUPDATE\s+"?\w+"?\s+SET\b/i);
    const alteradas = [...sql.matchAll(/ALTER\s+TABLE\s+"?(\w+)"?/gi)].map((m) => m[1]);
    for (const t of alteradas) expect(TABLAS as readonly string[], `ALTER TABLE ${t}`).toContain(t);
  });

  it('schema.prisma y la base aislada no tienen diferencias (prisma migrate diff vacío)', () => {
    const aislada = exigirBaseAislada(url);
    const salida = execFileSync('npx', ['prisma', 'migrate', 'diff', '--from-config-datasource', '--to-schema', 'prisma/schema.prisma', '--exit-code'], {
      cwd: RAIZ, encoding: 'utf-8', shell: true, env: { ...process.env, DATABASE_URL: aislada, DIRECT_URL: aislada },
    });
    expect(salida).toMatch(/No difference detected|empty/i);
  });
});
