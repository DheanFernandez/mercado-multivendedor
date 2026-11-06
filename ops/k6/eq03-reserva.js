// EQ-03 · Concurrencia: reserva simultánea del mismo stock (AC07), repetición con volumen (k6).
// Procedimiento documentado (03-matriz-de-mediciones.md §EQ-03, paso 4):
//   «k6 con 200 usuarios virtuales durante 1 minuto: las reservas aceptadas deben ser exactamente S» (S = 10)
//   y SELECT count(*) FROM inventarios WHERE stock_reservado > stock_fisico = 0.
// Umbral: 0 reservas incompatibles.
//
// Requiere el arnés (backend/src/scripts/servidor-eq03.ts) sobre la base local aislada; ver ops/medicion/README.md.
//   docker run --rm -i -v "<carpeta-resultados>:/resultados" -e BASE_URL=http://host.docker.internal:3101 \
//     grafana/k6 run - < ops/k6/eq03-reserva.js
// Variables: VUS (200), DURACION (1m), STOCK (10).
import http from 'k6/http';
import { check } from 'k6';
import { Counter, Gauge } from 'k6/metrics';

const BASE = __ENV.BASE_URL || 'http://localhost:3101';
const STOCK = Number(__ENV.STOCK || 10);

const aceptadas = new Counter('reservas_aceptadas'); // 201
const faltasDeStock = new Counter('faltas_de_stock_controladas'); // 409
const inesperadas = new Counter('respuestas_inesperadas'); // cualquier otra
const reservadoFinal = new Gauge('stock_reservado_final');
const fisicoFinal = new Gauge('stock_fisico_final');
const reservasSqlAceptadas = new Gauge('reservas_registradas_en_bd');
const filasIncompatibles = new Gauge('filas_con_reservado_mayor_que_fisico');

export const options = {
  scenarios: { clientes: { executor: 'constant-vus', vus: Number(__ENV.VUS || 200), duration: __ENV.DURACION || '1m' } },
  thresholds: {
    reservas_aceptadas: [`count==${STOCK}`], // exactamente S
    respuestas_inesperadas: ['count==0'],
    filas_con_reservado_mayor_que_fisico: ['value==0'], // consulta SQL de la matriz
    stock_reservado_final: [`value==${STOCK}`],
    reservas_registradas_en_bd: [`value==${STOCK}`],
  },
  summaryTrendStats: ['avg', 'min', 'med', 'max', 'p(90)', 'p(95)', 'p(99)'],
};

export function setup() {
  const r = http.post(`${BASE}/eq03/preparar?stock=${STOCK}`);
  if (r.status !== 200) throw new Error(`No se pudo preparar el producto: ${r.status} ${r.body}`);
  return { productoId: r.json().productoId };
}

export default function (d) {
  const res = http.post(
    `${BASE}/eq03/reservar`,
    JSON.stringify({ productoId: d.productoId, clave: `k6-${__VU}-${__ITER}` }), // un cliente (pedido) distinto en cada solicitud
    { headers: { 'content-type': 'application/json' } },
  );
  if (res.status === 201) aceptadas.add(1);
  else if (res.status === 409) faltasDeStock.add(1);
  else inesperadas.add(1);
  check(res, { 'respuesta controlada (201 o 409)': (x) => x.status === 201 || x.status === 409 });
}

export function teardown(d) {
  const e = http.get(`${BASE}/eq03/estado?productoId=${d.productoId}`).json();
  reservadoFinal.add(e.stockReservado);
  fisicoFinal.add(e.stockFisico);
  reservasSqlAceptadas.add(e.unidadesReservadas);
  filasIncompatibles.add(e.reservadoSuperaFisico);
  console.log(`ESTADO_FINAL ${JSON.stringify(e)}`);
}

export function handleSummary(data) {
  return { '/resultados/eq03-k6.json': JSON.stringify(data, null, 2) };
}
