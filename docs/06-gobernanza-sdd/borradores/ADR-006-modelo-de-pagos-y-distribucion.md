# ADR-006 (BORRADOR): Modelo de pagos y distribución del pago único

> ⚠️ **BORRADOR PARA REVISIÓN DEL EQUIPO. NO ESTÁ ACEPTADO** y no modifica ADR-005 ni ningún requisito mientras no se apruebe DEC-01 y DEC-02 en el [registro de decisiones](../02-registro-de-decisiones.md). Este archivo vive en `borradores/` a propósito; si se aprueba, se mueve a `docs/01-analisis-de-sistema/decisiones/` con el estado «Aceptada».

## 1. Información de la decisión

| Campo | Descripción |
|---|---|
| ID | ADR-006 |
| Título | Modelo de pagos y distribución del pago único |
| Estado | **Borrador (no aceptado)** |
| Fecha del borrador | 2026-11-05 |
| Proyecto | Plataforma Integral Multivendedor para la Gestión Comercial y Operativa de un Mercado de Abastos |
| Relación con otros ADR | Complementa a [ADR-005](../../01-analisis-de-sistema/decisiones/ADR-005-pago-unico-mercado-pago.md) (pago único) y propone enmendar sus §5.1, §5.6, §9 y §10 |
| Driver principal | DA08 – Pago único por pedido con confirmación automática mediante pasarela de pago |
| Drivers relacionados | DA03, DA07, DA09, DA10, DA11 |
| Requisitos relacionados | RF32–RF35, RF47–RF55 |
| Restricciones relacionadas | RC13, RC14, RC17 |
| Atributos de calidad | AC04, AC06, AC08, AC03 |
| Decisiones del registro | DEC-01 (distribución), DEC-02 (vinculación) |

## 2. Contexto

ADR-005 selecciona el **Checkout de Mercado Pago con pago único por pedido**: el cliente paga una vez la suma de los subtotales de los puestos. El mismo ADR, sin embargo, y DA08, RC14, RF52, HU11 y HU27, exigen que **cada comerciante vincule su cuenta de Mercado Pago** y que el cobro se asocie a la cuenta vinculada de cada comerciante. Eso corresponde a un esquema de **división de pagos (Split)**, que ADR-005 §4 clasifica como **alternativa de respaldo**, y ADR-005 §9 reconoce que «la distribución del pago único entre varios comerciantes depende de las capacidades ofrecidas por el proveedor».

Hay además un simulador local de pasarela (`PasarelaPagoLocalAdapter`, diseño interno) pensado para desarrollo y pruebas; no es una distribución para la demostración.

Resultado: la documentación mezcla cuatro conceptos distintos y la especificación del módulo `payments` no puede escribirse sin ambigüedad.

## 3. Los cuatro conceptos

| # | Concepto | Definición | Necesita cuentas de comerciantes | Mueve dinero real |
|---|---|---|---|---|
| 1 | Pago único del cliente | Un cobro por pedido (suma de subtotales por puesto) con Mercado Pago Checkout en Sandbox; estado determinado por Webhook verificado y consulta a la API | No | Solo dinero de prueba |
| 2 | Vinculación de cuentas | Autorización de la cuenta de cada comerciante (RC14, RF52) | Sí | No por sí sola |
| 3 | Distribución financiera real | Los fondos llegan a las cuentas de los comerciantes (Split o liquidación posterior) | Sí (Split) | Sí |
| 4 | Distribución contable simulada | Registro interno por puesto de subtotal, comisión e importe neto, sin movimiento de dinero | No | No |

## 4. Problema arquitectónico

¿Cómo entregar un flujo completo de compra y pago multivendedor, coherente con ADR-005 y verificable en Sandbox, sin depender de capacidades de reparto que el equipo aún no ha verificado y sin presentar una simulación como si fuera una liquidación real?

## 5. Alternativas evaluadas

| Alternativa | Ventajas | Limitaciones | Resultado propuesto |
|---|---|---|---|
| A. Split real desde la primera versión | Cumple DA08 literalmente; cada puesto cobra en su cuenta | Respaldo en ADR-005; condiciones de Mercado Pago para pagos multivendedor **no verificadas por el equipo**; máxima complejidad de configuración y conciliación | No para la primera versión |
| **B. Pago único + distribución contable simulada** | Flujo completo sin depender de capacidades no verificadas; reversible mediante el patrón Strategy | Requiere enmendar requisitos; riesgo de que se interprete como liquidación real | **Propuesta** |
| C. Pago único + cobro centralizado con liquidación posterior | Contabilidad real | Proceso operativo y contable fuera del alcance (ADR-005 §4) | Respaldo |

