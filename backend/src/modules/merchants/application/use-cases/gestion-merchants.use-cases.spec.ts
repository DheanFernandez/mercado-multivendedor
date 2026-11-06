import { describe, expect, it } from 'vitest';
import { Rol, type Actor } from '../../../../shared/domain/actor.js';
import { ErrorDeValidacion, ErrorProhibido } from '../../../../shared/domain/errors.js';
import { Comerciante } from '../../domain/comerciante.entity.js';
import { CodigoPuestoDuplicadoError, ComercianteInactivoError, ComercianteNoEncontradoError, PuestoNoEncontradoError } from '../../domain/errors.js';
import { Puesto } from '../../domain/puesto.entity.js';
import type { ComercianteRepository, PuestoRepository } from '../ports/ports.js';
import { ActualizarComerciante, ActualizarPuesto, CambiarEstadoComerciante, CambiarEstadoPuesto, ListarPuestosPublicos, ObtenerPuesto } from './gestion-merchants.use-cases.js';

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const admin: Actor = { id: id(1), rol: Rol.ADMINISTRADOR };
const cliente: Actor = { id: id(2), rol: Rol.CLIENTE };
const ana: Actor = { id: id(10), rol: Rol.COMERCIANTE };
const beto: Actor = { id: id(11), rol: Rol.COMERCIANTE };

function escenario() {
  const comerciantes: Comerciante[] = [
    Comerciante.crear({ id: id(201), usuarioId: ana.id, nombreComercial: 'Frutas Ana' }),
    Comerciante.crear({ id: id(202), usuarioId: beto.id, nombreComercial: 'Verduras Beto' }),
  ];
  const puestos: Puesto[] = [
    Puesto.crear({ id: id(301), comercianteId: id(201), codigo: 'A-1', nombre: 'Frutas' }),
    Puesto.crear({ id: id(302), comercianteId: id(202), codigo: 'B-1', nombre: 'Verduras' }),
  ];
  const repoC: ComercianteRepository = {
    async guardar(c) { const i = comerciantes.findIndex((x) => x.id === c.id); if (i >= 0) comerciantes[i] = c; else comerciantes.push(c); },
    async buscarPorId(i) { const c = comerciantes.find((x) => x.id === i); return c ? Comerciante.reconstruir(c.toJSON()) : null; }, // copia, como una base real
    async buscarPorUsuarioId(u) { const c = comerciantes.find((x) => x.usuarioId === u); return c ? Comerciante.reconstruir(c.toJSON()) : null; },
    async listar() { return comerciantes; },
  };
  const repoP: PuestoRepository = {
    async guardar(p) {
      if (puestos.some((x) => x.id !== p.id && x.codigo === p.codigo)) throw new CodigoPuestoDuplicadoError();
      const i = puestos.findIndex((x) => x.id === p.id); if (i >= 0) puestos[i] = p; else puestos.push(p);
    },
    async buscarPorId(i) { const p = puestos.find((x) => x.id === i); return p ? Puesto.reconstruir(p.toJSON()) : null; }, // copia, como una base real
    async listarOperativos() {
      return puestos.filter((p) => p.estado === 'ACTIVO' && comerciantes.find((c) => c.id === p.comercianteId)?.activo);
    },
    async listar() { return puestos; },
  };
  return { comerciantes, puestos, repoC, repoP };
}

describe('ActualizarComerciante y CambiarEstadoComerciante (RF06, HU22)', () => {
  it('el administrador edita el nombre y suspende o reactiva', async () => {
    const { repoC } = escenario();
    expect((await new ActualizarComerciante(repoC).ejecutar(id(201), { nombreComercial: '  Frutas Doña Ana ' }, admin)).nombreComercial).toBe('Frutas Doña Ana');
    expect((await new CambiarEstadoComerciante(repoC).ejecutar(id(201), false, admin)).estado).toBe('SUSPENDIDO');
    expect((await new CambiarEstadoComerciante(repoC).ejecutar(id(201), true, admin)).estado).toBe('ACTIVO');
  });

  it.each([[cliente], [ana], [beto]])('los demás roles reciben 403 y nada cambia %#', async (actor) => {
    const { repoC, comerciantes } = escenario();
    await expect(new ActualizarComerciante(repoC).ejecutar(id(201), { nombreComercial: 'X' }, actor)).rejects.toBeInstanceOf(ErrorProhibido);
    await expect(new CambiarEstadoComerciante(repoC).ejecutar(id(201), false, actor)).rejects.toBeInstanceOf(ErrorProhibido);
    expect(comerciantes[0]).toMatchObject({ nombreComercial: 'Frutas Ana', estado: 'ACTIVO' });
  });

  it('valida nombre y estado, y la existencia del comerciante', async () => {
    const { repoC, comerciantes } = escenario();
    await expect(new ActualizarComerciante(repoC).ejecutar(id(201), { nombreComercial: '  ' }, admin)).rejects.toBeInstanceOf(ErrorDeValidacion);
    await expect(new ActualizarComerciante(repoC).ejecutar(id(201), { nombreComercial: 'x'.repeat(151) }, admin)).rejects.toBeInstanceOf(ErrorDeValidacion);
    await expect(new CambiarEstadoComerciante(repoC).ejecutar(id(201), 'no', admin)).rejects.toBeInstanceOf(ErrorDeValidacion);
    await expect(new CambiarEstadoComerciante(repoC).ejecutar(id(999), false, admin)).rejects.toBeInstanceOf(ComercianteNoEncontradoError);
    expect(comerciantes[0].nombreComercial).toBe('Frutas Ana');
  });
});

