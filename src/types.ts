/** Tipo de movimiento: los gastos se dividen en fijos y variables. */
/** 'traspaso' = movimiento entre cuentas propias o al ahorro: no es gasto ni ingreso. */
export type Clase = 'fijo' | 'variable' | 'ingreso' | 'traspaso'

export type TipoCategoria = 'gasto' | 'ingreso'

export type Tema = 'auto' | 'light' | 'dark'

export interface Categoria {
  id: string
  nombre: string
  emoji: string
  tipo: TipoCategoria
  /** Posición en la paleta de colores (0-7). Sin slot = gris "Otras". */
  slot?: number
}

export interface Movimiento {
  id: string
  clase: Clase
  importe: number
  categoriaId: string
  asunto: string
  /** Formato YYYY-MM-DD */
  fecha: string
  /** Si lo generó un fijo recurrente, su id. */
  fijoId?: string
  /** 'banco' si se importó automáticamente de una cuenta conectada. */
  origen?: 'manual' | 'banco'
  /** Descripción original del banco (comercio / concepto). */
  comercio?: string
  /** Solo en traspasos: si el dinero entra o sale de la cuenta. */
  sentido?: 'entrada' | 'salida'
}

/** Plantilla de un gasto/ingreso que se repite cada mes. */
export interface Fijo {
  id: string
  tipo: TipoCategoria
  nombre: string
  importe: number
  categoriaId: string
  /** Día del mes (1-31); se ajusta en meses más cortos. */
  dia: number
  /** Primer mes en el que aplica, YYYY-MM */
  desde: string
  activo: boolean
  /** Meses (YYYY-MM) en los que ya se generó su movimiento. */
  generados: string[]
}

export interface DatosFinanzas {
  movimientos: Movimiento[]
  fijos: Fijo[]
  categorias: Categoria[]
  /** Dinero mínimo que se quiere mantener siempre en la cuenta. */
  colchon: number | null
}
