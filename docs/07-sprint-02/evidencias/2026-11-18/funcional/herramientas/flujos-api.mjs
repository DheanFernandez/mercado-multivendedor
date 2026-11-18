// Flujos de la API REAL (NestJS + PostgreSQL aislado) y del frontend real. Solo lectura. Uso: node flujos-api.mjs <salida.json>
import { writeFileSync } from 'node:fs';
const API = 'http://localhost:3000';
const WEB = 'http://localhost:3001';
const filas = [];
const reg = (flujo, metodo, ruta, estado, esperado, observado, extra = {}) =>
  filas.push({ flujo, metodo, ruta, estado, esperado, ok: Array.isArray(esperado) ? esperado.includes(estado) : estado === esperado, observado, ...extra });
const pedir = async (ruta, opciones = {}, base = API) => {
  const r = await fetch(base + ruta, { redirect: 'manual', ...opciones });
  const tipo = r.headers.get('content-type') ?? '';
  const cuerpo = tipo.includes('json') ? await r.json() : await r.text();
  return { estado: r.status, tipo, cuerpo, cabeceras: r.headers };
};

// 1–3 catálogo, categorías, puestos
let r = await pedir('/api/v1/categorias');
reg('Categorías', 'GET', '/api/v1/categorias', r.estado, 200, `${r.cuerpo.length} categorías: ${r.cuerpo.map((c) => c.nombre).join(', ')}`);
const categorias = r.cuerpo;
r = await pedir('/api/v1/puestos/publicos');
reg('Puestos públicos', 'GET', '/api/v1/puestos/publicos', r.estado, 200, `${r.cuerpo.length} puestos: ${r.cuerpo.map((p) => p.codigo).join(', ')}`);
r = await pedir('/api/v1/catalogo/productos?limite=50');
reg('Catálogo', 'GET', '/api/v1/catalogo/productos?limite=50', r.estado, 200, `total=${r.cuerpo.total}; página ${r.cuerpo.pagina}/${r.cuerpo.totalPaginas}; ${r.cuerpo.datos.length} productos; con imagen: ${r.cuerpo.datos.filter((p) => p.imagenes.length).length}`);
const productos = r.cuerpo.datos;
r = await pedir('/api/v1/catalogo/productos?limite=5&pagina=2');
reg('Catálogo · paginación', 'GET', '/api/v1/catalogo/productos?limite=5&pagina=2', r.estado, 200, `pagina=${r.cuerpo.pagina}, ${r.cuerpo.datos.length} productos, totalPaginas=${r.cuerpo.totalPaginas}`);
r = await pedir('/api/v1/catalogo/productos?q=papa');
reg('Catálogo · búsqueda', 'GET', '/api/v1/catalogo/productos?q=papa', r.estado, 200, `${r.cuerpo.total} resultado(s): ${r.cuerpo.datos.map((p) => p.nombre).join(', ')}`);
const frutas = categorias.find((c) => c.nombre.toLowerCase().startsWith('fruta'));
r = await pedir(`/api/v1/catalogo/productos?categoriaId=${frutas.id}`);
reg('Catálogo · categoría', 'GET', '/api/v1/catalogo/productos?categoriaId=<Frutas>', r.estado, 200, `${r.cuerpo.total} productos de «${frutas.nombre}»: ${r.cuerpo.datos.map((p) => p.nombre).join(', ')}`);
r = await pedir('/api/v1/catalogo/productos?orden=precio_asc&limite=50');
const precios = r.cuerpo.datos.map((p) => Number(p.precio));
reg('Catálogo · orden', 'GET', '/api/v1/catalogo/productos?orden=precio_asc', r.estado, 200, `precios ascendentes: ${precios.every((x, i) => i === 0 || x >= precios[i - 1])} (de ${precios[0]} a ${precios.at(-1)})`);
r = await pedir('/api/v1/catalogo/productos?precioMin=5&precioMax=10&limite=50');
reg('Catálogo · rango de precio', 'GET', '/api/v1/catalogo/productos?precioMin=5&precioMax=10', r.estado, 200, `${r.cuerpo.total} productos entre 5.00 y 10.00; todos en rango: ${r.cuerpo.datos.every((p) => Number(p.precio) >= 5 && Number(p.precio) <= 10)}`);
const unPuesto = (await pedir('/api/v1/puestos/publicos')).cuerpo[0];
r = await pedir(`/api/v1/catalogo/productos?puestoId=${unPuesto.id}&limite=50`);
reg('Catálogo · puesto', 'GET', '/api/v1/catalogo/productos?puestoId=<DEMO-A1>', r.estado, 200, `${r.cuerpo.total} productos del puesto ${unPuesto.codigo}`);
r = await pedir('/api/v1/catalogo/productos?orden=aleatorio');
reg('Catálogo · validación', 'GET', '/api/v1/catalogo/productos?orden=aleatorio', r.estado, 400, `${r.cuerpo.codigo}: ${r.cuerpo.mensaje}`);

