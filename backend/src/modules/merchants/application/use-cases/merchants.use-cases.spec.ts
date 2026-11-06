import { describe, expect, it } from 'vitest';
import { Rol, type Actor } from '../../../../shared/domain/actor.js';
import { ErrorDeValidacion, ErrorProhibido } from '../../../../shared/domain/errors.js';
import type { Comerciante } from '../../domain/comerciante.entity.js';
import {
  CodigoPuestoDuplicadoError,
  ComercianteNoEncontradoError,
  ComercianteYaRegistradoError,
  UsuarioNoEncontradoParaComercianteError,
  UsuarioNoEsComercianteError,
} from '../../domain/errors.js';
import type { Puesto } from '../../domain/puesto.entity.js';
import type { ComercianteRepository, PuestoRepository, UsuarioConsultaPort } from '../ports/ports.js';
import { ConsultarComerciante, ListarComerciantes, RegistrarComerciante } from './comerciantes.use-cases.js';
import { ListarPuestos, RegistrarPuesto } from './puestos.use-cases.js';

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const admin: Actor = { id: id(1), rol: Rol.ADMINISTRADOR };
const cliente: Actor = { id: id(2), rol: Rol.CLIENTE };
const usuarioComerciante = id(10);
const otroComerciante = id(11);
const actorComerciante: Actor = { id: usuarioComerciante, rol: Rol.COMERCIANTE };
const actorOtro: Actor = { id: otroComerciante, rol: Rol.COMERCIANTE };

const usuarios: UsuarioConsultaPort = {
  async obtenerResumen(u) {
    const tabla: Record<string, { id: string; rol: Rol; activo: boolean }> = {
      [usuarioComerciante]: { id: usuarioComerciante, rol: Rol.COMERCIANTE, activo: true },
      [otroComerciante]: { id: otroComerciante, rol: Rol.COMERCIANTE, activo: true },
      [id(2)]: { id: id(2), rol: Rol.CLIENTE, activo: true },
      [id(12)]: { id: id(12), rol: Rol.COMERCIANTE, activo: false },
    };
    return tabla[u] ?? null;
  },
};

class ComerciantesEnMemoria implements ComercianteRepository {
  datos: Comerciante[] = [];
  async guardar(c: Comerciante) {
    const i = this.datos.findIndex((x) => x.id === c.id);
    if (i >= 0) { this.datos[i] = c; return; }
    if (this.datos.some((x) => x.usuarioId === c.usuarioId)) throw new ComercianteYaRegistradoError();
    this.datos.push(c);
  }
  async buscarPorId(i: string) { return this.datos.find((c) => c.id === i) ?? null; }
  async buscarPorUsuarioId(u: string) { return this.datos.find((c) => c.usuarioId === u) ?? null; }
  async listar({ limite, desplazamiento }: { limite: number; desplazamiento: number }) { return this.datos.slice(desplazamiento, desplazamiento + limite); }
}

class PuestosEnMemoria implements PuestoRepository {
  datos: Puesto[] = [];
  async guardar(p: Puesto) {
    if (this.datos.some((x) => x.id !== p.id && x.codigo === p.codigo)) throw new CodigoPuestoDuplicadoError();
    const i = this.datos.findIndex((x) => x.id === p.id);
    if (i >= 0) this.datos[i] = p; else this.datos.push(p);
  }
  async buscarPorId(i: string) { return this.datos.find((p) => p.id === i) ?? null; }
  async listarOperativos() { return this.datos.filter((p) => p.estado === 'ACTIVO'); }
  async listar({ comercianteId }: { comercianteId?: string }) { return this.datos.filter((p) => !comercianteId || p.comercianteId === comercianteId); }
}

describe('RegistrarComerciante', () => {
  const nuevo = () => {
    const repo = new ComerciantesEnMemoria();
    return { repo, caso: new RegistrarComerciante(repo, usuarios) };
  };

  it('el administrador registra un comerciante para un usuario con rol COMERCIANTE', async () => {
    const { repo, caso } = nuevo();
    const c = await caso.ejecutar({ usuarioId: usuarioComerciante, nombreComercial: '  Frutas Doña Rosa ' }, admin);
    expect(c.nombreComercial).toBe('Frutas Doña Rosa');
    expect(c.activo).toBe(true);
    expect(repo.datos).toHaveLength(1);
  });

  it.each([[cliente], [actorComerciante]])('prohíbe registrar a quien no es administrador %#', async (actor) => {
    const { caso } = nuevo();
    await expect(caso.ejecutar({ usuarioId: usuarioComerciante, nombreComercial: 'X' }, actor)).rejects.toBeInstanceOf(ErrorProhibido);
  });

  it('rechaza usuarios inexistentes, con otro rol o inactivos', async () => {
    const { caso } = nuevo();
    await expect(caso.ejecutar({ usuarioId: id(99), nombreComercial: 'X' }, admin)).rejects.toBeInstanceOf(UsuarioNoEncontradoParaComercianteError);
    await expect(caso.ejecutar({ usuarioId: id(2), nombreComercial: 'X' }, admin)).rejects.toBeInstanceOf(UsuarioNoEsComercianteError);
    await expect(caso.ejecutar({ usuarioId: id(12), nombreComercial: 'X' }, admin)).rejects.toBeInstanceOf(UsuarioNoEsComercianteError);
  });

  it('rechaza un segundo perfil para el mismo usuario', async () => {
    const { caso } = nuevo();
    await caso.ejecutar({ usuarioId: usuarioComerciante, nombreComercial: 'A' }, admin);
    await expect(caso.ejecutar({ usuarioId: usuarioComerciante, nombreComercial: 'B' }, admin)).rejects.toBeInstanceOf(ComercianteYaRegistradoError);
  });

  it('exige un nombre comercial', async () => {
    const { caso } = nuevo();
    await expect(caso.ejecutar({ usuarioId: usuarioComerciante, nombreComercial: '  ' }, admin)).rejects.toBeInstanceOf(ErrorDeValidacion);
  });
});

