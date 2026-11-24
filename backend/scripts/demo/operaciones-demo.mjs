/**
 * Operaciones del entorno de demostración (spec 004, E2) sobre un cliente `pg` YA conectado a `mercado_dev`.
 * Quien llama (ops/demo/demo-db.mjs) valida la URL con `exigirBaseDesarrollo` antes de conectarse.
 *
 * - `inspeccionar`: solo lectura (base, usuario, puerto, versión, tablas, migraciones y recuentos).
 * - `sembrar`: idempotente, en una transacción; nunca toca filas ajenas a la demostración (CA-DEMO-03, 04, 09).
 * - `limpiar`: borra solo las filas de demostración, en una transacción; aborta si un pedido las referencia (CA-DEMO-11).
 * - `vincular`: enlaza una cuenta EXISTENTE de Supabase (por su authId) como cliente, sin contraseña (CA-DEMO-05).
 * - `sembrarFotos`: asocia las fotografías locales existentes y válidas; solo escribe `producto_imagenes` (CA-IMG-07).
 */
import { CATEGORIAS, CLIENTE_PRUEBA, IDS, MOTIVO_INGRESO, PRODUCTOS, PUESTOS } from './datos-demo.mjs';
import { evaluarFoto } from './fotos-demo.mjs';

const TABLAS_REQUERIDAS = ['usuarios', 'comerciantes', 'puestos', 'categorias', 'productos', 'producto_imagenes', 'inventarios', 'movimientos_inventario', 'carritos', 'carrito_items'];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function existeTabla(db, nombre) {
  const { rows } = await db.query(`select to_regclass($1) is not null as existe`, [`public.${nombre}`]);
  return rows[0].existe;
}

/** Solo lectura: identifica la conexión y describe el contenido de la base. */
export async function inspeccionar(db) {
  const { rows } = await db.query(
    `select current_database() as base, current_user as usuario, inet_server_port() as puerto_interno,
            split_part(version(), ' ', 2) as version, (select count(*)::int from pg_tables where schemaname = 'public') as tablas`,
  );
  const info = { ...rows[0], migraciones: null, recuentos: null };
  if (await existeTabla(db, '_prisma_migrations')) {
    const m = await db.query(`select migration_name from _prisma_migrations where finished_at is not null and rolled_back_at is null order by migration_name`);
    info.migraciones = m.rows.map((r) => r.migration_name);
  }
  if (await existeTabla(db, 'productos')) info.recuentos = await recuentos(db);
  return info;
}

/** Recuentos totales y de demostración (los de demostración se identifican por sus claves fijas). */
export async function recuentos(db) {
  const q = async (sql, params = []) => (await db.query(sql, params)).rows[0].n;
  const total = (t) => q(`select count(*)::int as n from ${t}`);
  return {
    categorias: { total: await total('categorias'), demo: await q(`select count(*)::int as n from categorias where id = any($1::uuid[])`, [IDS.categorias]) },
    usuarios: { total: await total('usuarios'), demo: await q(`select count(*)::int as n from usuarios where id = any($1::uuid[])`, [IDS.usuarios]) },
    comerciantes: { total: await total('comerciantes'), demo: await q(`select count(*)::int as n from comerciantes where id = any($1::uuid[])`, [IDS.comerciantes]) },
    puestos: { total: await total('puestos'), demo: await q(`select count(*)::int as n from puestos where id = any($1::uuid[])`, [IDS.puestos]) },
    productos: {
      total: await total('productos'),
      demo: await q(`select count(*)::int as n from productos where id = any($1::uuid[])`, [IDS.productos]),
      demoPublicados: await q(`select count(*)::int as n from productos where id = any($1::uuid[]) and estado = 'PUBLICADO'`, [IDS.productos]),
    },
    inventarios: { total: await total('inventarios'), demo: await q(`select count(*)::int as n from inventarios where producto_id = any($1::uuid[])`, [IDS.productos]) },
    movimientos: {
      total: await total('movimientos_inventario'),
      demo: await q(`select count(*)::int as n from movimientos_inventario m join inventarios i on i.id = m.inventario_id where i.producto_id = any($1::uuid[])`, [IDS.productos]),
    },
    imagenes: { total: await total('producto_imagenes') },
  };
}