describe('ActualizarPuesto y CambiarEstadoPuesto (RF07, HU22)', () => {
  it('edita código y nombre (código normalizado) y reasigna el puesto a otro comerciante', async () => {
    const { repoP, repoC } = escenario();
    const caso = new ActualizarPuesto(repoP, repoC);
    const p = await caso.ejecutar(id(301), { codigo: ' a-9 ', nombre: ' Fruta fina ' }, admin);
    expect(p).toMatchObject({ codigo: 'A-9', nombre: 'Fruta fina' });
    expect((await caso.ejecutar(id(301), { comercianteId: id(202) }, admin)).comercianteId).toBe(id(202));
  });

  it('rechaza código duplicado, comerciante inexistente o suspendido y datos inválidos sin modificar nada', async () => {
    const { repoP, repoC, comerciantes, puestos } = escenario();
    const caso = new ActualizarPuesto(repoP, repoC);
    await expect(caso.ejecutar(id(301), { codigo: 'b-1' }, admin)).rejects.toBeInstanceOf(CodigoPuestoDuplicadoError);
    await expect(caso.ejecutar(id(301), { comercianteId: id(999) }, admin)).rejects.toBeInstanceOf(ComercianteNoEncontradoError);
    comerciantes[1].cambiarEstado(false);
    await expect(caso.ejecutar(id(301), { comercianteId: id(202) }, admin)).rejects.toBeInstanceOf(ComercianteInactivoError);
    await expect(caso.ejecutar(id(301), { codigo: 'a 1!' }, admin)).rejects.toBeInstanceOf(ErrorDeValidacion);
    await expect(caso.ejecutar(id(301), { nombre: ' ' }, admin)).rejects.toBeInstanceOf(ErrorDeValidacion);
    await expect(caso.ejecutar(id(999), { nombre: 'x' }, admin)).rejects.toBeInstanceOf(PuestoNoEncontradoError);
    expect(puestos[0]).toMatchObject({ codigo: 'A-1', comercianteId: id(201) });
  });

  it.each([[cliente], [ana], [beto]])('solo el administrador edita o desactiva puestos %#', async (actor) => {
    const { repoP, repoC } = escenario();
    await expect(new ActualizarPuesto(repoP, repoC).ejecutar(id(301), { nombre: 'Robado' }, actor)).rejects.toBeInstanceOf(ErrorProhibido);
    await expect(new CambiarEstadoPuesto(repoP).ejecutar(id(301), false, actor)).rejects.toBeInstanceOf(ErrorProhibido);
  });

  it('desactiva y reactiva un puesto, y valida el valor', async () => {
    const { repoP } = escenario();
    const caso = new CambiarEstadoPuesto(repoP);
    expect((await caso.ejecutar(id(301), false, admin)).estado).toBe('INACTIVO');
    expect((await caso.ejecutar(id(301), true, admin)).estado).toBe('ACTIVO');
    await expect(caso.ejecutar(id(301), 1, admin)).rejects.toBeInstanceOf(ErrorDeValidacion);
    await expect(caso.ejecutar(id(999), false, admin)).rejects.toBeInstanceOf(PuestoNoEncontradoError);
  });
});

describe('ObtenerPuesto y ListarPuestosPublicos', () => {
  it('el administrador y el titular consultan; otro comerciante y el cliente no', async () => {
    const { repoP, repoC } = escenario();
    const caso = new ObtenerPuesto(repoP, repoC);
    await expect(caso.ejecutar(id(301), admin)).resolves.toMatchObject({ codigo: 'A-1' });
    await expect(caso.ejecutar(id(301), ana)).resolves.toMatchObject({ codigo: 'A-1' });
    await expect(caso.ejecutar(id(301), beto)).rejects.toBeInstanceOf(ErrorProhibido);
    await expect(caso.ejecutar(id(301), cliente)).rejects.toBeInstanceOf(ErrorProhibido);
    await expect(caso.ejecutar(id(999), admin)).rejects.toBeInstanceOf(PuestoNoEncontradoError);
  });

  it('el listado público solo incluye puestos activos de comerciantes activos', async () => {
    const { repoP, comerciantes, puestos } = escenario();
    const caso = new ListarPuestosPublicos(repoP);
    expect((await caso.ejecutar()).map((p) => p.codigo)).toEqual(['A-1', 'B-1']);
    puestos[0].cambiarEstado(false);
    comerciantes[1].cambiarEstado(false);
    expect(await caso.ejecutar()).toEqual([]);
    await expect(caso.ejecutar({ limite: 0 })).rejects.toBeInstanceOf(ErrorDeValidacion);
  });
});