## 6. Decisión propuesta

1. **Pago único (concepto 1):** se mantiene ADR-005 sin cambios. El cobro lo recibe **una sola cuenta de la plataforma** (credenciales de Sandbox en variables de entorno).
2. **Distribución parametrizable:** se introduce el puerto de aplicación `DistribucionPagoPort`, seleccionado por configuración (`DISTRIBUCION_PAGO_MODO = simulada | split | centralizada`), con el mismo patrón Strategy que el diseño interno ya usa para `PASARELA_PAGO_MODO`. En la primera versión solo existe el adaptador **`simulada`**.
3. **Distribución contable simulada (concepto 4):** al pasar un pago a `APROBADO`, y dentro de la misma transacción de base de datos, se registra una `DistribucionPago` por puesto con: puesto, subtotal, comisión asignada, importe neto, `modo = SIMULADA`, referencia al pago y fecha. No se llama a ninguna API de reparto.
4. **Vinculación (concepto 2), en dos niveles (DEC-02):**
   - *Primera versión:* indicador `vinculada` del comerciante, que activa o desactiva únicamente su **titular** (ADR-005 §7.6), rotulado como demostración. **Se conserva la regla de RF52**: los productos de un puesto cuyo comerciante no esté vinculado no pueden incluirse en un cobro.
   - *Especificación posterior (solo con modalidad `split`):* autorización real con tokens cifrados (AES-256-GCM, clave fuera de la base de datos), descifrados solo en el adaptador de pasarela (ADR-005 §7.3).
5. **Reparto de la comisión (propuesta de regla):** la comisión informada por la pasarela para el pago completo se reparte entre los puestos **proporcionalmente a su subtotal** (RC14: la asume el comerciante), con redondeo por *mayor resto* en céntimos enteros, de modo que la suma de las comisiones sea exactamente la comisión total y la suma de los importes netos sea exactamente `total − comisión`. Aritmética siempre en céntimos enteros (constitución, principio IV).
6. **Reembolsos (RF51):** un reembolso total o parcial genera un movimiento de ajuste en la distribución simulada, proporcional al puesto afectado, con importe, puesto y motivo.
7. **Rotulado obligatorio:** todo dato, respuesta de la API, informe y pantalla de la distribución muestra «Simulado». La palabra «liquidación» no se usa para estos registros. Los informes de RF55 y HU28 deben distinguir los importes simulados de cualquier importe real futuro.
8. **Camino a distribución real:** requiere un ADR posterior con una **prueba de concepto verificada en Sandbox** (Split o liquidación), y se activa cambiando el adaptador sin modificar el dominio, los casos de uso de Pagos ni Pedidos e Inventario (escenario EQ-07).

## 7. Modelo y puertos propuestos (ilustrativo, no implementado)

```ts
// application/ports/distribucion-pago.port.ts
export type ModoDistribucion = 'SIMULADA' | 'SPLIT' | 'CENTRALIZADA';

export interface ParteDePuesto {
  puestoId: string;
  subtotalCentimos: number;
}

export interface ResultadoDistribucion {
  puestoId: string;
  subtotalCentimos: number;
  comisionCentimos: number;
  netoCentimos: number;
  modo: ModoDistribucion;
}

export interface DistribucionPagoPort {
  readonly modo: ModoDistribucion;
  distribuir(pagoId: string, partes: ParteDePuesto[], comisionTotalCentimos: number): Promise<ResultadoDistribucion[]>;
}
```

Invariantes verificables: `Σ subtotal = total del pago`; `Σ comisión = comisión total`; `Σ neto = total − comisión`; cada neto ≥ 0; el adaptador `simulada` no realiza llamadas de red.

## 8. Seguridad (aplica ADR-005 §7 y la constitución)

- Solo Sandbox; credenciales de Mercado Pago y clave del Webhook únicamente en variables de entorno del backend.
- Sin datos de tarjeta; el estado del pago solo cambia por Webhook con firma verificada y consulta a la API; procesamiento idempotente.
- Los tokens de comerciantes solo existirán cuando exista autorización real; hasta entonces no hay tokens que cifrar.
- Solo el comerciante titular modifica su indicador de vinculación; el administrador no lo cambia en su nombre.

## 9. Consecuencias

