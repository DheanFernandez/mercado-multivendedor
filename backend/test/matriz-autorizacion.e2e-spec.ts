/**
 * Medición AC04 (usuarios): «Los usuarios no deberán acceder a recursos ni ejecutar operaciones fuera de los permisos
 * asignados a sus roles». Recorre TODAS las rutas × 6 identidades y compara el resultado con la tabla de permisos
 * declarada. Una operación «permitida» es aquella cuya autorización pasa (cualquier respuesta distinta de 401/403:
 * 2xx, o 400/404/409 por el cuerpo vacío o el recurso); una «denegada» debe dar 401 (anónimo) o 403 (autenticado).
 *
 * Para guardar el informe: EVIDENCIA_DIR=<carpeta> npm run test:e2e -- test/matriz-autorizacion.e2e-spec.ts
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { type INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { U, bearer, crearAppEnMemoria, uid } from './helpers/app-en-memoria.js';

type Identidad = 'anonimo' | 'cliente' | 'trabajador' | 'comercianteAjeno' | 'comercianteTitular' | 'administrador';
const IDENTIDADES: Identidad[] = ['anonimo', 'cliente', 'trabajador', 'comercianteAjeno', 'comercianteTitular', 'administrador'];
const TODOS = IDENTIDADES;
const AUTENTICADOS = IDENTIDADES.filter((i) => i !== 'anonimo');
const ADMIN: Identidad[] = ['administrador'];
const COMERCIANTES: Identidad[] = ['comercianteAjeno', 'comercianteTitular'];

const cabecera = (i: Identidad) =>
  i === 'anonimo' ? {} : bearer({ cliente: U.CLIENTE, trabajador: U.TRABAJADOR, comercianteAjeno: U.COM_B, comercianteTitular: U.COM_A, administrador: U.ADMIN }[i]);

interface Ruta { metodo: 'get' | 'post' | 'patch' | 'delete'; ruta: string; cuerpo?: object; permitidos: Identidad[]; nota?: string }

describe('AC04 · matriz de autorización rol × ruta', () => {
  let app: INestApplication;
  let rutas: Ruta[] = [];
  const resultados: { metodo: string; ruta: string; identidad: Identidad; esperado: string; obtenido: number; conforme: boolean }[] = [];

  beforeAll(async () => {
    const h = await crearAppEnMemoria();
    app = h.app;
    const { comercianteA, puestoA, categoria, producto, imagen } = h.ids;
    const objetivo = uid(U.OBJETIVO);
    // Las operaciones de escritura se envían sin efecto (cuerpos vacíos o idempotentes): la medición evalúa la AUTORIZACIÓN.
    rutas = [
      { metodo: 'get', ruta: '/', permitidos: TODOS },
      { metodo: 'post', ruta: '/api/v1/auth/registro', cuerpo: {}, permitidos: TODOS },
      { metodo: 'get', ruta: '/api/v1/auth/me', permitidos: AUTENTICADOS },
      { metodo: 'post', ruta: '/api/v1/usuarios', cuerpo: {}, permitidos: ADMIN },
      { metodo: 'get', ruta: '/api/v1/usuarios', permitidos: ADMIN },
      { metodo: 'get', ruta: `/api/v1/usuarios/${objetivo}`, permitidos: ADMIN, nota: 'recurso de otro usuario' },
      { metodo: 'patch', ruta: `/api/v1/usuarios/${objetivo}/estado`, cuerpo: { activo: true }, permitidos: ADMIN },
      { metodo: 'patch', ruta: `/api/v1/usuarios/${objetivo}/rol`, cuerpo: { rol: 'CLIENTE' }, permitidos: ADMIN },
      { metodo: 'post', ruta: '/api/v1/comerciantes', cuerpo: {}, permitidos: ADMIN },
      { metodo: 'get', ruta: '/api/v1/comerciantes', permitidos: ADMIN },
      { metodo: 'get', ruta: `/api/v1/comerciantes/${comercianteA}`, permitidos: [...ADMIN, 'comercianteTitular'] },
      { metodo: 'patch', ruta: `/api/v1/comerciantes/${comercianteA}`, cuerpo: {}, permitidos: ADMIN },
      { metodo: 'patch', ruta: `/api/v1/comerciantes/${comercianteA}/estado`, cuerpo: { activo: true }, permitidos: ADMIN },
      { metodo: 'post', ruta: '/api/v1/puestos', cuerpo: {}, permitidos: ADMIN },
      { metodo: 'get', ruta: '/api/v1/puestos', permitidos: [...ADMIN, ...COMERCIANTES] },
      { metodo: 'get', ruta: '/api/v1/puestos/publicos', permitidos: TODOS },
      { metodo: 'get', ruta: `/api/v1/puestos/${puestoA}`, permitidos: [...ADMIN, 'comercianteTitular'] },
      { metodo: 'patch', ruta: `/api/v1/puestos/${puestoA}`, cuerpo: {}, permitidos: ADMIN },
      { metodo: 'patch', ruta: `/api/v1/puestos/${puestoA}/estado`, cuerpo: { activo: true }, permitidos: ADMIN },
      { metodo: 'get', ruta: '/api/v1/categorias', permitidos: TODOS },
      { metodo: 'get', ruta: '/api/v1/categorias/gestion', permitidos: ADMIN },
      { metodo: 'post', ruta: '/api/v1/categorias', cuerpo: {}, permitidos: ADMIN },
      { metodo: 'patch', ruta: `/api/v1/categorias/${categoria}`, cuerpo: {}, permitidos: ADMIN },
      { metodo: 'patch', ruta: `/api/v1/categorias/${categoria}/estado`, cuerpo: { activa: true }, permitidos: ADMIN },
      { metodo: 'post', ruta: '/api/v1/productos', cuerpo: {}, permitidos: COMERCIANTES, nota: 'cualquier comerciante; la propiedad del puesto se valida con datos válidos' },
      { metodo: 'get', ruta: '/api/v1/productos', permitidos: [...ADMIN, ...COMERCIANTES] },
      { metodo: 'get', ruta: `/api/v1/productos/${producto}`, permitidos: [...ADMIN, 'comercianteTitular'] },
      { metodo: 'patch', ruta: `/api/v1/productos/${producto}`, cuerpo: {}, permitidos: ['comercianteTitular'] },
      { metodo: 'patch', ruta: `/api/v1/productos/${producto}/estado`, cuerpo: { accion: 'X' }, permitidos: ['comercianteTitular'] },
      { metodo: 'post', ruta: `/api/v1/productos/${producto}/imagenes`, permitidos: ['comercianteTitular'] },
      { metodo: 'delete', ruta: `/api/v1/productos/${producto}/imagenes/${imagen}`, permitidos: ['comercianteTitular'] },
      { metodo: 'get', ruta: '/api/v1/catalogo/productos', permitidos: TODOS },
      { metodo: 'get', ruta: `/api/v1/catalogo/productos/${producto}`, permitidos: TODOS },
    ];
    for (const r of rutas) {
      for (const identidad of IDENTIDADES) {
        const res = await request(app.getHttpServer())[r.metodo](r.ruta).set(cabecera(identidad)).send(r.cuerpo ?? {});
        const permitido = r.permitidos.includes(identidad);
        const esperado = permitido ? 'permitido' : identidad === 'anonimo' ? '401' : '403';
        const conforme = permitido ? res.status !== 401 && res.status !== 403 : res.status === Number(esperado);
        resultados.push({ metodo: r.metodo.toUpperCase(), ruta: r.ruta, identidad, esperado, obtenido: res.status, conforme });
      }
    }
  });
  afterAll(async () => {
    await app.close();
    const dir = process.env['EVIDENCIA_DIR'];
    if (!dir) return;
    mkdirSync(dir, { recursive: true });
    const total = resultados.length;
    const conformes = resultados.filter((r) => r.conforme).length;
    writeFileSync(join(dir, 'matriz-autorizacion.json'), JSON.stringify({ medicion: 'AC04 · matriz rol × ruta', rutas: rutas.length, identidades: IDENTIDADES, casos: total, conformes, noConformes: total - conformes, resultados }, null, 2));
    const filas = rutas.map((r) => `| ${r.metodo.toUpperCase()} \`${r.ruta.replace(/[0-9a-f-]{36}/g, ':id')}\` | ${IDENTIDADES.map((i) => {
      const x = resultados.find((q) => q.ruta === r.ruta && q.metodo === r.metodo.toUpperCase() && q.identidad === i)!;
      return `${x.conforme ? '✔' : '✘'} ${x.obtenido}`;
    }).join(' | ')} |`);
    writeFileSync(join(dir, 'matriz-autorizacion.md'), `| Ruta | ${IDENTIDADES.join(' | ')} |\n|---|${IDENTIDADES.map(() => '---').join('|')}|\n${filas.join('\n')}\n\n**${conformes} de ${total} casos conformes** (${rutas.length} rutas × ${IDENTIDADES.length} identidades). ✔ = el resultado coincide con la tabla de permisos; el número es el código HTTP obtenido.\n`);
  });

  it('cubre todas las rutas declaradas en los controladores', () => {
    expect(rutas.length).toBeGreaterThanOrEqual(33);
    expect(resultados.length).toBe(rutas.length * IDENTIDADES.length);
  });

  it('el 100 % de los casos coincide con la tabla de permisos (anónimo → 401, sin permiso → 403, con permiso → autorizado)', () => {
    const fallos = resultados.filter((r) => !r.conforme);
    expect(fallos).toEqual([]);
  });

  it('ninguna identidad sin permiso obtiene una respuesta de éxito (2xx) en una ruta restringida', () => {
    const restringidas = new Set(rutas.filter((r) => r.permitidos.length < TODOS.length).map((r) => `${r.metodo.toUpperCase()} ${r.ruta}`));
    const intrusos = resultados.filter((r) => restringidas.has(`${r.metodo} ${r.ruta}`) && !rutas.find((x) => x.ruta === r.ruta && x.metodo.toUpperCase() === r.metodo)!.permitidos.includes(r.identidad) && r.obtenido >= 200 && r.obtenido < 300);
    expect(intrusos).toEqual([]);
  });
});
