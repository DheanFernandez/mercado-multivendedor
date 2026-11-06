/**
 * Aplicación completa (guard global, controladores, casos de uso, filtro de errores) con repositorios en memoria y un
 * verificador de tokens simulado. No toca PostgreSQL ni Supabase. Compartido por las pruebas HTTP nuevas.
 */
import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AppModule } from '../../src/app.module.js';
import { VERIFICADOR_TOKEN, type VerificadorToken } from '../../src/modules/auth/application/ports/ports.js';
import { CATALOGO_REPOSITORY } from '../../src/modules/catalog/application/ports/catalogo.repository.js';
import { COMERCIANTE_REPOSITORY, PUESTO_REPOSITORY } from '../../src/modules/merchants/application/ports/ports.js';
import { Comerciante } from '../../src/modules/merchants/domain/comerciante.entity.js';
import { CodigoPuestoDuplicadoError, ComercianteYaRegistradoError } from '../../src/modules/merchants/domain/errors.js';
import { Puesto } from '../../src/modules/merchants/domain/puesto.entity.js';
import { CATEGORIA_REPOSITORY, PRODUCTO_REPOSITORY } from '../../src/modules/products/application/ports/ports.js';
import { AlmacenEnMemoria, CategoriasEnMemoria, ProductosEnMemoria } from '../../src/modules/products/application/use-cases/test-doubles.js';
import { Categoria } from '../../src/modules/products/domain/categoria.entity.js';
import { Producto } from '../../src/modules/products/domain/producto.entity.js';
import { CARRITO_REPOSITORY } from '../../src/modules/cart/application/ports/ports.js';
import { CarritoEnMemoria } from '../../src/modules/cart/application/use-cases/test-doubles.js';
import { INVENTARIO_REPOSITORY } from '../../src/modules/inventory/application/ports/ports.js';
import { InventarioEnMemoria } from '../../src/modules/inventory/application/use-cases/test-doubles.js';
import { PROVEEDOR_IDENTIDAD } from '../../src/modules/users/application/ports/proveedor-identidad.port.js';
import { USUARIO_REPOSITORY } from '../../src/modules/users/application/ports/usuario.repository.js';
import { IdentidadFalsa, UsuariosEnMemoria } from '../../src/modules/users/application/use-cases/test-doubles.js';
import { Usuario } from '../../src/modules/users/domain/usuario.entity.js';
import { ALMACEN_ARCHIVOS } from '../../src/shared/application/ports/almacen-archivos.port.js';
import type { Rol } from '../../src/shared/domain/actor.js';
import { ErrorNoAutenticado } from '../../src/shared/domain/errors.js';
import { PrismaService } from '../../src/shared/infrastructure/prisma/prisma.service.js';

export const uid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
export const authIdDe = (n: number) => `aaaaaaaa-0000-4000-8000-${String(n).padStart(12, '0')}`;
export const bearer = (n: number) => ({ Authorization: `Bearer tok:${authIdDe(n)}` });

const verificador: VerificadorToken = {
  async verificar(t) {
    const m = /^tok:([0-9a-f-]{36})$/.exec(t);
    if (!m) throw new ErrorNoAutenticado('Sesión inválida o expirada.');
    return { authId: m[1] };
  },
};

/** Números de los usuarios sembrados. */
export const U = { ADMIN: 1, CLIENTE: 2, TRABAJADOR: 3, COM_A: 4, COM_B: 5, OBJETIVO: 6 } as const;

