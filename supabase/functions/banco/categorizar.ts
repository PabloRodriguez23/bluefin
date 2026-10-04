/** Categorización automática de los movimientos del banco. */

export const normalizar = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z ]+/g, ' ')
    .replace(/\b(compra|tarj|tarjeta|pago|recibo|transferencia|transf|bizum|en|de|sl|sa|slu|es|www|com)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

/**
 * Palabras clave de comercios → categoría por defecto.
 * Las de 6+ letras se buscan dentro de cualquier palabra ("spotifyes", "soloptical");
 * las cortas solo como palabra completa para evitar falsos positivos.
 */
const PALABRAS: [string, string[]][] = [
  ['comida', ['mercadona', 'carrefour', 'carref', 'supeco', 'lidl', 'aldi', 'dia', 'eroski', 'alcampo', 'consum', 'hipercor', 'supercor', 'bonpreu', 'condis', 'ahorramas', 'caprabo', 'gadis', 'froiz', 'supermercado', 'fruteria', 'panaderia', 'carniceria', 'spar', 'coviran', 'jamon', 'charcuteria', 'pescaderia', 'mercado']],
  ['transporte', ['repsol', 'cepsa', 'galp', 'bp', 'shell', 'petronor', 'petroprix', 'ballenoil', 'plenoil', 'gasolinera', 'combustible', 'renfe', 'ouigo', 'iryo', 'alsa', 'cabify', 'uber', 'bolt', 'freenow', 'metro', 'emt', 'tmb', 'tussam', 'parking', 'aparcamiento', 'garagem', 'estacionamento', 'peaje', 'autopista', 'easytoll', 'autoestradas', 'via verde', 'vueling', 'ryanair', 'iberia', 'blablacar', 'itv', 'taller', 'neumaticos']],
  ['suscripciones', ['netflix', 'spotify', 'hbo', 'disney', 'prime', 'dazn', 'movistar plus', 'filmin', 'youtube', 'apple', 'icloud', 'google', 'microsoft', 'playstation', 'xbox', 'nintendo', 'chatgpt', 'openai', 'claude', 'anthropic', 'patreon', 'twitch', 'audible', 'kindle']],
  ['facturas', ['iberdrola', 'endesa', 'naturgy', 'holaluz', 'repsol luz', 'totalenergies', 'octopus', 'aguas', 'canal isabel', 'agbar', 'emasesa', 'movistar', 'vodafone', 'orange', 'digi', 'pepephone', 'simyo', 'lowi', 'jazztel', 'masmovil', 'yoigo', 'finetwork', 'seguro', 'mapfre', 'mutua', 'linea directa', 'allianz', 'axa', 'ibi', 'ayuntamiento', 'comunidad propietarios']],
  ['salud', ['farmacia', 'parafarmacia', 'clinica', 'clinite', 'dentista', 'dental', 'hospital', 'optica', 'optical', 'sanitas', 'adeslas', 'asisa', 'dkv', 'fisioterapia', 'gimnasio', 'gym', 'crossfit', 'basic fit', 'mcfit', 'altafit', 'synergym', 'holmes place', 'padel']],
  ['compras', ['amazon', 'zara', 'primark', 'mango', 'pull bear', 'bershka', 'stradivarius', 'massimo dutti', 'hm', 'el corte ingles', 'decathlon', 'mediamarkt', 'pccomponentes', 'fnac', 'ikea', 'leroy merlin', 'bricomart', 'aliexpress', 'shein', 'temu', 'zalando', 'action', 'tiger', 'druni', 'primor', 'sephora', 'wallapop', 'vinted', 'ferreteria', 'tornillos', 'barber', 'peluqueria']],
  ['ocio', ['restaurante', 'restaura', 'bar', 'cafeteria', 'cafe', 'cerveceria', 'taberna', 'tasca', 'meson', 'pizzeria', 'pizza', 'burger', 'burguer', 'bk', 'mcdonalds', 'kfc', 'telepizza', 'dominos', 'foster', 'vips', 'goiko', 'sushi', 'ramen', 'kebab', 'wok', 'tapas', 'glovo', 'just eat', 'uber eats', 'starbucks', 'eurest', 'cine', 'cinesa', 'yelmo', 'kinepolis', 'teatro', 'entradas', 'ticketmaster', 'booking', 'airbnb', 'hotel', 'museo', 'discoteca', 'steam', 'casa del libro', 'hobby']],
  ['vivienda', ['alquiler', 'hipoteca', 'inmobiliaria', 'idealista', 'comunidad']],
]

/** Códigos MCC (tipo de comercio que informa la red de tarjetas). */
const MCC: [RegExp, string][] = [
  [/^54(11|22|99)$/, 'comida'],
  [/^55(41|42)$|^4(111|112|121|131|784)$|^7523$|^3\d{3}$/, 'transporte'],
  [/^58(12|13|14)$|^78(32|41|99)$|^7011$|^7922$/, 'ocio'],
  [/^59(12)$|^80\d{2}$|^7997$/, 'salud'],
  [/^4(814|899|900)$|^63\d{2}$/, 'facturas'],
  [/^5(311|651|691|699|732|734|941|945|977|999)$/, 'compras'],
]

const coincide = (texto: string, palabra: string) =>
  palabra.length >= 6 && !palabra.includes(' ') ? texto.includes(palabra) : ` ${texto} `.includes(` ${palabra} `)

export interface Regla {
  patron: string
  categoria_id: string
}

/** Valor de regla que marca un comercio como traspaso (no es gasto ni ingreso). */
export const REGLA_TRASPASO = '__traspaso'

const reglaPara = (t: string, reglas: Regla[]) =>
  [...reglas].sort((a, b) => b.patron.length - a.patron.length).find((r) => r.patron && t.includes(r.patron))

/** Huchas, cuentas de ahorro y redondeos de los bancos digitales. */
const AHORRO_RE = /\b(cuenta con mejora|mejora activada|savings?|vault|hucha|pocket|ahorro|redondeo|round ?up|spare change|flexible cash)\b/

/**
 * ¿Es dinero que se mueve entre cuentas propias? Devuelve:
 *  'ahorro'   → hacia/desde una cuenta de ahorro
 *  'traspaso' → hacia/desde otra cuenta a tu nombre
 *  null       → gasto o ingreso normal
 */
export function detectarTraspaso(texto: string, contraparte: string, titulares: string[], reglas: Regla[]): 'ahorro' | 'traspaso' | null {
  const t = normalizar(texto)
  const regla = reglaPara(t, reglas)
  if (regla) return regla.categoria_id === REGLA_TRASPASO ? 'traspaso' : null
  if (AHORRO_RE.test(t)) return 'ahorro'
  const c = normalizar(contraparte)
  if (c && titulares.some((n) => normalizar(n) === c)) return 'traspaso'
  return null
}

export function categorizar(
  texto: string,
  mcc: string | undefined,
  esIngreso: boolean,
  reglas: Regla[],
  existentes: Set<string>,
): string {
  const t = normalizar(texto)
  const valida = (id: string) => (existentes.has(id) ? id : null)

  // 1. Reglas que ha ido enseñando el usuario (la más específica primero)
  const regla = reglaPara(t, reglas)
  if (regla && regla.categoria_id !== REGLA_TRASPASO && valida(regla.categoria_id)) return regla.categoria_id

  if (esIngreso) {
    if (/\b(nomina|salario|sueldo|payroll)\b/.test(t)) return valida('nomina') ?? 'otros-ingresos'
    return valida('extra') ?? 'otros-ingresos'
  }

  // 2. Comercios conocidos
  for (const [cat, palabras] of PALABRAS) {
    if (palabras.some((p) => coincide(t, p)) && valida(cat)) return cat
  }
  // 3. Código de actividad del comercio
  if (mcc) for (const [re, cat] of MCC) if (re.test(mcc) && valida(cat)) return cat

  return 'otros'
}
