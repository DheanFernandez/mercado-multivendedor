// EQ-04 · Rendimiento del catálogo (AC01). Umbral documentado:
//   «Con 100 usuarios concurrentes, al menos el 95 % de las consultas del catálogo responde en menos de 2 segundos»
//   → http_req_duration: p(95) < 2000 ms. La documentación pide además «tasa de errores» sin fijar un valor:
//   se usa http_req_failed < 1 % como PARÁMETRO DE LA PRUEBA.
//
// Ejecución (backend aislado en el puerto 3100; ver ops/medicion/README.md):
//   docker run --rm -i -v "<carpeta-resultados>:/resultados" -e BASE_URL=http://host.docker.internal:3100 \
//     grafana/k6 run - < ops/k6/catalogo.js
// Variables: VUS (100), DURACION (2m), PENSAR (segundos de espera entre consultas; 1 = usuario real, 0 = esfuerzo máximo).
import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE = __ENV.BASE_URL || 'http://localhost:3100';
const API = `${BASE}/api/v1`;
const PENSAR = Number(__ENV.PENSAR === undefined ? 1 : __ENV.PENSAR);

export const options = {
  scenarios: {
    usuarios: { executor: 'constant-vus', vus: Number(__ENV.VUS || 100), duration: __ENV.DURACION || '2m' },
  },
  thresholds: {
    http_req_duration: ['p(95)<2000'], // umbral documentado (EQ-04)
    http_req_failed: ['rate<0.01'], // parámetro de la prueba
    checks: ['rate>0.99'],
  },
  summaryTrendStats: ['avg', 'min', 'med', 'max', 'p(90)', 'p(95)', 'p(99)'],
};

export function setup() {
  const categorias = http.get(`${API}/categorias`).json();
  const puestos = http.get(`${API}/puestos/publicos?limite=100`).json();
  const muestra = http.get(`${API}/catalogo/productos?limite=50&pagina=1`).json();
  const ids = muestra.datos.map((p) => p.id);
  const palabras = [...new Set(muestra.datos.flatMap((p) => p.nombre.split(' ')).filter((w) => w.length > 3))].slice(0, 30);
  return { categorias: categorias.map((c) => c.id), puestos: puestos.map((p) => p.id), ids, palabras, totalPaginas: muestra.totalPaginas };
}

const elegir = (a) => a[Math.floor(Math.random() * a.length)];

export default function (d) {
  const r = Math.random();
  let res;
  if (r < 0.4) {
    res = http.get(`${API}/catalogo/productos?pagina=${1 + Math.floor(Math.random() * Math.min(d.totalPaginas, 20))}&limite=12`, { tags: { consulta: 'listado' } });
  } else if (r < 0.6) {
    res = http.get(`${API}/catalogo/productos?q=${encodeURIComponent(elegir(d.palabras))}&limite=12`, { tags: { consulta: 'busqueda' } });
  } else if (r < 0.8) {
    const min = (1 + Math.floor(Math.random() * 50)).toFixed(2);
    res = http.get(
      `${API}/catalogo/productos?categoriaId=${elegir(d.categorias)}&puestoId=${elegir(d.puestos)}&precioMin=${min}&precioMax=200&orden=precio_asc&limite=12`,
      { tags: { consulta: 'filtros' } },
    );
  } else {
    res = http.get(`${API}/catalogo/productos/${elegir(d.ids)}`, { tags: { consulta: 'detalle' } });
  }
  check(res, { 'estado 200': (x) => x.status === 200 });
  if (PENSAR > 0) sleep(PENSAR * (0.5 + Math.random()));
}

export function handleSummary(data) {
  return { '/resultados/resumen.json': JSON.stringify(data, null, 2) };
}