export async function crearAppEnMemoria() {
  const usuarios = new UsuariosEnMemoria();
  const comerciantes: Comerciante[] = [];
  const puestos: Puesto[] = [];
  const categorias = new CategoriasEnMemoria();
  const productos = new ProductosEnMemoria();
  const inventario = new InventarioEnMemoria();
  const carritos = new CarritoEnMemoria();
  const sembrar = (n: number, rol: Rol, estado: 'ACTIVO' | 'INACTIVO' = 'ACTIVO') =>
    usuarios.datos.set(uid(n), Usuario.reconstruir({ id: uid(n), email: `u${n}@t.co`, nombres: 'N', apellidos: 'A', telefono: null, rol, estado, authId: authIdDe(n), creadoEn: new Date() }));
  sembrar(U.ADMIN, 'ADMINISTRADOR');
  sembrar(U.CLIENTE, 'CLIENTE');
  sembrar(U.TRABAJADOR, 'TRABAJADOR_PUESTO');
  sembrar(U.COM_A, 'COMERCIANTE');
  sembrar(U.COM_B, 'COMERCIANTE');
  sembrar(U.OBJETIVO, 'CLIENTE'); // usuario sobre el que se prueban las operaciones de administración

  const A = Comerciante.crear({ id: uid(201), usuarioId: uid(U.COM_A), nombreComercial: 'Comercio A' });
  const B = Comerciante.crear({ id: uid(202), usuarioId: uid(U.COM_B), nombreComercial: 'Comercio B' });
  comerciantes.push(A, B);
  puestos.push(
    Puesto.crear({ id: uid(301), comercianteId: A.id, codigo: 'A-1', nombre: 'Puesto A' }),
    Puesto.crear({ id: uid(302), comercianteId: B.id, codigo: 'B-1', nombre: 'Puesto B' }),
  );
  const categoria = Categoria.crear({ id: uid(401), nombre: 'Frutas' });
  await categorias.guardar(categoria);
  const producto = Producto.crear({ id: uid(501), puestoId: uid(301), categoriaId: categoria.id, nombre: 'Mango', precio: '6.50', unidadVenta: 'KILOGRAMO' });
  producto.agregarImagen({ id: uid(601), ruta: `${producto.id}/${uid(601)}.png` });
  await productos.guardar(producto);

  const modulo = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(PrismaService).useValue({})
    .overrideProvider(USUARIO_REPOSITORY).useValue(usuarios)
    .overrideProvider(PROVEEDOR_IDENTIDAD).useValue(new IdentidadFalsa())
    .overrideProvider(VERIFICADOR_TOKEN).useValue(verificador)
    .overrideProvider(COMERCIANTE_REPOSITORY).useValue({
      async buscarPorId(id: string) { const c = comerciantes.find((x) => x.id === id); return c ? Comerciante.reconstruir(c.toJSON()) : null; },
      async buscarPorUsuarioId(u: string) { const c = comerciantes.find((x) => x.usuarioId === u); return c ? Comerciante.reconstruir(c.toJSON()) : null; },
      async guardar(c: Comerciante) {
        const i = comerciantes.findIndex((x) => x.id === c.id);
        if (i >= 0) { comerciantes[i] = c; return; }
        if (comerciantes.some((x) => x.usuarioId === c.usuarioId)) throw new ComercianteYaRegistradoError();
        comerciantes.push(c);
      },
      async listar({ limite, desplazamiento }: { limite: number; desplazamiento: number }) { return comerciantes.slice(desplazamiento, desplazamiento + limite); },
    })
    .overrideProvider(PUESTO_REPOSITORY).useValue({
      async buscarPorId(id: string) { const p = puestos.find((x) => x.id === id); return p ? Puesto.reconstruir(p.toJSON()) : null; },
      async guardar(p: Puesto) {
        if (puestos.some((x) => x.id !== p.id && x.codigo === p.codigo)) throw new CodigoPuestoDuplicadoError();
        const i = puestos.findIndex((x) => x.id === p.id);
        if (i >= 0) puestos[i] = p; else puestos.push(p);
      },
      async listarOperativos({ limite, desplazamiento }: { limite: number; desplazamiento: number }) {
        return puestos.filter((p) => p.estado === 'ACTIVO' && comerciantes.find((c) => c.id === p.comercianteId)?.activo).slice(desplazamiento, desplazamiento + limite);
      },
      async listar({ comercianteId, limite, desplazamiento }: { comercianteId?: string; limite: number; desplazamiento: number }) {
        return puestos.filter((p) => !comercianteId || p.comercianteId === comercianteId).slice(desplazamiento, desplazamiento + limite);
      },
    })
    .overrideProvider(CATEGORIA_REPOSITORY).useValue(categorias)
    .overrideProvider(PRODUCTO_REPOSITORY).useValue(productos)
    .overrideProvider(INVENTARIO_REPOSITORY).useValue(inventario)
    .overrideProvider(CARRITO_REPOSITORY).useValue(carritos)
    .overrideProvider(CATALOGO_REPOSITORY).useValue({
      async buscar() { return { items: [], total: 0 }; },
      /** Mismas reglas de visibilidad que el catálogo real: publicado, categoría activa, puesto y comerciante activos. */
      async detalle(id: string) {
        const p = productos.datos.get(id);
        const cat = p && categorias.datos.get(p.categoriaId);
        const pu = p && puestos.find((x) => x.id === p.puestoId);
        const co = pu && comerciantes.find((x) => x.id === pu.comercianteId);
        if (!p || p.estado !== 'PUBLICADO' || !cat?.activa || pu?.estado !== 'ACTIVO' || !co?.activo) return null;
        return {
          id: p.id, nombre: p.nombre, descripcion: p.descripcion, precio: p.precio.toString(), unidadVenta: p.unidadVenta, presentacion: p.presentacion,
          categoria: { id: cat.id, nombre: cat.nombre, slug: cat.slug }, puesto: { id: pu.id, codigo: pu.codigo, nombre: pu.nombre }, imagenes: [],
        };
      },
    })
    .overrideProvider(ALMACEN_ARCHIVOS).useValue(new AlmacenEnMemoria())
    .compile();
  const app: INestApplication = modulo.createNestApplication();
  await app.init();
  return { app, usuarios, comerciantes, puestos, categorias, productos, inventario, carritos, ids: { comercianteA: A.id, comercianteB: B.id, puestoA: uid(301), puestoB: uid(302), categoria: categoria.id, producto: producto.id, imagen: uid(601) } };
}
