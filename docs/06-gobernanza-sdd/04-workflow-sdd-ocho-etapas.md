# Workflow SDD de ocho etapas

> **Estado: PROPUESTA (DEC-08, `PENDIENTE`).** El workflow está en [workflows/mercado-sdd.yml](workflows/mercado-sdd.yml). **No se ha ejecutado, no está instalado en Spec Kit y el workflow original (`.specify/workflows/speckit/workflow.yml`) no se modificó.**

## 1. Por qué un archivo separado

El flujo incluido en Spec Kit (`speckit` 1.0.0) ejecuta seis pasos: especificar → revisión → planificar → revisión → tareas → implementar. No tiene **Aclarar**, **Analizar**, **Probar** ni **Revisar**, que la constitución exige. Como `.specify/workflows/speckit/` es un archivo generado por la herramienta, se deja intacto y el flujo del proyecto vive en `docs/06-gobernanza-sdd/workflows/`. La CLI acepta una ruta de archivo, de modo que no hace falta instalarlo.

## 2. Qué se verificó y qué no

| Verificación | Resultado |
|---|---|
| `specify workflow info docs/06-gobernanza-sdd/workflows/mercado-sdd.yml` | El archivo carga y muestra 14 pasos en el orden previsto |
| Claves de los pasos `shell` (`run`, `timeout`) y `gate` (`message`, `options`, `on_reject`) | Confirmadas en el código fuente de la CLI instalada (0.12.12.dev0) |
| Ejecución real del flujo (`specify workflow run`) | **No se ejecutó** |
| Comportamiento de los pasos `command` con los skills `speckit-*` dentro del flujo | **No probado** |

Notas técnicas de la CLI: un paso `shell` se ejecuta con el intérprete del sistema en la raíz del proyecto y **falla el flujo si el comando termina con código distinto de 0**; su tiempo máximo por defecto es 300 s, por eso las pruebas llevan `timeout: 900`. Los comandos `shell` los controla quien escribe el YAML, así que el archivo debe revisarse antes de usarlo (aplica también a flujos descargados).

## 3. Las ocho etapas y su verificación

| # | Etapa | Paso(s) del workflow | Condición de salida (constitución) | Evidencia |
|---|---|---|---|---|
| 1 | Especificar | `specify` → compuerta `review-spec` | `spec.md` con la sección *Trazabilidad* (HU, RF, ADR, RC/AC/DA) y criterios de aceptación medibles | `specs/<n>/spec.md` |
| 2 | Aclarar | `clarify` → `review-clarify` | Sin marcadores `NEEDS CLARIFICATION`; decisiones DEC-xx de las que depende, resueltas o declaradas como bloqueo | Sección de aclaraciones de `spec.md` |
| 3 | Planificar | `plan` → `review-plan` | *Constitution Check* (principios I–X) en verde o justificado | `plan.md`, `data-model.md`, `contracts/` |
| 4 | Generar tareas | `tasks` | Tareas por historia, con tareas de prueba y rutas exactas | `tasks.md` |
| 5 | Analizar | `analyze` → `review-analysis` | Sin hallazgos CRITICAL ni conflictos con la constitución (el análisis es de solo lectura) | Informe de `/speckit-analyze` |
| 6 | Implementar | `implement` | Código por capas; tareas marcadas; **sin** migraciones sobre la base compartida, commits, push ni merge | Código y `tasks.md` |
| 7 | Probar | `test-backend`, `test-frontend` (automáticos) y `test-db-manual` (compuerta) | `prisma:validate`, `build`, `lint`, `npm test` y `npm run test:e2e`; en frontend `lint` y `build`; `npm run test:db` manual si toca la base | Salida real de cada comando |
| 8 | Revisar | `review-final` | `/speckit-converge` sin trabajo pendiente, checklist de *Governance* y informe de lo implementado, verificado y pendiente | Informe de revisión |

## 4. Decisiones de diseño del flujo

- **Compuertas humanas** en cada punto de decisión (1, 2, 3, 5, 7-base de datos y 8); `on_reject: abort` detiene el flujo.
- **`npm run test:db` es manual**, porque usa la base de desarrollo compartida; nunca corre de forma automática.
- **`/speckit-converge` se pide en la revisión final**, no como paso automático, porque puede agregar tareas a `tasks.md` y exigiría repetir la implementación.
- **No hay paso de commit, push, migración ni merge**: la constitución exige orden explícita del equipo.
- **Dos entradas**: `spec` (obligatoria) e `integration` (`auto`).
- Las especificaciones de regularización (R1–R3) usan el mismo flujo; su descripción debe indicar que son retroactivas (ver [05-matriz-de-regularizacion.md](05-matriz-de-regularizacion.md)).

## 5. Cómo se usaría (solo tras aprobar DEC-08)

```bash
# Ver el flujo sin ejecutarlo
specify workflow info docs/06-gobernanza-sdd/workflows/mercado-sdd.yml

# Ejecutarlo
specify workflow run docs/06-gobernanza-sdd/workflows/mercado-sdd.yml \
  -i spec="Descripción citando HU, RF y ADR"

# Consultar o retomar una ejecución detenida en una compuerta
specify workflow status
specify workflow resume <id-de-ejecución>
```

Alternativa sin workflow (opción 2 de DEC-08): ejecutar a mano `/speckit-specify`, `/speckit-clarify`, `/speckit-plan`, `/speckit-tasks`, `/speckit-analyze` y `/speckit-implement`, y luego los comandos de prueba de la etapa 7, anotando la evidencia de cada etapa.

## 6. Limitaciones conocidas

1. Los pasos de prueba cubren backend y frontend completos, no solo lo afectado por la funcionalidad.
2. No hay pruebas automáticas del frontend; la etapa 7 solo exige `lint` y `build` allí.
3. El paso `shell` depende del intérprete de comandos del sistema; los comandos usan `&&`, válido en `cmd` y en shells POSIX.
4. Las compuertas no validan automáticamente la condición de salida: la verificación la hace la persona que aprueba, con apoyo del informe de `/speckit-analyze`.
