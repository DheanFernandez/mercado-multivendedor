import { describe, expect, it } from 'vitest';
import { Rol } from '../../../../shared/domain/actor.js';
import { ErrorNoAutenticado, ErrorProhibido } from '../../../../shared/domain/errors.js';
import type { UsuarioPorAuthIdPort, VerificadorToken } from '../ports/ports.js';
import { AutenticarSolicitud } from './autenticar-solicitud.use-case.js';

const AUTH_ID = '11111111-1111-4111-8111-111111111111';
const verificadorOk: VerificadorToken = { verificar: async () => ({ authId: AUTH_ID }) };
const verificadorMalo: VerificadorToken = { verificar: async () => { throw new ErrorNoAutenticado('Sesión inválida o expirada.'); } };
const usuarios = (u: Awaited<ReturnType<UsuarioPorAuthIdPort['buscar']>>): UsuarioPorAuthIdPort => ({ buscar: async (id) => (id === AUTH_ID ? u : null) });

describe('AutenticarSolicitud', () => {
  it('devuelve el actor con el rol leído de la base de datos', async () => {
    const caso = new AutenticarSolicitud(verificadorOk, usuarios({ id: 'u-1', rol: Rol.COMERCIANTE, activo: true }));
    await expect(caso.ejecutar('token')).resolves.toEqual({ id: 'u-1', rol: Rol.COMERCIANTE });
  });

  it('no toma el rol de ningún dato del token: cambia si cambia la base de datos', async () => {
    const caso = new AutenticarSolicitud(verificadorOk, usuarios({ id: 'u-1', rol: Rol.CLIENTE, activo: true }));
    await expect(caso.ejecutar('token-que-dice-ser-admin')).resolves.toEqual({ id: 'u-1', rol: Rol.CLIENTE });
  });

  it('rechaza un token inválido', async () => {
    const caso = new AutenticarSolicitud(verificadorMalo, usuarios({ id: 'u-1', rol: Rol.CLIENTE, activo: true }));
    await expect(caso.ejecutar('x')).rejects.toBeInstanceOf(ErrorNoAutenticado);
  });

  it('rechaza una identidad sin perfil vinculado', async () => {
    const caso = new AutenticarSolicitud(verificadorOk, usuarios(null));
    await expect(caso.ejecutar('x')).rejects.toBeInstanceOf(ErrorProhibido);
  });

  it('rechaza una cuenta desactivada', async () => {
    const caso = new AutenticarSolicitud(verificadorOk, usuarios({ id: 'u-1', rol: Rol.CLIENTE, activo: false }));
    await expect(caso.ejecutar('x')).rejects.toBeInstanceOf(ErrorProhibido);
  });
});
