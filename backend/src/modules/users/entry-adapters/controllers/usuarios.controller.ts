import { Body, Controller, Get, Inject, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import type { Actor } from '../../../../shared/domain/actor.js';
import { ActorRequerido } from '../../../../shared/http/actor.js';
import { ConsultarUsuario } from '../../application/use-cases/consultar-usuario.use-case.js';
import { ListarUsuarios } from '../../application/use-cases/listar-usuarios.use-case.js';
import { RegistrarUsuario, type RegistrarUsuarioComando } from '../../application/use-cases/registrar-usuario.use-case.js';
import type { Usuario } from '../../domain/usuario.entity.js';

/** El authId es interno: no se expone en las respuestas. */
export const vistaUsuario = (u: Usuario) => {
  const { authId: _authId, ...publico } = u.toJSON();
  return publico;
};

/**
 * Adaptador de entrada: solo traduce HTTP ↔ casos de uso. Sin reglas de negocio.
 * Todas las rutas exigen sesión (guard global); la autorización por rol vive en los casos de uso.
 */
@Controller('api/v1/usuarios')
export class UsuariosController {
  constructor(
    @Inject(RegistrarUsuario) private readonly registrar: RegistrarUsuario,
    @Inject(ConsultarUsuario) private readonly consultar: ConsultarUsuario,
    @Inject(ListarUsuarios) private readonly listar: ListarUsuarios,
  ) {}

  /** Alta por un administrador (cualquier rol); envía una invitación para definir la contraseña. */
  @Post()
  async registrarUsuario(@Body() cuerpo: RegistrarUsuarioComando, @ActorRequerido() actor: Actor) {
    const { email, nombres, apellidos, telefono, rol } = cuerpo ?? ({} as RegistrarUsuarioComando);
    return vistaUsuario(await this.registrar.ejecutar({ email, nombres, apellidos, telefono, rol }, actor));
  }

  @Get()
  async listarUsuarios(@ActorRequerido() actor: Actor, @Query('limite') limite?: string, @Query('desplazamiento') desplazamiento?: string) {
    const usuarios = await this.listar.ejecutar(actor, {
      limite: limite === undefined ? undefined : Number(limite),
      desplazamiento: desplazamiento === undefined ? undefined : Number(desplazamiento),
    });
    return usuarios.map(vistaUsuario);
  }

  @Get(':id')
  async consultarUsuario(@Param('id', new ParseUUIDPipe()) id: string, @ActorRequerido() actor: Actor) {
    return vistaUsuario(await this.consultar.ejecutar(id, actor));
  }
}
