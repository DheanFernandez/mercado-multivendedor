import { describe, expect, it } from 'vitest';
import { Rol, type Actor } from '../../../../shared/domain/actor.js';
import { ErrorDeValidacion, ErrorProhibido } from '../../../../shared/domain/errors.js';
import { EmailYaRegistradoError, IdentidadYaExisteError, UsuarioNoEncontradoError } from '../../domain/errors.js';
import { ConsultarUsuario } from './consultar-usuario.use-case.js';
import { ListarUsuarios } from './listar-usuarios.use-case.js';
import { ObtenerResumenUsuario } from './obtener-resumen-usuario.use-case.js';
import { RegistrarCliente } from './registrar-cliente.use-case.js';
import { RegistrarUsuario } from './registrar-usuario.use-case.js';
import { ResolverUsuarioPorAuthId } from './resolver-usuario-por-auth-id.use-case.js';
import { IdentidadFalsa, UsuariosEnMemoria } from './test-doubles.js';

const admin: Actor = { id: '00000000-0000-4000-8000-000000000001', rol: Rol.ADMINISTRADOR };
const cliente: Actor = { id: '00000000-0000-4000-8000-000000000002', rol: Rol.CLIENTE };
const datos = { email: 'Ana@Correo.com ', nombres: 'Ana', apellidos: 'Pérez' };
const clienteNuevo = { ...datos, contrasena: 'clave-segura-1' };

describe('RegistrarCliente (autorregistro)', () => {
  const nuevo = () => {
    const repo = new UsuariosEnMemoria();
    const identidad = new IdentidadFalsa();
    return { repo, identidad, caso: new RegistrarCliente(repo, identidad) };
  };

  it('crea un CLIENTE vinculado al authId de la identidad, con el correo normalizado', async () => {
    const { repo, identidad, caso } = nuevo();
    const u = await caso.ejecutar(clienteNuevo);
    expect(u.rol).toBe(Rol.CLIENTE);
    expect(u.email).toBe('ana@correo.com');
    expect(u.authId).toBe('00000000-0000-4000-9000-000000000001');
    expect(identidad.registrados).toEqual(['ana@correo.com']);
    expect(repo.datos.size).toBe(1);
  });

  it('ignora cualquier rol enviado por el cliente HTTP', async () => {
    const { caso } = nuevo();
    const u = await caso.ejecutar({ ...clienteNuevo, rol: Rol.ADMINISTRADOR } as never);
    expect(u.rol).toBe(Rol.CLIENTE);
  });

  it('no guarda la contraseña en el perfil', async () => {
    const { caso } = nuevo();
    const u = await caso.ejecutar(clienteNuevo);
    expect(JSON.stringify(u.toJSON())).not.toContain('clave-segura-1');
  });

  it.each([[''], ['corta'], ['x'.repeat(73)], [undefined as never]])('rechaza contraseñas fuera de rango %#', async (contrasena) => {
    const { caso, identidad } = nuevo();
    await expect(caso.ejecutar({ ...clienteNuevo, contrasena })).rejects.toBeInstanceOf(ErrorDeValidacion);
    expect(identidad.registrados).toHaveLength(0);
  });

  it('rechaza datos de perfil inválidos antes de crear la identidad', async () => {
    const { caso, identidad } = nuevo();
    await expect(caso.ejecutar({ ...clienteNuevo, email: 'no-es-correo' })).rejects.toBeInstanceOf(ErrorDeValidacion);
    await expect(caso.ejecutar({ ...clienteNuevo, nombres: ' ' })).rejects.toBeInstanceOf(ErrorDeValidacion);
    expect(identidad.registrados).toHaveLength(0);
  });

  it('rechaza correos ya registrados sin distinguir mayúsculas', async () => {
    const { caso } = nuevo();
    await caso.ejecutar(clienteNuevo);
    await expect(caso.ejecutar({ ...clienteNuevo, email: 'ANA@correo.com' })).rejects.toBeInstanceOf(EmailYaRegistradoError);
  });

  it('propaga el error del proveedor sin guardar el perfil', async () => {
    const { repo, identidad, caso } = nuevo();
    identidad.falla = new IdentidadYaExisteError();
    await expect(caso.ejecutar(clienteNuevo)).rejects.toBeInstanceOf(IdentidadYaExisteError);
    expect(repo.datos.size).toBe(0);
  });

  it('elimina la identidad creada si falla el guardado del perfil', async () => {
    const { repo, identidad, caso } = nuevo();
    repo.guardar = async () => {
      throw new Error('bd caída');
    };
    await expect(caso.ejecutar(clienteNuevo)).rejects.toThrow('bd caída');
    expect(identidad.eliminados).toEqual(['00000000-0000-4000-9000-000000000001']);
  });
});

