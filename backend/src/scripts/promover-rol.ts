/**
 * Operación de administración con acceso a la base (no es un endpoint): cambia el rol de un usuario existente.
 * Uso:  npm run build && npm run usuarios:promover -- correo@dominio.com ADMINISTRADOR
 * Es la forma de crear el primer administrador: la persona se registra primero como cliente.
 */
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, type RolUsuario } from '../generated/prisma/client.js';

const ROLES: RolUsuario[] = ['CLIENTE', 'COMERCIANTE', 'TRABAJADOR_PUESTO', 'ADMINISTRADOR'];
const [email, rol] = process.argv.slice(2);
if (!email || !ROLES.includes(rol as RolUsuario)) {
  console.error(`Uso: usuarios:promover -- <correo> <${ROLES.join('|')}>`);
  process.exit(1);
}
const url = process.env['DATABASE_URL'];
if (!url) {
  console.error('DATABASE_URL no definida.');
  process.exit(1);
}
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url, max: 1 }) });
try {
  const r = await prisma.usuario.updateMany({ where: { email: email.trim().toLowerCase() }, data: { rol: rol as RolUsuario } });
  console.log(r.count === 1 ? `Rol actualizado a ${rol}.` : 'No existe un usuario con ese correo.');
  process.exitCode = r.count === 1 ? 0 : 1;
} finally {
  await prisma.$disconnect();
}