async function exigirEsquema(db) {
  for (const t of ['_prisma_migrations', ...TABLAS_REQUERIDAS]) {
    if (!(await existeTabla(db, t))) throw new Error(`Falta la tabla «${t}»: ejecute primero «npm run db:dev:migrate».`);
  }
}

/** Registros ajenos a la demostración que ocupan una clave única de la demostración. */
async function conflictos(db) {
  const c = [];
  const ver = async (descripcion, sql, params) => {
    const { rows } = await db.query(sql, params);
    for (const r of rows) c.push(`${descripcion}: ${r.valor}`);
  };
  await ver('slug de categoría', `select slug as valor from categorias where slug = any($1) and id <> all($2::uuid[])`, [CATEGORIAS.map((x) => x.slug), IDS.categorias]);
  await ver('correo de usuario', `select email as valor from usuarios where email = any($1) and id <> all($2::uuid[])`, [[...PUESTOS.map((p) => p.usuario.email), CLIENTE_PRUEBA.email], IDS.usuarios]);
  await ver('authId del cliente de prueba', `select "authId" as valor from usuarios where "authId" = $1 and id <> $2::uuid`, [CLIENTE_PRUEBA.authId, CLIENTE_PRUEBA.id]);
  await ver('código de puesto', `select codigo as valor from puestos where codigo = any($1) and id <> all($2::uuid[])`, [PUESTOS.map((p) => p.codigo), IDS.puestos]);
  await ver('comerciante de un usuario de demostración', `select "usuarioId"::text as valor from comerciantes where "usuarioId" = any($1::uuid[]) and id <> all($2::uuid[])`, [IDS.usuarios, IDS.comerciantes]);
  return c;
}

/** Inserta o restablece una fila por su id. Devuelve «insertado», «actualizado» o «sin cambios». */
async function upsert(db, tabla, columnas, valores, tipos = {}) {
  const cols = columnas.map((c) => `"${c}"`);
  const params = columnas.map((c, i) => `$${i + 1}${tipos[c] ? `::"${tipos[c]}"` : ''}`);
  const asignables = columnas.filter((c) => c !== 'id');
  const sql = `insert into ${tabla} (${cols.join(', ')}, "creadoEn", "actualizadoEn") values (${params.join(', ')}, now(), now())
    on conflict (id) do update set ${asignables.map((c) => `"${c}" = excluded."${c}"`).join(', ')}, "actualizadoEn" = now()
    where (${asignables.map((c) => `${tabla}."${c}"`).join(', ')}) is distinct from (${asignables.map((c) => `excluded."${c}"`).join(', ')})
    returning (xmax = 0) as insertado`;
  const { rows } = await db.query(sql, valores);
  return rows.length === 0 ? 'sin cambios' : rows[0].insertado ? 'insertado' : 'actualizado';
}

const resumen = () => ({ insertados: 0, actualizados: 0, sinCambios: 0 });
const anotar = (r, estado) => (estado === 'insertado' ? r.insertados++ : estado === 'actualizado' ? r.actualizados++ : r.sinCambios++);

