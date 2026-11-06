# EQ-04 · Rendimiento de la consulta del catálogo (AC01)

**Veredicto: CUMPLE** el umbral documentado, medido en un entorno local aislado (ver limitaciones).

| Elemento | Valor |
|---|---|
| Escenario y umbral (copiados de `08-escenarios-atributos-calidad.md`) | «Con 100 usuarios concurrentes, al menos el 95 % de las consultas del catálogo responde en menos de 2 segundos» (propuesta por validar) → `p(95) < 2000 ms` |
| Parámetro adicional de la prueba | Tasa de errores < 1 % (la documentación pide medirla pero no fija el valor) |
| Fecha | 2026-11-05 |
| Herramienta | k6 v2.3.0 (imagen `grafana/k6`) |

## Resultado principal (100 usuarios virtuales, 2 minutos, espera ≈ 1 s entre consultas)

| Métrica | Obtenido | Umbral | Resultado |
|---|---|---|---|
| p95 del tiempo de respuesta | **381,4 ms** | < 2 000 ms | ✔ |
| Mediana / media | 40,9 ms / 102,2 ms | — | — |
| p90 / p99 / máximo | 274,1 / 746,9 / 1 143,1 ms | — | — |
| Solicitudes totales | 10 886 (≈ 89,6 por segundo) | — | — |
| Solicitudes fallidas | 0 (0 %) | < 1 % | ✔ |
| Comprobaciones (HTTP 200) | 10 883 de 10 883 | > 99 % | ✔ |
| Usuarios virtuales | 100 | 100 | ✔ |

## Prueba complementaria de esfuerzo máximo (no es el criterio documentado)

100 usuarios virtuales **sin tiempo de espera**, 1 minuto: 7 382 solicitudes (≈ 120,7 por segundo), **p95 = 1 043 ms**, p99 = 1 278 ms, máximo 1 636 ms, 0 errores. El umbral p95 < 2 000 ms también se cumple, con menos margen.

## Mezcla de consultas

40 % listado paginado, 20 % búsqueda por texto, 20 % filtros combinados (categoría, puesto, precio y orden) y 20 % detalle de producto, sobre 5 000 productos publicados.

## Datos de prueba (seed reproducible)

50 comerciantes, 100 puestos, 20 categorías y 5 000 productos publicados (`npm run seed:medicion`, `faker.seed(20261105)`). Los tamaños son **parámetros de la prueba**: la documentación no los fija.

## Cómo reproducirlo

Ver [`ops/medicion/README.md`](../../../../../ops/medicion/README.md). Resumen: levantar PostgreSQL aislado con Docker, migrar, sembrar, iniciar el backend en el puerto 3100 y ejecutar `ops/k6/catalogo.js` con k6.

## Archivos

- `entorno.txt`: equipo, versiones, base de datos y limitaciones.
- `primaria/resumen.json` y `primaria/salida-k6.txt`: resultado completo del criterio documentado.
- `esfuerzo-maximo/resumen.json`: prueba complementaria.

## Limitaciones (obligatorio al citar este resultado)

1. Backend, PostgreSQL y generador de carga corrieron **en la misma máquina**; no incluye latencia de red ni la capacidad de Supabase o del hosting de producción.
2. La base fue PostgreSQL 16 local en memoria (tmpfs), no Supabase.
3. El backend corrió con el pool de conexiones por defecto (10) y sin caché.
4. **Lighthouse** (complemento de la interfaz) **no se ejecutó**.
5. La medición debe repetirse en el entorno de despliegue final (RC20) antes de la presentación definitiva.
