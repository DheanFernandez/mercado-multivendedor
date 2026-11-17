import { useEffect, useSyncExternalStore } from "react";

/**
 * Estado del panel de categorías del catálogo (spec 004, enmienda E1; CA-CAT-15, CA-CAT-17). Lo comparten el encabezado,
 * cuyo logotipo es el control, y la vista del catálogo, que contiene el panel. El encabezado no consulta la ruta: solo actúa
 * como control mientras una vista registró su panel (E1-A5). Es estado de interfaz de la pestaña y no se guarda.
 *
 * - Escritorio (≥ 64rem, el corte `lg` de Tailwind): el panel lateral está visible al entrar y el logotipo lo oculta o lo muestra.
 * - Móvil: el panel es un diálogo superpuesto, cerrado al entrar; el logotipo o el botón «Categorías» lo abren.
 */

export const ID_PANEL_LATERAL = "panel-categorias";
export const ID_PANEL_MOVIL = "panel-categorias-movil";
export const CONSULTA_ESCRITORIO = "(min-width: 64rem)";

interface Estado {
  registrados: number;
  visibleEscritorio: boolean;
  abiertoMovil: boolean;
}

const INICIAL: Estado = { registrados: 0, visibleEscritorio: true, abiertoMovil: false };
let estado = INICIAL;
const oyentes = new Set<() => void>();

function cambiar(cambios: Partial<Estado>) {
  estado = { ...estado, ...cambios };
  oyentes.forEach((avisar) => avisar());
}

function suscribir(avisar: () => void) {
  oyentes.add(avisar);
  return () => {
    oyentes.delete(avisar);
  };
}

const consultaMedios = () => (typeof window !== "undefined" && typeof window.matchMedia === "function" ? window.matchMedia(CONSULTA_ESCRITORIO) : null);

/** Sin `matchMedia` (servidor, entornos de prueba) se asume escritorio, que es también el estado prerenderizado. */
export const esEscritorio = () => consultaMedios()?.matches ?? true;

function suscribirMedios(avisar: () => void) {
  const m = consultaMedios();
  m?.addEventListener("change", avisar);
  return () => m?.removeEventListener("change", avisar);
}

/** Oculta o muestra el panel lateral (escritorio) o abre y cierra el diálogo (móvil), según el ancho actual. */
export function alternarPanel() {
  if (esEscritorio()) cambiar({ visibleEscritorio: !estado.visibleEscritorio });
  else cambiar({ abiertoMovil: !estado.abiertoMovil });
}

export const abrirPanelMovil = () => cambiar({ abiertoMovil: true });

export function cerrarPanelMovil() {
  if (estado.abiertoMovil) cambiar({ abiertoMovil: false });
}

export function usePanelCategorias() {
  const e = useSyncExternalStore(suscribir, () => estado, () => INICIAL);
  const escritorio = useSyncExternalStore(suscribirMedios, esEscritorio, () => true);
  return {
    /** Hay un panel montado que el logotipo puede controlar. */
    disponible: e.registrados > 0,
    escritorio,
    visibleEscritorio: e.visibleEscritorio,
    abiertoMovil: e.abiertoMovil,
    /** Valor de `aria-expanded` del logotipo para el ancho actual. */
    expandido: escritorio ? e.visibleEscritorio : e.abiertoMovil,
    /** Valor de `aria-controls` del logotipo para el ancho actual. */
    idControlado: escritorio ? ID_PANEL_LATERAL : ID_PANEL_MOVIL,
  };
}

/** La vista que contiene el panel lo registra mientras está montada; al desmontarse, el diálogo móvil queda cerrado. */
export function useRegistrarPanel() {
  useEffect(() => {
    cambiar({ registrados: estado.registrados + 1 });
    return () => cambiar({ registrados: Math.max(0, estado.registrados - 1), abiertoMovil: false });
  }, []);
}

/** Solo para pruebas: vuelve al estado inicial (el módulo conserva su estado entre pruebas del mismo archivo). */
export function reiniciarPanelCategorias() {
  cambiar(INICIAL);
}