/** Seed idempotente (spec §8.5). No crea imágenes ni cuentas; el inventario existente no se modifica. */
export async function sembrar(db) {
  await exigirEsquema(db);
  await db.query('begin');
  try {
    const choques = await conflictos(db);
    if (choques.length > 0) throw new Error(`ABORTADO sin cambios: registros ajenos a la demostración ocupan claves únicas (${choques.join('; ')}).`);

    const r = { categorias: resumen(), usuarios: resumen(), comerciantes: resumen(), puestos: resumen(), productos: resumen(), inventarios: { creados: 0, existentes: 0 }, movimientos: { creados: 0 } };
    for (const c of CATEGORIAS) anotar(r.categorias, await upsert(db, 'categorias', ['id', 'nombre', 'slug', 'descripcion', 'activa'], [c.id, c.nombre, c.slug, c.descripcion, true]));

    const tiposUsuario = { rol: 'RolUsuario', estado: 'EstadoUsuario' };
    for (const p of PUESTOS) {
      const u = p.usuario;
      anotar(r.usuarios, await upsert(db, 'usuarios', ['id', 'email', 'nombres', 'apellidos', 'rol', 'estado', 'authId'], [u.id, u.email, u.nombres, u.apellidos, 'COMERCIANTE', 'ACTIVO', null], tiposUsuario));
    }
    const k = CLIENTE_PRUEBA;
    anotar(r.usuarios, await upsert(db, 'usuarios', ['id', 'email', 'nombres', 'apellidos', 'rol', 'estado', 'authId'], [k.id, k.email, k.nombres, k.apellidos, 'CLIENTE', 'ACTIVO', k.authId], tiposUsuario));

    for (const p of PUESTOS) {
      anotar(r.comerciantes, await upsert(db, 'comerciantes', ['id', 'usuarioId', 'nombreComercial', 'estado'], [p.comerciante.id, p.usuario.id, p.comerciante.nombreComercial, 'ACTIVO'], { estado: 'EstadoComerciante' }));
      anotar(r.puestos, await upsert(db, 'puestos', ['id', 'comercianteId', 'codigo', 'nombre', 'estado'], [p.id, p.comerciante.id, p.codigo, p.nombre, 'ACTIVO'], { estado: 'EstadoPuesto' }));
    }

    for (const p of PRODUCTOS) {
      anotar(
        r.productos,
        await upsert(
          db,
          'productos',
          ['id', 'puestoId', 'categoriaId', 'nombre', 'descripcion', 'precio', 'unidadVenta', 'presentacion', 'estado'],
          [p.id, p.puestoId, p.categoriaId, p.nombre, p.descripcion, p.precio, p.unidadVenta, p.presentacion, 'PUBLICADO'],
          { unidadVenta: 'UnidadVenta', estado: 'EstadoPublicacion' },
        ),
      );
      // Inventario solo si el producto aún no tiene: nunca se reescribe un stock en uso (reservas, carritos, pedidos).
      const inv = await db.query(
        `insert into inventarios (id, producto_id, puesto_id, stock_fisico, stock_reservado) values ($1, $2, $3, $4, 0) on conflict do nothing returning id`,
        [p.inventarioId, p.id, p.puestoId, p.stock],
      );
      if (inv.rows.length === 0) {
        r.inventarios.existentes++;
        continue;
      }
      r.inventarios.creados++;
      const mov = await db.query(
        `insert into movimientos_inventario (id, inventario_id, tipo, variacion_fisica, variacion_reservada, stock_fisico_despues, stock_reservado_despues, motivo, actor_id)
         values ($1, $2, 'INGRESO', $3, 0, $3, 0, $4, $5) on conflict (id) do nothing returning id`,
        [p.movimientoId, p.inventarioId, p.stock, MOTIVO_INGRESO, p.actorId],
      );
      r.movimientos.creados += mov.rows.length;
    }
    await db.query('commit');
    return r;
  } catch (e) {
    await db.query('rollback');
    throw e;
  }
}