describe('RegistrarUsuario (alta por administrador)', () => {
  const nuevo = () => {
    const repo = new UsuariosEnMemoria();
    const identidad = new IdentidadFalsa();
    return { repo, identidad, caso: new RegistrarUsuario(repo, identidad) };
  };

  it('el administrador registra un comerciante e invita a su correo', async () => {
    const { repo, identidad, caso } = nuevo();
    const u = await caso.ejecutar({ ...datos, rol: Rol.COMERCIANTE }, admin);
    expect(u.rol).toBe(Rol.COMERCIANTE);
    expect(u.authId).not.toBeNull();
    expect(identidad.invitados).toEqual(['ana@correo.com']);
    expect(repo.datos.size).toBe(1);
  });

  it.each([[cliente], [{ id: cliente.id, rol: Rol.COMERCIANTE } as Actor]])('prohíbe registrar a quien no es administrador %#', async (actor) => {
    const { identidad, caso } = nuevo();
    await expect(caso.ejecutar(datos, actor)).rejects.toBeInstanceOf(ErrorProhibido);
    expect(identidad.invitados).toHaveLength(0);
  });

  it('rechaza correos duplicados y datos inválidos', async () => {
    const { caso } = nuevo();
    await caso.ejecutar(datos, admin);
    await expect(caso.ejecutar({ ...datos, email: 'ANA@correo.com' }, admin)).rejects.toBeInstanceOf(EmailYaRegistradoError);
    await expect(caso.ejecutar({ ...datos, email: 'otro' }, admin)).rejects.toBeInstanceOf(ErrorDeValidacion);
    await expect(caso.ejecutar({ ...datos, email: 'b@c.co', telefono: 'abc' }, admin)).rejects.toBeInstanceOf(ErrorDeValidacion);
    await expect(caso.ejecutar({ ...datos, email: 'd@c.co', rol: 'SUPERUSUARIO' as Rol }, admin)).rejects.toBeInstanceOf(ErrorDeValidacion);
  });

  it('compensa eliminando la identidad si falla el guardado', async () => {
    const { repo, identidad, caso } = nuevo();
    repo.guardar = async () => {
      throw new Error('bd caída');
    };
    await expect(caso.ejecutar(datos, admin)).rejects.toThrow('bd caída');
    expect(identidad.eliminados).toHaveLength(1);
  });
});

const sembrar = async () => {
  const repo = new UsuariosEnMemoria();
  const u = await new RegistrarUsuario(repo, new IdentidadFalsa()).ejecutar(datos, admin);
  return { repo, u };
};

describe('ConsultarUsuario', () => {
  it('permite consultar el propio perfil y al administrador consultar cualquiera', async () => {
    const { repo, u } = await sembrar();
    const caso = new ConsultarUsuario(repo);
    await expect(caso.ejecutar(u.id, { id: u.id, rol: Rol.CLIENTE })).resolves.toMatchObject({ id: u.id });
    await expect(caso.ejecutar(u.id, admin)).resolves.toMatchObject({ id: u.id });
  });

  it('prohíbe consultar a otro usuario sin ser administrador', async () => {
    const { repo, u } = await sembrar();
    await expect(new ConsultarUsuario(repo).ejecutar(u.id, cliente)).rejects.toBeInstanceOf(ErrorProhibido);
  });

  it('informa cuando el usuario no existe', async () => {
    await expect(new ConsultarUsuario(new UsuariosEnMemoria()).ejecutar(admin.id, admin)).rejects.toBeInstanceOf(UsuarioNoEncontradoError);
  });
});

describe('ListarUsuarios', () => {
  it('solo el administrador puede listar', async () => {
    const { repo } = await sembrar();
    await expect(new ListarUsuarios(repo).ejecutar(cliente)).rejects.toBeInstanceOf(ErrorProhibido);
    await expect(new ListarUsuarios(repo).ejecutar(admin)).resolves.toHaveLength(1);
  });

  it('valida la paginación', async () => {
    const caso = new ListarUsuarios(new UsuariosEnMemoria());
    await expect(caso.ejecutar(admin, { limite: 0 })).rejects.toBeInstanceOf(ErrorDeValidacion);
    await expect(caso.ejecutar(admin, { limite: 101 })).rejects.toBeInstanceOf(ErrorDeValidacion);
    await expect(caso.ejecutar(admin, { desplazamiento: -1 })).rejects.toBeInstanceOf(ErrorDeValidacion);
  });
});

describe('API interna de usuarios', () => {
  it('ObtenerResumenUsuario devuelve solo id, rol y estado, o null', async () => {
    const { repo, u } = await sembrar();
    const caso = new ObtenerResumenUsuario(repo);
    await expect(caso.ejecutar(u.id)).resolves.toEqual({ id: u.id, rol: Rol.CLIENTE, activo: true });
    await expect(caso.ejecutar(admin.id)).resolves.toBeNull();
  });

  it('ResolverUsuarioPorAuthId resuelve rol y estado desde el repositorio', async () => {
    const { repo, u } = await sembrar();
    const caso = new ResolverUsuarioPorAuthId(repo);
    await expect(caso.ejecutar(u.authId!)).resolves.toEqual({ id: u.id, rol: Rol.CLIENTE, activo: true });
    await expect(caso.ejecutar('00000000-0000-4000-9000-0000000000ff')).resolves.toBeNull();
  });
});
