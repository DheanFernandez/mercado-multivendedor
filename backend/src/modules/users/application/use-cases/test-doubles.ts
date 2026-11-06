/** Dobles de prueba en memoria (solo para pruebas; no se importan desde código de producción). */
import { EmailYaRegistradoError } from '../../domain/errors.js';
import { Usuario } from '../../domain/usuario.entity.js';
import type { ProveedorIdentidad } from '../ports/proveedor-identidad.port.js';
import type { UsuarioRepository } from '../ports/usuario.repository.js';

export class UsuariosEnMemoria implements UsuarioRepository {
  readonly datos = new Map<string, Usuario>();
  async guardar(u: Usuario) {
    if ([...this.datos.values()].some((x) => x.id !== u.id && (x.email === u.email || (u.authId && x.authId === u.authId)))) throw new EmailYaRegistradoError();
    this.datos.set(u.id, Usuario.reconstruir(u.toJSON())); // copia, como una base real
  }
  async buscarPorId(id: string) { const u = this.datos.get(id); return u ? Usuario.reconstruir(u.toJSON()) : null; }
  async buscarPorEmail(email: string) { const u = [...this.datos.values()].find((x) => x.email === email); return u ? Usuario.reconstruir(u.toJSON()) : null; }
  async buscarPorAuthId(authId: string) { const u = [...this.datos.values()].find((x) => x.authId === authId); return u ? Usuario.reconstruir(u.toJSON()) : null; }
  async listar({ limite, desplazamiento }: { limite: number; desplazamiento: number }) {
    return [...this.datos.values()].slice(desplazamiento, desplazamiento + limite);
  }
}

export class IdentidadFalsa implements ProveedorIdentidad {
  registrados: string[] = [];
  invitados: string[] = [];
  eliminados: string[] = [];
  falla?: Error;
  private n = 0;
  private nuevo() { return `00000000-0000-4000-9000-${String(++this.n).padStart(12, '0')}`; }
  async registrar(email: string, _contrasena: string) {
    if (this.falla) throw this.falla;
    this.registrados.push(email);
    return { authId: this.nuevo() };
  }
  async invitar(email: string) {
    if (this.falla) throw this.falla;
    this.invitados.push(email);
    return { authId: this.nuevo() };
  }
  async eliminar(authId: string) { this.eliminados.push(authId); }
}