/** Borra SOLO los datos de demostración (spec §8.8). Aborta, sin cambios, si algo ajeno depende de ellos. */
export async function limpiar(db) {
  await exigirEsquema(db);
  await db.query('begin');
  try {
    const bloqueos = [];
    const contar = async (descripcion, sql, params) => {
      const { rows } = await db.query(sql, params);
      if (rows[0].n > 0) bloqueos.push(`${rows[0].n} ${descripcion}`);
    };
    if (await existeTabla(db, 'lineas_pedido')) {
      await contar('línea(s) de pedido con productos de demostración', `select count(*)::int as n from lineas_pedido where producto_id = any($1::uuid[])`, [IDS.productos]);
      await contar('subpedido(s) de puestos de demostración', `select count(*)::int as n from subpedidos where puesto_id = any($1::uuid[])`, [IDS.puestos]);
      await contar('pedido(s) del cliente de prueba', `select count(*)::int as n from pedidos where cliente_id = any($1::uuid[])`, [IDS.usuarios]);
    }
    await contar('producto(s) ajenos en puestos de demostración', `select count(*)::int as n from productos where "puestoId" = any($1::uuid[]) and id <> all($2::uuid[])`, [IDS.puestos, IDS.productos]);
    await contar('producto(s) ajenos en categorías de demostración', `select count(*)::int as n from productos where "categoriaId" = any($1::uuid[]) and id <> all($2::uuid[])`, [IDS.categorias, IDS.productos]);
    await contar('puesto(s) ajenos de comerciantes de demostración', `select count(*)::int as n from puestos where "comercianteId" = any($1::uuid[]) and id <> all($2::uuid[])`, [IDS.comerciantes, IDS.puestos]);
    if (bloqueos.length > 0) throw new Error(`ABORTADO sin cambios: ${bloqueos.join('; ')}. Use «npm run db:dev:down» para reiniciar toda la base de demostración.`);

    const borrar = async (sql, params) => (await db.query(sql, params)).rowCount ?? 0;
    const inventarios = `select id from inventarios where producto_id = any($1::uuid[])`;
    const borrados = {
      carritoItems: await borrar(`delete from carrito_items where producto_id = any($1::uuid[]) or carrito_id in (select id from carritos where usuario_id = any($2::uuid[]))`, [IDS.productos, IDS.usuarios]),
      carritos: await borrar(`delete from carritos where usuario_id = any($1::uuid[])`, [IDS.usuarios]),
      reservas: await borrar(`delete from reservas_inventario where inventario_id in (${inventarios})`, [IDS.productos]),
      movimientos: await borrar(`delete from movimientos_inventario where inventario_id in (${inventarios})`, [IDS.productos]),
      inventarios: await borrar(`delete from inventarios where producto_id = any($1::uuid[])`, [IDS.productos]),
      imagenes: await borrar(`delete from producto_imagenes where "productoId" = any($1::uuid[])`, [IDS.productos]),
      productos: await borrar(`delete from productos where id = any($1::uuid[])`, [IDS.productos]),
      puestos: await borrar(`delete from puestos where id = any($1::uuid[])`, [IDS.puestos]),
      comerciantes: await borrar(`delete from comerciantes where id = any($1::uuid[])`, [IDS.comerciantes]),
      usuarios: await borrar(`delete from usuarios where id = any($1::uuid[])`, [IDS.usuarios]),
      categorias: await borrar(`delete from categorias where id = any($1::uuid[])`, [IDS.categorias]),
    };
    await db.query('commit');
    return borrados;
  } catch (e) {
    await db.query('rollback');
    throw e;
  }
}

/**
 * Vincula una cuenta EXISTENTE de Supabase Auth (identificada por su `authId`, el `sub` de su sesión) como CLIENTE en
 * `mercado_dev`, para usar el carrito desde la interfaz. No crea cuentas ni guarda contraseñas. No cambia el rol de un
 * usuario ya existente.
 */
