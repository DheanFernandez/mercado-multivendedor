# Base PostgreSQL local y aislada para pruebas y mediciones

Contenedor **`mercado-test-db`** (PostgreSQL 17 Alpine), solo en `127.0.0.1:55433`, base `mercado_test`, proyecto Docker `mercado-test` con red y volumen propios. No usa ni modifica otros contenedores (por ejemplo `apofoods-db-1`, puerto 55432). Credenciales de desarrollo locales (`postgres` / `test`); nada de Supabase.

> **Seguridad:** las pruebas de base de datos, el seed y las mediciones pasan por una guarda (`backend/scripts/base-aislada.mjs`) que **aborta** si la URL apunta a Supabase, Neon, cualquier servidor remoto, otro puerto u otra base. Se configura con `TEST_DATABASE_URL` (opcional); `DATABASE_URL` del `.env` **nunca** se usa para estas tareas.

## Comandos (desde `backend/`)

| Comando | Qué hace |
|---|---|
| `npm run db:test:up` | Valida el compose, inicia **solo** `mercado-test-db` y espera a que esté saludable |
| `npm run db:test:ping` | Conexión desde el backend (`pg`): imprime base, usuario y versión |
| `npm run db:test:migrate` | `prisma generate` + `prisma migrate deploy` en la base local (nunca `migrate reset`) |
| `npm run db:test:status` | Estado de las migraciones |
| `npm run test:db` | Levanta la base si hace falta, migra y ejecuta las pruebas de integración (`*.db-spec.ts`) |
| `npm run seed:medicion -- …` | Datos representativos para mediciones (requiere `npm run build`) |
| `npm run arquitectura` | Reglas de `dependency-cruiser` (EQ-07, AC05) |
| `npm run db:test:stop` | Detiene el contenedor y **conserva** los datos |
| `npm run db:test:down` | Elimina **solo** `mercado-test-db`, su red y su volumen `mercado_test_pgdata` |

Equivalentes directos: `docker compose -f ops/medicion/docker-compose.yml up -d --wait | stop | down -v`.

Nota: un contenedor detenido llamado `marketplace-db` tiene configurado también el puerto 55433. No pueden estar iniciados a la vez.

## Mediciones (EQ-04 con k6)

Con la base iniciada, migrada y sembrada, y el backend en el puerto 3100 usando esa base:

```powershell
cd backend; npm run build; npm run seed:medicion -- --comerciantes 50 --puestos-por-comerciante 2 --productos-por-puesto 50 --categorias 20
$env:DATABASE_URL='postgresql://postgres:test@127.0.0.1:55433/mercado_test'; $env:DIRECT_URL=$env:DATABASE_URL
$env:PORT='3100'; $env:SUPABASE_URL='http://localhost:54321'; $env:NODE_ENV='production'; node dist/main    # otra terminal desde la raíz:
docker run --rm -v "${PWD}\docs\05-implementacion\evidencias\EQ-04\<fecha>:/resultados" -v "${PWD}\ops\k6:/scripts" `
  -e BASE_URL=http://host.docker.internal:3100 -e VUS=100 -e DURACION=2m -e PENSAR=1 grafana/k6 run /scripts/catalogo.js
```

## Mediciones (EQ-03 · concurrencia de inventario)

```powershell
cd backend
$env:EVIDENCIA_DIR="..\docs\05-implementacion\evidencias\EQ-03\<fecha>"; npm run test:db -- test/eq03-concurrencia.db-spec.ts   # Vitest: 400 iteraciones (≈ 80 s)
npm run build; node dist/scripts/servidor-eq03.js                                  # arnés sobre la base local (puerto 3101); otra terminal, desde la raíz:
docker run --rm -i -v "${PWD}\docs\05-implementacion\evidencias\EQ-03\<fecha>:/resultados" -e BASE_URL=http://host.docker.internal:3101 -e VUS=200 -e DURACION=1m -e STOCK=10 grafana/k6 run - < ops/k6/eq03-reserva.js
Invoke-RestMethod -Method Post http://127.0.0.1:3101/eq03/limpiar                  # borra los datos del arnés
```

## Herramientas listas para los demás escenarios

| Escenario | Preparado |
|---|---|
| EQ-01, 06, 07, 08 | `msw` y `pino` instalados en el backend; Vitest + Supertest |
| EQ-02 | Esta base desechable (el reinicio completo es `db:test:down` + `db:test:up`); **no se usa Testcontainers**, que la documentación nombra para lo mismo |
| EQ-05, AC09 | `@playwright/test` y Chromium instalados |
| EQ-07 | `dependency-cruiser` configurado; CI en `.github/workflows/ci.yml` (con servicio PostgreSQL en el mismo puerto; **no ejecutado todavía**) |
| EQ-03, EQ-04 | k6 por Docker (`grafana/k6`); EQ-03 medido (ver arriba) |
| Pendiente de instalar | Toxiproxy (MSW lo sustituye según la documentación), Lighthouse y OWASP ZAP (se ejecutan bajo demanda con `npx` o Docker) |