// 4 detalle
const uno = productos[0];
r = await pedir(`/api/v1/catalogo/productos/${uno.id}`);
reg('Detalle de producto', 'GET', '/api/v1/catalogo/productos/:id', r.estado, 200, `${r.cuerpo.nombre} · S/ ${r.cuerpo.precio} / ${r.cuerpo.unidadVenta} · puesto ${r.cuerpo.puesto.codigo} · categoría ${r.cuerpo.categoria.nombre}`);
r = await pedir('/api/v1/catalogo/productos/00000000-0000-4000-8000-0000000000ff');
reg('Detalle inexistente', 'GET', '/api/v1/catalogo/productos/<uuid inexistente>', r.estado, 404, `${r.cuerpo.codigo}: ${r.cuerpo.mensaje}`);

// 5 disponibilidad: las rutas de inventario son del comerciante (requieren sesión)
r = await pedir('/api/v1/inventario');
reg('Inventario sin sesión', 'GET', '/api/v1/inventario', r.estado, 401, `${r.cuerpo.codigo}: ${r.cuerpo.mensaje}`);
r = await pedir('/api/v1/carrito');
reg('Carrito sin sesión', 'GET', '/api/v1/carrito', r.estado, 401, `${r.cuerpo.codigo}: ${r.cuerpo.mensaje}`);
r = await pedir('/api/v1/carrito', { headers: { Authorization: 'Bearer token-de-prueba-no-valido' } });
reg('Carrito con token no verificable', 'GET', '/api/v1/carrito', r.estado, [401, 503], `${r.cuerpo.codigo}: ${r.cuerpo.mensaje}`, { nota: 'La API de demostración no tiene Supabase Auth configurado: no puede verificar tokens' });

// 6 Swagger / OpenAPI
r = await pedir('/api/docs');
reg('Swagger UI', 'GET', '/api/docs', r.estado, 200, `${r.tipo}; contiene «Swagger UI»: ${/swagger/i.test(r.cuerpo)}`);
r = await pedir('/api/docs-json');
const ops = Object.values(r.cuerpo.paths).flatMap((p) => Object.keys(p));
const publicas = Object.values(r.cuerpo.paths).flatMap((p) => Object.values(p)).filter((o) => o.security?.length === 0).length;
reg('Documento OpenAPI', 'GET', '/api/docs-json', r.estado, 200, `OpenAPI ${r.cuerpo.openapi}; ${Object.keys(r.cuerpo.paths).length} rutas, ${ops.length} operaciones (${publicas} públicas, ${ops.length - publicas} con Bearer); ${Object.keys(r.cuerpo.components.schemas).length} esquemas`);

// 7 frontend (HTML servido por Next.js)
for (const ruta of ['/', '/catalogo', `/catalogo/${uno.id}`, '/ofertas', '/carrito', '/login', '/registro']) {
  r = await pedir(ruta, {}, WEB);
  reg('Frontend', 'GET', ruta, r.estado, [200, 307, 308], `${r.tipo.split(';')[0]}${r.cabeceras.get('location') ? ` → ${r.cabeceras.get('location')}` : ''}; ${String(r.cuerpo).length} bytes`);
}
writeFileSync(process.argv[2], JSON.stringify(filas, null, 2));
for (const f of filas) console.log(`${f.ok ? 'OK ' : 'FALLO'} ${String(f.estado).padEnd(3)} ${f.metodo} ${f.ruta}\n      ${f.observado}`);
console.log(`\n${filas.filter((f) => f.ok).length} de ${filas.length} comprobaciones correctas`);
