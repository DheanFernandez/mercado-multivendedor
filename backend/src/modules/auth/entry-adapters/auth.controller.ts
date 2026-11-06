import { Body, Controller, Get, Inject, Post } from '@nestjs/common';
import type { Actor } from '../../../shared/domain/actor.js';
import { ActorRequerido, Public } from '../../../shared/http/actor.js';
import { ConsultarUsuario } from '../../users/application/use-cases/consultar-usuario.use-case.js';
import { RegistrarCliente } from '../../users/application/use-cases/registrar-cliente.use-case.js';
import { vistaUsuario } from '../../users/entry-adapters/controllers/usuarios.controller.js';

interface RegistroDto {
  email: string;
  contrasena: string;
  nombres: string;
  apellidos: string;
  telefono?: string;
}

/** Inicio/cierre de sesión y recuperación de contraseña los resuelve el cliente directamente con Supabase Auth. */
@Controller('api/v1/auth')
export class AuthController {
  constructor(
    @Inject(RegistrarCliente) private readonly registrarCliente: RegistrarCliente,
    @Inject(ConsultarUsuario) private readonly consultarUsuario: ConsultarUsuario,
  ) {}

  /** Autorregistro: SOLO crea clientes. Cualquier campo `rol` del cuerpo se ignora. */
  @Public()
  @Post('registro')
  async registro(@Body() cuerpo: RegistroDto) {
    const { email, contrasena, nombres, apellidos, telefono } = cuerpo ?? ({} as RegistroDto);
    return vistaUsuario(await this.registrarCliente.ejecutar({ email, contrasena, nombres, apellidos, telefono }));
  }

  /** Perfil y rol del usuario autenticado, leídos de PostgreSQL. */
  @Get('me')
  async me(@ActorRequerido() actor: Actor) {
    return vistaUsuario(await this.consultarUsuario.ejecutar(actor.id, actor));
  }
}
