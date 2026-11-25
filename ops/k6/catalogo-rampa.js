// Prueba de carga progresiva del catálogo (ramping-vus hasta 2000 VUs). NO sustituye a catalogo.js (EQ-04, 100 VUs).
// Mismo patrón que el escenario de criterio de EQ-04: mismas rutas, misma mezcla (40 % listado, 20 % búsqueda,
// 20 % filtros combinados, 20 % detalle) y misma espera: PENSAR = 1 → sleep(1 × (0,5 + aleatorio)) = 0,5–1,5 s.
//
// Umbral objetivo, copiado de docs/01-analisis-de-sistema/08-escenarios-atributos-calidad.md (EQ-04, «Medida»):
//   «con 100 usuarios concurrentes, al menos el 95 % de las consultas del catálogo responde en menos de 2 segundos»
//   (propuesta por validar) → http_req_duration: p(95) < 2000. El umbral original es para 100 VUs: aquí se mide
//   por tramo para ver dónde deja de cumplirse. `http_req_failed < 1 %` es un PARÁMETRO PROPIO de la prueba
//   (la documentación pide medir la tasa de errores pero no fija un valor).
//
// Ejecución (ver docs/07-sprint-02/evidencias/2026-11-25/k6-rampa-2000/README.md):
//   docker run --rm -i -v "<carpeta>:/resultados" -e BASE_URL=http://host.docker.internal:3100 grafana/k6 run --summary-export=/resultados/resumen.json - < ops/k6/catalogo-rampa.js
import http from 'k6/http';
import { check, sleep } from 'k6';
import exec from 'k6/execution';

const BASE = __ENV.BASE_URL || 'http://localhost:3100';
const API = `${BASE}/api/v1`;
const PENSAR = Number(__ENV.PENSAR === undefined ? 1 : __ENV.PENSAR);
const ESCALA = Number(__ENV.ESCALA || 1); // 1 = duraciones reales; <1 solo para ensayos cortos

// Etapas: [duración (s), VUs objetivo, tramo]
const ETAPAS = [
  [60, 100, '0-100'],
  [120, 500, '100-500'],
  [120, 1000, '500-1000'],
  [120, 2000, '1000-2000'],
  [120, 2000, '2000-sostenido'],
  [60, 0, '2000-0'],
];
const TRAMOS = ETAPAS.map((e) => e[2]);
// Instante (s desde el inicio) en que termina cada etapa, para etiquetar cada solicitud con su tramo.
const FINES = ETAPAS.reduce((a, e) => (a.push((a.length ? a[a.length - 1] : 0) + e[0] * ESCALA), a), []);

export const options = {
  scenarios: {
    rampa: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: ETAPAS.map((e) => ({ duration: `${Math.round(e[0] * ESCALA)}s`, target: e[1] })),
      gracefulRampDown: '10s',
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<2000'], // criterio de EQ-04 (Sprint 1)
    http_req_failed: ['rate<0.01'], // parámetro propio de la prueba
    checks: ['rate>0.99'],
    // Un umbral por tramo (sin abortar) para que el resumen exporte p95/p99/errores por tramo.
    ...Object.fromEntries(TRAMOS.flatMap((t) => [[`http_req_duration{tramo:${t}}`, ['p(95)<2000']], [`http_req_failed{tramo:${t}}`, ['rate<0.01']], [`http_reqs{tramo:${t}}`, ['count>=0']]])),
  },
  summaryTrendStats: ['avg', 'min', 'med', 'max', 'p(90)', 'p(95)', 'p(99)'],
};

// Tiempo desde el inicio de la prueba (no desde la inicialización del VU, que con 2000 VUs tarda segundos).
function tramoActual() {
  const t = exec.instance.currentTestRunDuration / 1000;
  for (let i = 0; i < FINES.length; i++) if (t < FINES[i]) return TRAMOS[i];
  return TRAMOS[TRAMOS.length - 1];
}

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
  const tramo = tramoActual();
  const r = Math.random();
  let res;
  if (r < 0.4) {
    res = http.get(`${API}/catalogo/productos?pagina=${1 + Math.floor(Math.random() * Math.min(d.totalPaginas, 20))}&limite=12`, { tags: { consulta: 'listado', tramo } });
  } else if (r < 0.6) {
    res = http.get(`${API}/catalogo/productos?q=${encodeURIComponent(elegir(d.palabras))}&limite=12`, { tags: { consulta: 'busqueda', tramo } });
  } else if (r < 0.8) {
    const min = (1 + Math.floor(Math.random() * 50)).toFixed(2);
    res = http.get(
      `${API}/catalogo/productos?categoriaId=${elegir(d.categorias)}&puestoId=${elegir(d.puestos)}&precioMin=${min}&precioMax=200&orden=precio_asc&limite=12`,
      { tags: { consulta: 'filtros', tramo } },
    );
  } else {
    res = http.get(`${API}/catalogo/productos/${elegir(d.ids)}`, { tags: { consulta: 'detalle', tramo } });
  }
  check(res, { 'estado 200': (x) => x.status === 200 }, { tramo });
  if (PENSAR > 0) sleep(PENSAR * (0.5 + Math.random()));
}