export async function vincular(db, { authId, email, nombres = 'Cliente', apellidos = 'Demostración' }) {
  await exigirEsquema(db);
  if (typeof authId !== 'string' || !UUID.test(authId)) throw new Error('--auth-id debe ser el UUID de la cuenta de Supabase (el «sub» de su sesión).');
  const correo = String(email ?? '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) throw new Error('--email no es un correo válido.');
  const previo = await db.query(`select id, email, rol::text as rol, "authId" from usuarios where "authId" = $1 or email = $2`, [authId, correo]);
  const mismo = previo.rows.find((u) => u.authId === authId);
  if (mismo) return { estado: 'ya vinculado', id: mismo.id, email: mismo.email, rol: mismo.rol };
  if (previo.rows.length > 0) throw new Error(`ABORTADO: el correo ${correo} ya pertenece a otro usuario de mercado_dev con otra identidad.`);
  const { rows } = await db.query(
    `insert into usuarios (id, email, nombres, apellidos, rol, estado, "authId", "creadoEn", "actualizadoEn")
     values (gen_random_uuid(), $1, $2, $3, 'CLIENTE', 'ACTIVO', $4, now(), now()) returning id`,
    [correo, nombres, apellidos, authId],
  );
  return { estado: 'vinculado', id: rows[0].id, email: correo, rol: 'CLIENTE' };
}

/** Huella (md5 de todas las filas) de las tablas que el seed de fotografías NO debe tocar. */
export async function huella(db) {
  const tablas = ['categorias', 'usuarios', 'comerciantes', 'puestos', 'productos', 'inventarios', 'movimientos_inventario', 'reservas_inventario', 'carritos', 'carrito_items'];
  const r = {};
  for (const t of tablas) {
    const { rows } = await db.query(`select md5(coalesce(string_agg(t::text, '|' order by t.id), '')) as h, count(*)::int as n from ${t} t`);
    r[t] = `${rows[0].n}:${rows[0].h}`;
  }
  return r;
}

/**
 * Asocia las fotografías locales de demostración (spec §9.2; CA-IMG-07). Por cada producto de demostración: si su archivo
 * existe en `carpeta`, es WebP válido y pesa ≤ 2 MB, crea o restablece UNA fila de `producto_imagenes` (id fijo, orden 0);
 * si no, elimina esa fila (vuelve a «Sin imagen»). No toca imágenes ajenas ni ninguna otra tabla (lo comprueba la huella).
 */
export async function sembrarFotos(db, carpeta) {
  await exigirEsquema(db);
  const { rows } = await db.query(`select count(*)::int as n from productos where id = any($1::uuid[])`, [IDS.productos]);
  if (rows[0].n !== PRODUCTOS.length) throw new Error('Faltan productos de demostración: ejecute primero «npm run db:dev:seed».');
  const r = { insertadas: 0, actualizadas: 0, sinCambios: 0, retiradas: 0, asociadas: [], pendientes: [], ocupadas: [] };
  // REPEATABLE READ: las dos huellas ven la misma instantánea, así que solo reflejan los cambios de ESTA transacción
  // (no los de alguien que use la demostración a la vez).
  await db.query('begin isolation level repeatable read');
  try {
    const antes = await huella(db);
    for (const p of PRODUCTOS) {
      const foto = evaluarFoto(carpeta, p.archivoFoto);
      if (foto.estado !== 'valida') {
        r.retiradas += (await db.query(`delete from producto_imagenes where id = $1`, [p.imagenId])).rowCount ?? 0;
        r.pendientes.push({ archivo: p.archivoFoto, motivo: foto.detalle ? `${foto.estado}: ${foto.detalle}` : foto.estado });
        continue;
      }
      const ajena = await db.query(`select 1 from producto_imagenes where "productoId" = $1 and orden = 0 and id <> $2`, [p.id, p.imagenId]);
      if (ajena.rows.length > 0) {
        r.ocupadas.push(p.archivoFoto); // ya tiene otra imagen principal (p. ej. subida desde el panel): no se toca
        continue;
      }
      const res = await db.query(
        `insert into producto_imagenes (id, "productoId", ruta, "textoAlternativo", orden) values ($1, $2, $3, $4, 0)
         on conflict (id) do update set "productoId" = excluded."productoId", ruta = excluded.ruta, "textoAlternativo" = excluded."textoAlternativo", orden = 0
         where (producto_imagenes."productoId", producto_imagenes.ruta, producto_imagenes."textoAlternativo", producto_imagenes.orden)
           is distinct from (excluded."productoId", excluded.ruta, excluded."textoAlternativo", 0)
         returning (xmax = 0) as insertado`,
        [p.imagenId, p.id, p.rutaFoto, p.nombre],
      );
      if (res.rows.length === 0) r.sinCambios++;
      else if (res.rows[0].insertado) r.insertadas++;
      else r.actualizadas++;
      r.asociadas.push(`${p.archivoFoto} (${foto.bytes} bytes)`);
    }
    r.otrasTablasSinCambios = JSON.stringify(antes) === JSON.stringify(await huella(db));
    if (!r.otrasTablasSinCambios) throw new Error('ABORTADO sin cambios: el seed de fotografías habría modificado otras tablas.');
    await db.query('commit');
  } catch (e) {
    await db.query('rollback');
    throw e;
  }
  return r;
}

/** Imágenes de demostración asociadas hoy: productoId → ruta (para la verificación de la API). */
export async function fotosAsociadas(db) {
  const { rows } = await db.query(`select "productoId" as producto, ruta from producto_imagenes where "productoId" = any($1::uuid[]) order by orden`, [IDS.productos]);
  return new Map(rows.map((x) => [x.producto, x.ruta]));
}
