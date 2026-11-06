import { describe, expect, it } from 'vitest';
import { Rol, type Actor } from '../../../../shared/domain/actor.js';
import { ErrorDeValidacion, ErrorProhibido } from '../../../../shared/domain/errors.js';
import { UsuarioNoEncontradoError } from '../../domain/errors.js';
import { CambiarEstadoUsuario, CambiarRolUsuario } from './gestion-usuarios.use-cases.js';
import { RegistrarUsuario } from './registrar-usuario.use-case.js';
import { IdentidadFalsa, UsuariosEnMemoria } from './test-doubles.js';

const admin: Actor = { id: '00000000-0000-4000-8000-000000000001', rol: Rol.ADMINISTRADOR };
const cliente: Actor = { id: '00000000-0000-4000-8000-000000000002', rol: Rol.CLIENTE };
const comerciante: Actor = { id: '00000000-0000-4000-8000-000000000003', rol: Rol.COMERCIANTE };

async function escenario() {
  const repo = new UsuariosEnMemoria();
  const identidad = new IdentidadFalsa(); // una sola instancia: cada alta recibe un authId distinto
  const u = await new RegistrarUsuario(repo, identidad).ejecutar({ email: 'ana@t.co', nombres: 'Ana', apellidos: 'P', rol: Rol.CLIENTE }, admin);
  return { repo, identidad, u };
}

describe('CambiarEstadoUsuario (HU21)', () => {
  it('el administrador desactiva y reactiva a un usuario y el cambio se persiste', async () => {
    const { repo, u } = await escenario();
    const caso = new CambiarEstadoUsuario(repo);
    expect((await caso.ejecutar(u.id, false, admin)).activo).toBe(false);
    expect((await repo.buscarPorId(u.id))!.estado).toBe('INACTIVO');
    expect((await caso.ejecutar(u.id, true, admin)).activo).toBe(true);
  });

  it.each([[cliente], [comerciante]])('prohíbe a quien no es administrador %#', async (actor) => {
    const { repo, u } = await escenario();
    await expect(new CambiarEstadoUsuario(repo).ejecutar(u.id, false, actor)).rejects.toBeInstanceOf(ErrorProhibido);
    expect((await repo.buscarPorId(u.id))!.activo).toBe(true);
  });

  it('un administrador no puede desactivar su propia cuenta', async () => {
    const { repo, identidad } = await escenario();
    await new RegistrarUsuario(repo, identidad).ejecutar({ email: 'adm@t.co', nombres: 'A', apellidos: 'B', rol: Rol.ADMINISTRADOR }, admin);
    const propio = (await repo.buscarPorEmail('adm@t.co'))!;
    await expect(new CambiarEstadoUsuario(repo).ejecutar(propio.id, false, { id: propio.id, rol: Rol.ADMINISTRADOR })).rejects.toBeInstanceOf(ErrorProhibido);
  });

  it('valida el valor y la existencia del usuario', async () => {
    const { repo, u } = await escenario();
    await expect(new CambiarEstadoUsuario(repo).ejecutar(u.id, 'si', admin)).rejects.toBeInstanceOf(ErrorDeValidacion);
    await expect(new CambiarEstadoUsuario(repo).ejecutar('00000000-0000-4000-8000-0000000000ff', true, admin)).rejects.toBeInstanceOf(UsuarioNoEncontradoError);
  });
});

describe('CambiarRolUsuario (RF05)', () => {
  it('el administrador cambia el rol y se persiste', async () => {
    const { repo, u } = await escenario();
    const r = await new CambiarRolUsuario(repo).ejecutar(u.id, Rol.COMERCIANTE, admin);
    expect(r.rol).toBe(Rol.COMERCIANTE);
    expect((await repo.buscarPorId(u.id))!.rol).toBe(Rol.COMERCIANTE);
  });

  it.each([[cliente], [comerciante]])('un usuario no puede ascenderse ni ascender a otro %#', async (actor) => {
    const { repo, u } = await escenario();
    await expect(new CambiarRolUsuario(repo).ejecutar(u.id, Rol.ADMINISTRADOR, actor)).rejects.toBeInstanceOf(ErrorProhibido);
    await expect(new CambiarRolUsuario(repo).ejecutar(actor.id, Rol.ADMINISTRADOR, actor)).rejects.toBeInstanceOf(ErrorProhibido);
    expect((await repo.buscarPorId(u.id))!.rol).toBe(Rol.CLIENTE);
  });

  it('un administrador no puede cambiar su propio rol', async () => {
    const { repo } = await escenario();
    await expect(new CambiarRolUsuario(repo).ejecutar(admin.id, Rol.CLIENTE, admin)).rejects.toBeInstanceOf(ErrorProhibido);
  });

  it.each([['SUPERADMIN'], [''], [undefined], [null], [7]])('rechaza roles inválidos %j', async (rol) => {
    const { repo, u } = await escenario();
    await expect(new CambiarRolUsuario(repo).ejecutar(u.id, rol, admin)).rejects.toBeInstanceOf(ErrorDeValidacion);
    expect((await repo.buscarPorId(u.id))!.rol).toBe(Rol.CLIENTE);
  });

  it('usuario inexistente → no encontrado', async () => {
    const { repo } = await escenario();
    await expect(new CambiarRolUsuario(repo).ejecutar('00000000-0000-4000-8000-0000000000ff', Rol.CLIENTE, admin)).rejects.toBeInstanceOf(UsuarioNoEncontradoError);
  });
});
