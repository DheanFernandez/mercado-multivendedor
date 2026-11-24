/**
 * Verificación REAL de la API de demostración (spec 004, E2; CA-DEMO-06, CA-DEMO-07). Llama por HTTP a una API ya
 * iniciada contra `mercado_dev` (la inicia ops/demo/demo-db.mjs con un emisor de tokens local).
 *
 * Seguridad: lo primero es comprobar que la API sirve EXACTAMENTE los productos de demostración (solo existen en
 * `mercado_dev`). Si no, aborta ANTES de cualquier petición que escriba (carrito).
 */
import { CATEGORIAS, CLIENTE_PRUEBA, PREFIJO_ID, PRODUCTOS, PUESTOS } from './datos-demo.mjs';
import { evaluarFoto } from './fotos-demo.mjs';

/**
 * @param fotos Map productoId → ruta de las imágenes de demostración asociadas en `mercado_dev` (spec §9; CA-IMG-06).
 * @param origenImagenes `ALMACEN_URL_PUBLICA` con la que se inició la API.
 */
export async function verificarApi(base, { firmarToken, origenImagenes, fotos = new Map(), carpetaFotos, registrar = console.log }) {
  const resultados = [];
  const comprobar = (id, ok, detalle) => {
    resultados.push({ id, ok, detalle });
    registrar(`${ok ? '  ✔' : '  ✘'} ${id}: ${detalle}`);
    return ok;
  };
  const llamar = async (metodo, ruta, { token, cuerpo } = {}) => {
    const res = await fetch(`${base}${ruta}`, {
      method: metodo,
      headers: { ...(token ? { authorization: `Bearer ${token}` } : {}), ...(cuerpo ? { 'content-type': 'application/json' } : {}) },
      body: cuerpo ? JSON.stringify(cuerpo) : undefined,
    });
    const texto = await res.text();
    let json;
    try {
      json = JSON.parse(texto);
    } catch {
      json = texto;
    }
    return { estado: res.status, json };
  };

  // 1. Identidad de la base: la API debe servir solo los 20 productos de demostración.
  const cat = await llamar('GET', '/api/v1/catalogo/productos?pagina=1&limite=24&orden=recientes');
  const lista = cat.json?.datos ?? [];
  const soloDemo = cat.estado === 200 && cat.json.total === PRODUCTOS.length && lista.length === PRODUCTOS.length && lista.every((p) => p.id.startsWith(PREFIJO_ID));
  comprobar('CA-DEMO-06 catálogo sin filtros', soloDemo, `HTTP ${cat.estado}, total=${cat.json?.total}, pagina=${cat.json?.pagina}, limite=${cat.json?.limite}, todos con id de demostración=${lista.every((p) => p.id?.startsWith(PREFIJO_ID))}`);
  if (!soloDemo) throw new Error('ABORTADO: la API no sirve los datos de mercado_dev; no se ejecuta ninguna petición que escriba.');
  registrar(`     primeros: ${lista.slice(0, 3).map((p) => `${p.nombre} S/ ${p.precio} / ${p.unidadVenta} · ${p.puesto.codigo}`).join(' | ')}`);

  // 2. Categorías y puestos públicos
  const cats = await llamar('GET', '/api/v1/categorias');
  const nombresCat = Array.isArray(cats.json) ? cats.json.map((c) => c.nombre) : [];
  comprobar('CA-DEMO-06 categorías', cats.estado === 200 && nombresCat.length === 8 && CATEGORIAS.every((c) => nombresCat.includes(c.nombre)), `HTTP ${cats.estado}, ${nombresCat.length}: ${nombresCat.join(', ')}`);
  const pues = await llamar('GET', '/api/v1/puestos/publicos');
  const codigos = Array.isArray(pues.json) ? pues.json.map((p) => `${p.codigo} ${p.nombre}`) : [];
  comprobar('CA-DEMO-06 puestos públicos', pues.estado === 200 && codigos.length === 4 && PUESTOS.every((p) => codigos.includes(`${p.codigo} ${p.nombre}`)), `HTTP ${pues.estado}, ${codigos.length}: ${codigos.join(', ')}`);

  // 3. Precio, unidad, puesto y categoría de los 20 productos, tal como en el seed
  const diferencias = PRODUCTOS.filter((d) => {
    const a = lista.find((p) => p.id === d.id);
    const puesto = PUESTOS.find((p) => p.id === d.puestoId);
    const categoria = CATEGORIAS.find((c) => c.id === d.categoriaId);
    return !a || a.precio !== d.precio || a.unidadVenta !== d.unidadVenta || a.puesto.codigo !== puesto.codigo || a.categoria.nombre !== categoria.nombre || a.nombre !== d.nombre;
  });
  comprobar('CA-DEMO-06 precio, unidad, puesto y categoría', diferencias.length === 0, diferencias.length === 0 ? '20 de 20 coinciden con el seed' : `difieren: ${diferencias.map((d) => d.nombre).join(', ')}`);

  // 4. Búsqueda, categoría, orden y detalle
  const papa = await llamar('GET', '/api/v1/catalogo/productos?pagina=1&limite=24&q=papa');
  comprobar('CA-DEMO-06 búsqueda «papa»', papa.estado === 200 && papa.json.total === 1 && papa.json.datos[0]?.nombre === 'Papa amarilla', `HTTP ${papa.estado}, total=${papa.json?.total}: ${(papa.json?.datos ?? []).map((p) => p.nombre).join(', ')}`);
  const frutas = CATEGORIAS.find((c) => c.nombre === 'Frutas');
  const porCat = await llamar('GET', `/api/v1/catalogo/productos?pagina=1&limite=24&categoriaId=${frutas.id}`);
  comprobar(
    'CA-DEMO-06 categoría Frutas',
    porCat.estado === 200 && porCat.json.total === 5 && porCat.json.datos.every((p) => p.categoria.id === frutas.id),
    `HTTP ${porCat.estado}, total=${porCat.json?.total}: ${(porCat.json?.datos ?? []).map((p) => p.nombre).join(', ')}`,
  );
  const barato = await llamar('GET', '/api/v1/catalogo/productos?pagina=1&limite=1&orden=precio_asc');
  const alfabetico = await llamar('GET', '/api/v1/catalogo/productos?pagina=1&limite=1&orden=nombre');
  comprobar('CA-DEMO-06 orden', barato.json?.datos?.[0]?.nombre === 'Culantro' && alfabetico.json?.datos?.[0]?.nombre === 'Aceite vegetal', `precio_asc → ${barato.json?.datos?.[0]?.nombre} (S/ ${barato.json?.datos?.[0]?.precio}); nombre → ${alfabetico.json?.datos?.[0]?.nombre}`);
  const palta = PRODUCTOS.find((p) => p.nombre === 'Palta fuerte');
  const det = await llamar('GET', `/api/v1/catalogo/productos/${palta.id}`);
  comprobar(
    'CA-DEMO-06 detalle',
    det.estado === 200 && det.json.nombre === 'Palta fuerte' && det.json.imagenes.length === (fotos.has(palta.id) ? 1 : 0),
    `HTTP ${det.estado}, ${det.json?.nombre} S/ ${det.json?.precio} / ${det.json?.unidadVenta} · Puesto ${det.json?.puesto?.codigo} · imágenes=${det.json?.imagenes?.length}`,
  );

  // 4b. Imágenes (spec §9; CA-IMG-06, CA-IMG-07): URL local para las asociadas, `imagenes: []` para las demás
  const origen = String(origenImagenes ?? '').replace(/\/+$/, '');
  const imagenesMal = PRODUCTOS.filter((d) => {
    const imgs = lista.find((p) => p.id === d.id)?.imagenes ?? [];
    const ruta = fotos.get(d.id);
    if (!ruta) return imgs.length !== 0;
    const url = imgs[0]?.url ?? '';
    return imgs.length !== 1 || url !== `${origen}/${ruta}` || url.includes('/storage/v1/object/public/') || imgs[0].textoAlternativo !== d.nombre;
  });
  const ejemplo = lista.find((p) => p.imagenes.length > 0)?.imagenes[0]?.url;
  comprobar(
    'CA-IMG-06 URL de las imágenes',
    imagenesMal.length === 0,
    imagenesMal.length === 0
      ? `${fotos.size} con fotografía (${ejemplo ?? 'ninguna'}), ${PRODUCTOS.length - fotos.size} con «imagenes: []»; ninguna URL contiene /storage/v1/object/public/`
      : `no coinciden: ${imagenesMal.map((d) => d.nombre).join(', ')}`,
  );
  if (carpetaFotos) {
    const desfase = PRODUCTOS.filter((d) => (evaluarFoto(carpetaFotos, d.archivoFoto).estado === 'valida') !== fotos.has(d.id));
    comprobar(
      'CA-IMG-07 archivos válidos = imágenes asociadas',
      desfase.length === 0,
      desfase.length === 0 ? `${fotos.size} de ${PRODUCTOS.length}` : `ejecute «npm run db:dev:fotos»: difieren ${desfase.map((d) => d.archivoFoto).join(', ')}`,
    );
  }

  // 5. Carrito con el cliente de prueba (token firmado localmente; ninguna cuenta de Supabase)
  const sinSesion = await llamar('GET', '/api/v1/carrito');
  comprobar('CA-DEMO-07 carrito sin sesión', sinSesion.estado === 401, `HTTP ${sinSesion.estado}`);
  const falso = await llamar('GET', '/api/v1/auth/me', { token: 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ4In0.firma-falsa' });
  comprobar('CA-IMG-05 la autenticación sigue rechazando tokens no válidos', falso.estado === 401, `HTTP ${falso.estado}`);
  const token = await firmarToken(CLIENTE_PRUEBA.authId);
  const yo = await llamar('GET', '/api/v1/auth/me', { token });
  comprobar('CA-DEMO-07 perfil del cliente de prueba', yo.estado === 200 && yo.json.rol === 'CLIENTE' && yo.json.email === CLIENTE_PRUEBA.email, `HTTP ${yo.estado}, ${yo.json?.email}, rol=${yo.json?.rol}`);
  await llamar('DELETE', '/api/v1/carrito', { token }); // estado inicial conocido
  const vacio = await llamar('GET', '/api/v1/carrito', { token });
  comprobar('CA-DEMO-07 consultar carrito vacío', vacio.estado === 200 && vacio.json.totalProductos === 0 && vacio.json.puestos.length === 0, `HTTP ${vacio.estado}, totalProductos=${vacio.json?.totalProductos}, total=${vacio.json?.total}`);
  const papaAmarilla = PRODUCTOS.find((p) => p.nombre === 'Papa amarilla');
  const a1 = await llamar('POST', '/api/v1/carrito/items', { token, cuerpo: { productoId: palta.id, cantidad: 2 } });
  const a2 = await llamar('POST', '/api/v1/carrito/items', { token, cuerpo: { productoId: papaAmarilla.id, cantidad: 3 } });
  const lleno = await llamar('GET', '/api/v1/carrito', { token });
  const grupos = lleno.json?.puestos ?? [];
  const sub = (codigo) => grupos.find((g) => g.puesto.codigo === codigo)?.subtotal;
  comprobar(
    'CA-DEMO-07 agregar productos de 2 puestos',
    [a1.estado, a2.estado].every((s) => s === 200 || s === 201) && grupos.length === 2 && sub('DEMO-A1') === '17.00' && sub('DEMO-B2') === '11.40' && lleno.json.total === '28.40' && lleno.json.totalProductos === 5,
    `POST HTTP ${a1.estado}/${a2.estado}; ${grupos.map((g) => `${g.puesto.codigo}: ${g.items.map((i) => `${i.nombre} ×${i.cantidad} = S/ ${i.subtotal} (${i.estado}, disponible ${i.disponible})`).join(', ')} → subtotal S/ ${g.subtotal}`).join(' | ')} · total S/ ${lleno.json?.total}, ${lleno.json?.totalProductos} unidades`,
  );
  const vaciado = await llamar('DELETE', '/api/v1/carrito', { token });
  comprobar('CA-DEMO-07 vaciar', vaciado.estado === 200 && vaciado.json.totalProductos === 0, `HTTP ${vaciado.estado}, totalProductos=${vaciado.json?.totalProductos}`);

  return resultados;
}
