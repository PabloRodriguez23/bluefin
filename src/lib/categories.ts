import type { Categoria } from '../types'

export const OTROS_GASTO = 'otros'
export const OTROS_INGRESO = 'otros-ingresos'

export const DEFAULT_CATEGORIAS: Categoria[] = [
  { id: 'vivienda', nombre: 'Vivienda', emoji: '🏠', tipo: 'gasto', slot: 0 },
  { id: 'comida', nombre: 'Comida', emoji: '🛒', tipo: 'gasto', slot: 1 },
  { id: 'transporte', nombre: 'Transporte', emoji: '🚗', tipo: 'gasto', slot: 2 },
  { id: 'ocio', nombre: 'Ocio', emoji: '🎉', tipo: 'gasto', slot: 3 },
  { id: 'salud', nombre: 'Salud', emoji: '💊', tipo: 'gasto', slot: 4 },
  { id: 'facturas', nombre: 'Facturas', emoji: '💡', tipo: 'gasto', slot: 5 },
  { id: 'compras', nombre: 'Compras', emoji: '🛍️', tipo: 'gasto', slot: 6 },
  { id: 'suscripciones', nombre: 'Suscripciones', emoji: '📱', tipo: 'gasto', slot: 7 },
  { id: OTROS_GASTO, nombre: 'Otros', emoji: '📦', tipo: 'gasto' },
  { id: 'nomina', nombre: 'Nómina', emoji: '💼', tipo: 'ingreso' },
  { id: 'extra', nombre: 'Extra', emoji: '💰', tipo: 'ingreso' },
  { id: 'regalo', nombre: 'Regalo', emoji: '🎁', tipo: 'ingreso' },
  { id: OTROS_INGRESO, nombre: 'Otros', emoji: '↩️', tipo: 'ingreso' },
]

/** Categorías especiales de los traspasos (no aparecen en las gráficas). */
export const AHORRO = 'ahorro'
export const TRASPASO = 'traspaso'
/** Valor de regla que marca un comercio como traspaso. */
export const REGLA_TRASPASO = '__traspaso'

export const PROTEGIDAS = new Set([OTROS_GASTO, OTROS_INGRESO])
