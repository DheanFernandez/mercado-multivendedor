// Carrito contra la API REAL (dist/main) y PostgreSQL aislado, con un token firmado LOCALMENTE (NO es Supabase Auth).
// Emisor y secreto son locales y solo existen durante esta ejecución. No se crean cuentas ni se contacta ningún servicio.
// Uso: node carrito-real.mjs <backend> <salida.json>
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { randomBytes } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

const backend = process.argv[2];
const requerir = createRequire(join(backend, 'package.json'));
const { SignJWT } = requerir('jose');
const pg = requerir('pg');
const PUERTO = 3101;
const BASE = `http://127.0.0.1:${PUERTO}`;
const URL_BD = 'postgresql://postgres:dev@127.0.0.1:55434/mercado_dev';
const emisor = 'http://127.0.0.1:54399';
const secreto = randomBytes(32).toString('base64url');
const AUTH_ID = 'd3e000c1-0000-4000-8000-000000000001'; // cliente de prueba de la demostración (sin cuenta de Supabase)
const token = await new SignJWT({ role: 'authenticated' }).setProtectedHeader({ alg: 'HS256' }).setSubject(AUTH_ID).setIssuer(`${emisor}/auth/v1`).setAudience('authenticated').setIssuedAt().setExpirationTime('10m').sign(new TextEncoder().encode(secreto));

const hijo = spawn(process.execPath, ['dist/main'], {
  cwd: backend,
  env: { ...process.env, DATABASE_URL: URL_BD, DIRECT_URL: URL_BD, PORT: String(PUERTO), SUPABASE_URL: emisor, SUPABASE_JWT_SECRET: secreto, SUPABASE_SERVICE_ROLE_KEY: '', SUPABASE_ANON_KEY: '', FRONTEND_URL: 'http://localhost:3001', ALMACEN_URL_PUBLICA: 'http://localhost:3001' },
  stdio: 'ignore',
});
const limite = Date.now() + 60_000;
for (;;) {
  try { if ((await fetch(`${BASE}/api/v1/categorias`)).status === 200) break; } catch {}
  if (Date.now() > limite) { hijo.kill(); throw new Error('La API no arrancó'); }
  await new Promise((r) => setTimeout(r, 500));
}

const filas = [];
const llamar = async (flujo, metodo, ruta, cuerpo, esperado, describir, conToken = true) => {
  const r = await fetch(BASE + ruta, { method: metodo, headers: { ...(conToken ? { Authorization: `Bearer ${token}` } : {}), ...(cuerpo ? { 'Content-Type': 'application/json' } : {}) }, body: cuerpo ? JSON.stringify(cuerpo) : undefined });
  const j = await r.json();
  filas.push({ flujo, metodo, ruta, estado: r.status, esperado, ok: r.status === esperado, observado: describir(j) });
  return j;
};
const cli = new pg.Client({ connectionString: URL_BD });
await cli.connect();
const disponible = async (id) => (await cli.query('select stock_fisico - stock_reservado as d from inventarios where producto_id=$1', [id])).rows[0]?.d;
const catalogo = await (await fetch(`${BASE}/api/v1/catalogo/productos?limite=50`)).json();
const por = (n) => catalogo.datos.find((p) => p.nombre === n);
const mango = por('Mango Kent'), papa = por('Papa amarilla'), palta = por('Palta fuerte');
const carro = (j) => `${j.puestos?.length ?? '-'} puesto(s), ${j.totalProductos} unidades, total S/ ${j.total}, requiereRevision=${j.requiereRevision}` + (j.puestos?.length ? ` · ${j.puestos.map((g) => `${g.puesto.codigo}: ${g.items.map((i) => `${i.nombre} x${i.cantidad}=${i.subtotal}`).join(' + ')} (sub ${g.subtotal})`).join(' | ')}` : '');
const err = (j) => `${j.codigo}: ${j.mensaje}`;

await llamar('Autenticación local', 'GET', '/api/v1/auth/me', null, 200, (j) => `rol=${j.rol}, estado=${j.estado} (usuario leído de PostgreSQL)`);
await llamar('Sin token', 'GET', '/api/v1/carrito', null, 401, err, false);
await llamar('Carrito vacío', 'GET', '/api/v1/carrito', null, 200, carro);
const antes = await disponible(mango.id);
await llamar('Agregar producto (puesto A)', 'POST', '/api/v1/carrito/items', { productoId: mango.id, cantidad: 3 }, 201, carro);
await llamar('Agregar producto de otro puesto', 'POST', '/api/v1/carrito/items', { productoId: papa.id, cantidad: 4 }, 201, carro);
await llamar('Sumar al mismo producto', 'POST', '/api/v1/carrito/items', { productoId: mango.id, cantidad: 2 }, 201, carro);
const despues = await disponible(mango.id);
filas.push({ flujo: 'El carrito NO reserva stock', metodo: 'SQL', ruta: 'inventarios (solo lectura)', estado: 0, esperado: 0, ok: antes === despues, observado: `disponible de Mango Kent antes=${antes}, después=${despues}` });
await llamar('Cambiar cantidad', 'PATCH', `/api/v1/carrito/items/${mango.id}`, { cantidad: 1 }, 200, carro);
await llamar('Cantidad sobre el máximo permitido (10 000)', 'PATCH', `/api/v1/carrito/items/${mango.id}`, { cantidad: 999999 }, 400, err);
await llamar('Cantidad sobre el stock disponible', 'PATCH', `/api/v1/carrito/items/${mango.id}`, { cantidad: 9000 }, 409, err);
await llamar('Cantidad inválida', 'POST', '/api/v1/carrito/items', { productoId: mango.id, cantidad: 0 }, 400, err);
await llamar('Producto inexistente', 'POST', '/api/v1/carrito/items', { productoId: '00000000-0000-4000-8000-0000000000ff', cantidad: 1 }, 404, err);
await llamar('Quitar producto', 'DELETE', `/api/v1/carrito/items/${papa.id}`, null, 200, carro);
await llamar('Quitar lo que no está', 'DELETE', `/api/v1/carrito/items/${papa.id}`, null, 404, err);
await llamar('Inventario: sin permiso de cliente', 'GET', '/api/v1/inventario', null, 403, err);
await llamar('Vaciar carrito', 'DELETE', '/api/v1/carrito', null, 200, carro);
const filasBd = (await cli.query('select count(*)::int n from carrito_items')).rows[0].n;
filas.push({ flujo: 'Estado final en PostgreSQL', metodo: 'SQL', ruta: 'carrito_items (solo lectura)', estado: 0, esperado: 0, ok: filasBd === 0, observado: `líneas de carrito restantes: ${filasBd}` });
await cli.end();
hijo.kill();
writeFileSync(process.argv[3], JSON.stringify(filas, null, 2));
for (const f of filas) console.log(`${f.ok ? 'OK ' : 'FALLO'} ${String(f.estado).padEnd(3)} ${f.metodo.padEnd(6)} ${f.flujo} — ${f.ruta}\n      ${f.observado}`);
console.log(`\n${filas.filter((f) => f.ok).length} de ${filas.length} comprobaciones correctas`);
