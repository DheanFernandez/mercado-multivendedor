# AC05 · Reglas de arquitectura sobre `origin/main` · 2026-11-16

**Resultado: 0 violaciones** (106 módulos, 365 dependencias). Las cuatro reglas de [`backend/.dependency-cruiser.cjs`](../../../../../backend/.dependency-cruiser.cjs) tienen severidad `error`:

- límites entre módulos solo por `index.ts` o `*.module.ts`;
- `domain/` y `application/` sin NestJS, Prisma, `pg` ni `jose`;
- SDK de Mercado Pago solo en su adaptador;
- sin ciclos.

| Campo | Valor |
|---|---|
| Commit evaluado | `1aab5522cd646b36051af61ec41460f031b4cbaf` (`origin/main`, publicado). El directorio `backend/` no tenía cambios respecto a ese commit |
| Fecha | 2026-11-16 16:36 (-05:00) |
| Entorno | Worktree limpio `docs/sprint-02-arquitectura-calidad` creado desde `origin/main`; dependencias instaladas con `npm ci` desde el `package-lock.json` de ese commit; cliente de Prisma generado sin conexión a base de datos. Intel Core i5-4590, 15,9 GB de RAM, Windows 11 Pro, Node v24.19.0 |
| Herramienta | dependency-cruiser 18.7.2 |
| Comando (desde `backend/`) | `npx depcruise src --config .dependency-cruiser.cjs` |
| Resultado | `✔ no dependency violations found (106 modules, 365 dependencies cruised)`, código de salida 0 ([salida](salida-depcruise.txt)) |

Esta medición **sustituye, para `main`,** a la del mismo día sobre la rama local (`../AC05-arquitectura/`, 133 módulos), que incluía código de Pedidos no publicado.

## Limitaciones

1. dependency-cruiser comprueba importaciones, no el acceso a tablas. El catálogo de `main` sigue consultando con Prisma el modelo `producto`, con sus relaciones `categoria` y `puesto` (hallazgo C-05).
2. La regla del SDK de Mercado Pago se cumple porque el SDK no está instalado: el módulo `payments` está vacío.
3. Es evidencia estructural de AC05; **no** equivale al escenario EQ-07 (intercambio del adaptador de pago), que sigue sin poder medirse.