describe('ConsultarComerciante y ListarComerciantes', () => {
  it('el titular y el administrador consultan; otros no', async () => {
    const repo = new ComerciantesEnMemoria();
    const c = await new RegistrarComerciante(repo, usuarios).ejecutar({ usuarioId: usuarioComerciante, nombreComercial: 'A' }, admin);
    const caso = new ConsultarComerciante(repo);
    await expect(caso.ejecutar(c.id, actorComerciante)).resolves.toBe(c);
    await expect(caso.ejecutar(c.id, admin)).resolves.toBe(c);
    await expect(caso.ejecutar(c.id, actorOtro)).rejects.toBeInstanceOf(ErrorProhibido);
    await expect(caso.ejecutar(c.id, cliente)).rejects.toBeInstanceOf(ErrorProhibido);
    await expect(caso.ejecutar(id(77), admin)).rejects.toBeInstanceOf(ComercianteNoEncontradoError);
    await expect(caso.ejecutar(id(77), actorOtro)).rejects.toBeInstanceOf(ErrorProhibido);
  });

  it('solo el administrador lista comerciantes', async () => {
    const repo = new ComerciantesEnMemoria();
    await expect(new ListarComerciantes(repo).ejecutar(actorComerciante)).rejects.toBeInstanceOf(ErrorProhibido);
    await expect(new ListarComerciantes(repo).ejecutar(admin)).resolves.toEqual([]);
  });
});

describe('Puestos', () => {
  const escenario = async () => {
    const comerciantes = new ComerciantesEnMemoria();
    const puestos = new PuestosEnMemoria();
    const registrar = new RegistrarComerciante(comerciantes, usuarios);
    const a = await registrar.ejecutar({ usuarioId: usuarioComerciante, nombreComercial: 'A' }, admin);
    const b = await registrar.ejecutar({ usuarioId: otroComerciante, nombreComercial: 'B' }, admin);
    return { comerciantes, puestos, a, b, registrarPuesto: new RegistrarPuesto(puestos, comerciantes), listar: new ListarPuestos(puestos, comerciantes) };
  };

  it('el administrador registra puestos con código normalizado y único', async () => {
    const { a, registrarPuesto } = await escenario();
    const p = await registrarPuesto.ejecutar({ comercianteId: a.id, codigo: ' a-12 ', nombre: 'Verduras' }, admin);
    expect(p.codigo).toBe('A-12');
    await expect(registrarPuesto.ejecutar({ comercianteId: a.id, codigo: 'A-12', nombre: 'Otro' }, admin)).rejects.toBeInstanceOf(CodigoPuestoDuplicadoError);
  });

  it('prohíbe registrar puestos a un comerciante y rechaza comerciantes inexistentes o códigos inválidos', async () => {
    const { a, registrarPuesto } = await escenario();
    await expect(registrarPuesto.ejecutar({ comercianteId: a.id, codigo: 'A1', nombre: 'X' }, actorComerciante)).rejects.toBeInstanceOf(ErrorProhibido);
    await expect(registrarPuesto.ejecutar({ comercianteId: id(88), codigo: 'A1', nombre: 'X' }, admin)).rejects.toBeInstanceOf(ComercianteNoEncontradoError);
    await expect(registrarPuesto.ejecutar({ comercianteId: a.id, codigo: 'A 1!', nombre: 'X' }, admin)).rejects.toBeInstanceOf(ErrorDeValidacion);
    await expect(registrarPuesto.ejecutar({ comercianteId: a.id, codigo: 'A1', nombre: ' ' }, admin)).rejects.toBeInstanceOf(ErrorDeValidacion);
  });

  it('el comerciante solo ve sus propios puestos; el administrador ve todos', async () => {
    const { a, b, registrarPuesto, listar } = await escenario();
    await registrarPuesto.ejecutar({ comercianteId: a.id, codigo: 'A1', nombre: 'Uno' }, admin);
    await registrarPuesto.ejecutar({ comercianteId: b.id, codigo: 'B1', nombre: 'Dos' }, admin);
    expect((await listar.ejecutar(actorComerciante)).map((p) => p.codigo)).toEqual(['A1']);
    expect(await listar.ejecutar(admin)).toHaveLength(2);
    expect(await listar.ejecutar(admin, { comercianteId: b.id })).toHaveLength(1);
    await expect(listar.ejecutar(actorComerciante, { comercianteId: b.id })).rejects.toBeInstanceOf(ErrorProhibido);
    await expect(listar.ejecutar(cliente)).rejects.toBeInstanceOf(ErrorProhibido);
  });
});