**Positivas:** flujo de compra y pago completo y demostrable; coherencia con ADR-005; el cambio a Split o a cobro centralizado queda acotado a un adaptador; la regla de RF52 se mantiene verificable.

**Negativas / riesgos:**

| Riesgo | Mitigación |
|---|---|
| Que la simulación se confunda con una liquidación real | Rotulado «Simulado» obligatorio en datos, API e interfaz; prohibición del término «liquidación»; pruebas que lo verifican |
| Divergencia futura entre importes simulados y reales | Registrar el `modo` en cada fila; informes separados por modo |
| La pasarela no informe comisión en Sandbox | Pregunta abierta Q-2; definir un cálculo de comisión de demostración, también rotulado |
| Requisitos desactualizados | Lista de enmiendas del §10, aprobada junto con este ADR |

## 10. Documentos que habría que enmendar si se acepta (no aplicado)

| Documento | Elemento | Cambio propuesto |
|---|---|---|
| ADR-005 | §5.1, §5.6, §9, §10, §12; estado | Precisar que el cobro lo recibe una sola cuenta de la plataforma y remitir a ADR-006 para la distribución y la vinculación |
| `05-restricciones.md` | RC14 | La vinculación real puede diferirse; la comisión se registra contablemente |
| `03-requisitos-funcionales.md` | RF52, RF53, RF55 | Criterios de aceptación para vinculación simulada y para comisión/neto simulados |
| `02-historias-de-usuario.md` | HU11, HU27, HU28 | Matizar «recibir los cobros» y la comprobación de vinculación |
| `06-drivers-arquitectonicos.md` | DA08 | Quitar «asociar el cobro a la cuenta vinculada» o condicionarlo a la modalidad `split` |
| `01-actores.md` | §3 y §5 | Igual |
| C4 nivel 1, 2 y 3 | Flujo Comerciante → Mercado Pago; cuentas vinculadas cifradas; relación Pagos → Comerciantes | Marcar como modalidad `split` |
| Diseño interno, patrones y principios | Adaptadores y variable de modo | Añadir `DistribucionPagoPort` y el adaptador `simulada` |
| `04-atributos-de-calidad.md` | AC04 (pagos) | Los tokens cifrados aplican cuando existan tokens |
| `08-escenarios-atributos-calidad.md` | EQ-07 | Incluir el intercambio `simulada` ↔ `split` |
| Constitución | Principio VI | De bloqueo a regla |

## 11. Pruebas propuestas (además de las de ADR-005 §11)

1. La suma de las comisiones asignadas es igual a la comisión total, con importes que no se dividen exactamente (p. ej. 3 puestos y un total de 100,00).
2. La suma de los netos es igual a `total − comisión` y ningún neto es negativo.
3. El adaptador `simulada` no realiza llamadas de red (sin MSW activo, la prueba falla si se intenta).
4. Una distribución se registra una sola vez ante una notificación duplicada del Webhook.
5. Un reembolso parcial ajusta proporcionalmente el puesto afectado.
6. Toda respuesta de la API y toda pantalla de la distribución incluyen el rótulo «Simulado».
7. Un comerciante no vinculado no puede incluir productos en un cobro (RF52) y solo su titular cambia el indicador.
8. Prueba de contrato de `DistribucionPagoPort` aplicable a los adaptadores `simulada` y `split` (EQ-07).

## 12. Preguntas abiertas

| ID | Pregunta | Quién la resuelve |
|---|---|---|
| Q-1 | ¿Las condiciones de Mercado Pago permiten Split para este caso en Sandbox? (**no verificado por el equipo**) | Prueba de concepto del equipo, solo si se elige A |
| Q-2 | ¿Qué campo de comisión devuelve la API de pagos en Sandbox y con qué moneda? | Verificación en Sandbox durante la especificación de Pagos |
| Q-3 | ¿Quién activa el indicador de vinculación en la demostración: solo el titular, o también un script de siembra? | Equipo (DEC-02) |
| Q-4 | ¿La comisión se asigna proporcionalmente al subtotal o por otra regla? | Equipo |

## 13. Criterios para pasar a «Aceptada»

1. DEC-01 y DEC-02 aprobadas por los dos integrantes.
2. Respuestas a Q-3 y Q-4 (Q-2 puede resolverse en la especificación).
3. Lista del §10 aprobada, con un cambio de documentación posterior.
4. Estado de ADR-005 resuelto junto con este ADR (DEC-04).
