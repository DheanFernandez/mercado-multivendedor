/** Dobles de prueba en memoria (solo para pruebas; no se importan desde código de producción). */
import { EmailYaRegistradoError } from '../../domain/errors.js';
import type { Usuario } from '../../domain/usuario.entity.js';
import type { ProveedorIdentidad } from '../ports/proveedor-identidad.port.js';
import type { UsuarioRepository } from '../ports/usuario.repository.js';

export class UsuariosEnMemoria implements UsuarioRepository {
  readonly datos = new Map<string, Usuario>();
  async guardar(u: Usuario) {
    if ([...this.datos.values()].some((x) => x.email === u.email || (u.authId && x.authId === u.authId))) throw new EmailYaRegistradoError();
    this.datos.set(u.id, u);
  }
  async buscarPorId(id: string) { return this.datos.get(id) ?? null; }
  async buscarPorEmail(email: string) { return [...this.datos.values()].find((u) => u.email === email) ?? null; }
  async buscarPorAuthId(authId: string) { return [...this.datos.values()].find((u) => u.authId === authId) ?? null; }
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
