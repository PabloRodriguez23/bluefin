/**
 * Paleta de gráficas. Los colores categóricos van en orden fijo (validado para
 * daltonismo) y cada categoría conserva su color aunque cambien los datos.
 */
export type ModoColor = 'light' | 'dark'

const CATEGORICAL: Record<ModoColor, string[]> = {
  light: ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#4a3aa7', '#e34948'],
  dark: ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#008300', '#9085e9', '#e66767'],
}

export const OTRAS_COLOR = '#898781'
export const SLOTS = 8

export function slotColor(slot: number | undefined, modo: ModoColor): string {
  return slot === undefined ? OTRAS_COLOR : CATEGORICAL[modo][slot] ?? OTRAS_COLOR
}

/** Colores de las series del resumen mensual (ingresos / fijos / variables). */
export const SERIES: Record<ModoColor, { ingresos: string; fijos: string; variables: string; previo: string }> = {
  light: { ingresos: '#1baf7a', fijos: '#1c5cab', variables: '#86b6ef', previo: '#a3aab5' },
  dark: { ingresos: '#199e70', fijos: '#9ec5f4', variables: '#2a78d6', previo: '#5c6675' },
}

export const CHROME: Record<ModoColor, { grid: string; axis: string; text: string; surface: string }> = {
  light: { grid: '#e3eaf5', axis: '#7d8aa0', text: '#4a5a70', surface: '#ffffff' },
  dark: { grid: '#1f2e45', axis: '#7f8ea5', text: '#b6c3d6', surface: '#111c2e' },
}
