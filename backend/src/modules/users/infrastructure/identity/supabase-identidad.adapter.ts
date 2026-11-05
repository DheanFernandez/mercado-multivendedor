import { Inject, Injectable, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ErrorDeValidacion, ErrorServicioNoDisponible } from '../../../../shared/domain/errors.js';
import type { ProveedorIdentidad } from '../../application/ports/proveedor-identidad.port.js';
import { IdentidadYaExisteError } from '../../domain/errors.js';

type Fetch = typeof fetch;
export const HTTP_FETCH = Symbol('HTTP_FETCH');
interface Respuesta { id?: string; user?: { id?: string; identities?: unknown[] }; identities?: unknown[]; error_code?: string; msg?: string; message?: string }

/** Adaptador de Supabase Auth (API REST). Las claves se leen del entorno y nunca se registran en logs. */
@Injectable()
export class SupabaseIdentidadAdapter implements ProveedorIdentidad {
  private readonly http: Fetch;

  constructor(
    @Inject(ConfigService) private readonly config: ConfigService,
    @Optional() @Inject(HTTP_FETCH) http?: Fetch,
  ) {
    this.http = http ?? fetch;
  }

  private requerir(nombre: string): string {
    const valor = this.config.get<string>(nombre);
    if (!valor) throw new ErrorServicioNoDisponible('El servicio de autenticación no está configurado.');
    return valor;
  }

  private async llamar(metodo: string, ruta: string, clave: string, cuerpo?: unknown): Promise<Respuesta> {
    const base = this.requerir('SUPABASE_URL').replace(/\/+$/, '');
    const cabeceras: Record<string, string> = { apikey: clave, 'Content-Type': 'application/json' };
    if (clave.startsWith('eyJ')) cabeceras['Authorization'] = `Bearer ${clave}`; // claves JWT legacy
    let res: Response;
    try {
      res = await this.http(`${base}${ruta}`, {
        method: metodo,
        headers: cabeceras,
        body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
        signal: AbortSignal.timeout(10_000),
      });
    } catch {
      throw new ErrorServicioNoDisponible('No se pudo contactar al servicio de autenticación.');
    }
    const datos = ((await res.json().catch(() => ({}))) ?? {}) as Respuesta;
    if (res.ok) return datos;
    const codigo = datos.error_code ?? '';
    if (codigo === 'user_already_exists' || codigo === 'email_exists') throw new IdentidadYaExisteError();
    if (codigo === 'weak_password' || res.status === 422 || res.status === 400) {
      throw new ErrorDeValidacion(datos.msg ?? datos.message ?? 'Los datos de acceso no son válidos.');
    }
    throw new ErrorServicioNoDisponible('El servicio de autenticación no pudo completar la operación.');
  }

  private redirect(): string {
    const frontend = this.config.get<string>('FRONTEND_URL');
    return frontend ? `?redirect_to=${encodeURIComponent(`${frontend.replace(/\/+$/, '')}/auth/callback`)}` : '';
  }

  async registrar(email: string, contrasena: string): Promise<{ authId: string }> {
    const r = await this.llamar('POST', `/auth/v1/signup${this.redirect()}`, this.requerir('SUPABASE_ANON_KEY'), { email, password: contrasena });
    const usuario = r.user ?? r;
    const identidades = (usuario as { identities?: unknown[] }).identities;
    // Con confirmación por correo activa, un correo ya existente devuelve un usuario "ofuscado" sin identidades.
    if (Array.isArray(identidades) && identidades.length === 0) throw new IdentidadYaExisteError();
    if (!usuario.id) throw new ErrorServicioNoDisponible('Respuesta inesperada del servicio de autenticación.');
    return { authId: usuario.id };
  }

  async invitar(email: string): Promise<{ authId: string }> {
    const r = await this.llamar('POST', `/auth/v1/invite${this.redirect()}`, this.requerir('SUPABASE_SERVICE_ROLE_KEY'), { email });
    if (!r.id) throw new ErrorServicioNoDisponible('Respuesta inesperada del servicio de autenticación.');
    return { authId: r.id };
  }

  async eliminar(authId: string): Promise<void> {
    await this.llamar('DELETE', `/auth/v1/admin/users/${encodeURIComponent(authId)}`, this.requerir('SUPABASE_SERVICE_ROLE_KEY'));
  }
}
