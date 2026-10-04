/**
 * Edge Function "banco": conexión con los bancos vía Enable Banking (Open Banking PSD2).
 *
 * Rutas:
 *   GET  /banco/bancos?pais=ES   → lista de bancos disponibles
 *   POST /banco/conectar         → inicia la autorización; devuelve la URL del banco
 *   GET  /banco/callback         → vuelta desde el banco; crea la conexión e importa
 *   POST /banco/sincronizar      → importa ahora los movimientos nuevos del usuario
 *   POST /banco/desconectar      → revoca una conexión
 *   POST /banco/cron             → sincroniza todas las conexiones (lo llama pg_cron)
 *
 * Secretos necesarios: EB_APP_ID, EB_PRIVATE_KEY (contenido del .pem), CRON_SECRET
 */
import { createClient } from 'npm:@supabase/supabase-js@2'
import { importPKCS8, SignJWT } from 'npm:jose@5'
import { createPrivateKey, timingSafeEqual } from 'node:crypto'
import { categorizar, detectarTraspaso, normalizar, type Regla } from './categorizar.ts'

const EB = 'https://api.enablebanking.com'
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY =
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ??
  (JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') ?? '{}') as Record<string, string>).default
const CALLBACK = `${SUPABASE_URL}/functions/v1/banco/callback`
const DIA = 86_400_000

const db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })

/** Validez del enlace de autorización: pasado este tiempo el "state" ya no sirve. */
const STATE_TTL_MS = 30 * 60_000

/**
 * Orígenes a los que se puede volver tras autorizar en el banco (evita redirecciones abiertas).
 * APP_ORIGINS="https://usuario.github.io,..." · localhost y la red local siempre se permiten (desarrollo).
 */
function origenPermitido(url: string): boolean {
  try {
    const u = new URL(url)
    if (!/^https?:$/.test(u.protocol)) return false
    if (/^(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+)$/.test(u.hostname)) return true
    const permitidos = (Deno.env.get('APP_ORIGINS') ?? '').split(',').map((o) => o.trim()).filter(Boolean)
    return permitidos.includes(u.origin)
  } catch {
    return false
  }
}

/** Comparación en tiempo constante para el secreto del cron. */
function secretoValido(recibido: string | null): boolean {
  const esperado = Deno.env.get('CRON_SECRET') ?? ''
  if (!recibido || !esperado) return false
  const a = new TextEncoder().encode(recibido)
  const b = new TextEncoder().encode(esperado)
  return a.length === b.length && timingSafeEqual(a, b)
}

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
}
const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })

// ===== Enable Banking =====

let clave: CryptoKey | null = null
async function tokenEB(): Promise<string> {
  if (!clave) {
    // Acepta tanto PKCS#8 como PKCS#1 ("BEGIN RSA PRIVATE KEY")
    const pem = Deno.env.get('EB_PRIVATE_KEY')!.replace(/\\n/g, '\n')
    const pkcs8 = createPrivateKey(pem).export({ type: 'pkcs8', format: 'pem' }).toString()
    clave = await importPKCS8(pkcs8, 'RS256')
  }
  const ahora = Math.floor(Date.now() / 1000)
  return new SignJWT({ iss: 'enablebanking.com', aud: 'api.enablebanking.com', iat: ahora, exp: ahora + 3600 })
    .setProtectedHeader({ typ: 'JWT', alg: 'RS256', kid: Deno.env.get('EB_APP_ID')! })
    .sign(clave)
}

class ErrorEB extends Error {
  constructor(public status: number, public detalle: string) {
    super(`Enable Banking ${status}: ${detalle}`)
  }
}

/** Si el usuario está usando la app, se envían sus datos (PSU) y el banco no aplica el límite de 4 consultas/día. */
interface Psu {
  ip?: string
  agente?: string
}

async function eb<T>(ruta: string, init: RequestInit = {}, psu?: Psu): Promise<T> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${await tokenEB()}`,
    'Content-Type': 'application/json',
  }
  if (psu?.ip) headers['Psu-Ip-Address'] = psu.ip
  if (psu?.agente) headers['Psu-User-Agent'] = psu.agente
  const r = await fetch(EB + ruta, { ...init, headers })
  if (!r.ok) throw new ErrorEB(r.status, await r.text())
  return r.status === 204 ? (undefined as T) : r.json()
}

interface Aspsp {
  name: string
  country: string
  logo?: string
  beta?: boolean
  maximum_consent_validity?: number
}

const cacheBancos = new Map<string, { t: number; lista: Aspsp[] }>()
async function listarBancos(pais: string): Promise<Aspsp[]> {
  const c = cacheBancos.get(pais)
  if (c && Date.now() - c.t < 6 * 3600_000) return c.lista
  const { aspsps } = await eb<{ aspsps: Aspsp[] }>(`/aspsps?country=${pais}&psu_type=personal`)
  cacheBancos.set(pais, { t: Date.now(), lista: aspsps })
  return aspsps
}

// ===== Importación de movimientos =====

interface TxEB {
  entry_reference?: string
  transaction_id?: string
  merchant_category_code?: string
  transaction_amount: { currency: string; amount: string }
  creditor?: { name?: string }
  debtor?: { name?: string }
  credit_debit_indicator: 'CRDT' | 'DBIT'
  status?: string
  booking_date?: string
  value_date?: string
  transaction_date?: string
  remittance_information?: string[]
  note?: string
}

interface Conexion {
  id: string
  user_id: string
  session_id: string
  cuentas: { uid: string; iban?: string; nombre?: string }[]
  ultima_sync: string | null
}

async function sha(s: string) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s))
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

const isoDia = (d: Date) => d.toISOString().slice(0, 10)

/** "COMPRA TARJ. MERCADONA VALENCIA" → "Mercadona Valencia" */
function bonito(s: string) {
  const limpio = s
    .replace(/\b(compra|tarj\.?|tarjeta|pago|recibo|transferencia|transf\.?)\b/gi, ' ')
    .replace(/\b\d{4,}\S*/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  const base = limpio || s.trim()
  return base.toLowerCase().replace(/(^|\s)\S/g, (c) => c.toUpperCase()).slice(0, 80)
}

async function sincronizarConexion(c: Conexion, psu?: Psu): Promise<number> {
  const [{ data: reglas }, { data: cats }] = await Promise.all([
    db.from('reglas').select('patron, categoria_id').eq('user_id', c.user_id),
    db.from('categorias').select('id').eq('user_id', c.user_id),
  ])
  const existentes = new Set<string>((cats ?? []).map((x) => x.id))
  for (const id of ['otros', 'otros-ingresos']) existentes.add(id)

  const desde = c.ultima_sync ? new Date(new Date(c.ultima_sync).getTime() - 7 * DIA) : new Date(Date.now() - 90 * DIA)
  const nuevas: { ref: string; tx: TxEB }[] = []

  for (const cuenta of c.cuentas) {
    let continuation: string | undefined
    do {
      const qs = new URLSearchParams({ date_from: isoDia(desde) })
      if (continuation) qs.set('continuation_key', continuation)
      const r = await eb<{ transactions: TxEB[]; continuation_key?: string }>(
        `/accounts/${cuenta.uid}/transactions?${qs}`,
        {},
        psu,
      )
      for (const tx of r.transactions ?? []) {
        if (tx.status === 'PDNG') continue // pendientes: se importan cuando se confirman
        const fecha = tx.booking_date ?? tx.value_date ?? tx.transaction_date
        if (!fecha) continue
        const idBanco = tx.transaction_id || tx.entry_reference
        const ref = `${cuenta.uid}:${idBanco ?? (await sha(JSON.stringify(tx))).slice(0, 32)}`
        nuevas.push({ ref, tx })
      }
      continuation = r.continuation_key || undefined
    } while (continuation)
  }

  // Quitar los que ya importamos antes
  const yaImportadas = new Set<string>()
  for (let i = 0; i < nuevas.length; i += 200) {
    const refs = nuevas.slice(i, i + 200).map((n) => n.ref)
    const { data } = await db.from('movimientos').select('ref_banco').eq('user_id', c.user_id).in('ref_banco', refs)
    for (const r of data ?? []) yaImportadas.add(r.ref_banco)
  }
  const pendientes = nuevas.filter((n) => !yaImportadas.has(n.ref))
  if (!pendientes.length) return 0

  // Fijos generados aún sin conciliar en ese periodo: el cargo real del banco los sustituye
  const { data: fijosMes } = await db
    .from('movimientos')
    .select('id, clase, importe, fecha, categoria_id')
    .eq('user_id', c.user_id)
    .eq('origen', 'manual')
    .not('fijo_id', 'is', null)
    .gte('fecha', isoDia(new Date(desde.getTime() - 31 * DIA)))
  const candidatos = [...(fijosMes ?? [])]

  // Nombres de los titulares: una transferencia a/desde tu propio nombre es un traspaso
  const titulares = c.cuentas.map((x) => x.nombre ?? '').filter(Boolean)

  const inserts: Record<string, unknown>[] = []
  for (const { ref, tx } of pendientes) {
    const importe = Math.abs(Number(tx.transaction_amount.amount))
    if (!importe) continue
    const esIngreso = tx.credit_debit_indicator === 'CRDT'
    const fecha = (tx.booking_date ?? tx.value_date ?? tx.transaction_date)!
    const contraparte = esIngreso ? tx.debtor?.name : tx.creditor?.name
    const concepto = [...(tx.remittance_information ?? []), tx.note ?? ''].join(' ').trim()
    const comercio = (contraparte || concepto || 'Movimiento bancario').slice(0, 140)
    const categoria = categorizar(`${contraparte ?? ''} ${concepto}`, tx.merchant_category_code, esIngreso, (reglas ?? []) as Regla[], existentes)
    const texto = `${contraparte ?? ''} ${concepto}`
    const traspaso = detectarTraspaso(texto, contraparte ?? '', titulares, (reglas ?? []) as Regla[])
    if (traspaso) {
      inserts.push({
        user_id: c.user_id,
        id: `eb_${(await sha(ref)).slice(0, 24)}`,
        clase: 'traspaso',
        sentido: esIngreso ? 'entrada' : 'salida',
        importe,
        categoria_id: traspaso,
        asunto: bonito(contraparte || concepto || 'Traspaso'),
        fecha,
        origen: 'banco',
        comercio,
        ref_banco: ref,
      })
      continue
    }
    const clase = esIngreso ? 'ingreso' : 'variable'

    // ¿Corresponde a un fijo previsto este mes? (mismo importe exacto, o ±10 % y misma categoría)
    const idx = candidatos.findIndex((f) => {
      const mismoTipo = esIngreso ? f.clase === 'ingreso' : f.clase === 'fijo'
      const mismoMes = String(f.fecha).slice(0, 7) === fecha.slice(0, 7)
      const dif = Math.abs(Number(f.importe) - importe)
      return mismoTipo && mismoMes && (dif < 0.01 || (dif <= Math.max(1, Number(f.importe) * 0.1) && f.categoria_id === categoria))
    })
    if (idx !== -1) {
      const f = candidatos.splice(idx, 1)[0]
      await db
        .from('movimientos')
        .update({ importe, fecha, origen: 'banco', comercio, ref_banco: ref, updated_at: new Date().toISOString() })
        .eq('user_id', c.user_id)
        .eq('id', f.id)
      continue
    }

    inserts.push({
      user_id: c.user_id,
      id: `eb_${(await sha(ref)).slice(0, 24)}`,
      clase,
      importe,
      categoria_id: categoria,
      asunto: bonito(contraparte || concepto || 'Movimiento bancario'),
      fecha,
      origen: 'banco',
      comercio,
      ref_banco: ref,
    })
  }

  for (let i = 0; i < inserts.length; i += 500) {
    const { error } = await db
      .from('movimientos')
      .upsert(inserts.slice(i, i + 500), { onConflict: 'user_id,id', ignoreDuplicates: true })
    if (error) throw error
  }
  return pendientes.length
}

async function sincronizarYGuardar(c: Conexion, psu?: Psu) {
  try {
    const n = await sincronizarConexion(c, psu)
    await db.from('bancos').update({ ultima_sync: new Date().toISOString(), error: null }).eq('id', c.id)
    return { id: c.id, nuevos: n }
  } catch (e) {
    let msg = e instanceof Error ? e.message : String(e)
    if (e instanceof ErrorEB) {
      if (e.status === 401 || e.status === 403 || /expired|EXPIRED_SESSION|CLOSED_SESSION/i.test(e.detalle)) {
        msg = 'La autorización del banco ha caducado. Vuelve a conectarlo.'
      } else if (/RATE_LIMIT/i.test(e.detalle)) {
        msg = 'El banco limita las consultas automáticas a 4 al día. Se reintentará más tarde.'
      }
    }
    console.error('[banco] error al sincronizar', c.id, e)
    await db.from('bancos').update({ error: msg }).eq('id', c.id)
    return { id: c.id, error: msg }
  }
}

// ===== Rutas =====

async function usuario(req: Request) {
  const token = req.headers.get('Authorization')?.replace('Bearer ', '')
  if (!token) return null
  const { data } = await db.auth.getUser(token)
  return data.user
}

const psuDe = (req: Request): Psu => ({
  ip: req.headers.get('x-forwarded-for')?.split(',')[0].trim(),
  agente: req.headers.get('user-agent') ?? undefined,
})

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  const url = new URL(req.url)
  // "/banco/bancos" → "/bancos" (ojo: no confundir el nombre de la función con la ruta /bancos)
  const ruta = url.pathname.replace(/^.*?\/banco(?=\/|$)/, '') || '/'

  try {
    // --- Vuelta desde el banco (sin sesión de usuario: la identifica el "state") ---
    if (ruta === '/callback') {
      const state = url.searchParams.get('state')
      if (!state || !/^[0-9a-f-]{36}$/i.test(state)) return new Response('Enlace no válido.', { status: 400 })
      const { data: auth } = await db.from('bancos_auth').select('*').eq('state', state).maybeSingle()
      if (!auth) return new Response('Enlace caducado. Vuelve a la app e inténtalo de nuevo.', { status: 400 })
      // Un solo uso, y además limpiamos los que se quedaron a medias
      await db.from('bancos_auth').delete().eq('state', auth.state)
      await db.from('bancos_auth').delete().lt('created_at', new Date(Date.now() - STATE_TTL_MS).toISOString())
      if (Date.now() - new Date(auth.created_at).getTime() > STATE_TTL_MS || !origenPermitido(auth.volver_a)) {
        return new Response('Enlace caducado. Vuelve a la app e inténtalo de nuevo.', { status: 400 })
      }
      const volver = new URL(auth.volver_a)

      const code = url.searchParams.get('code')
      if (!code) {
        volver.searchParams.set('banco', 'cancelado')
        return Response.redirect(volver.toString(), 302)
      }
      const sesion = await eb<{
        session_id: string
        accounts: { uid: string; account_id?: { iban?: string }; name?: string; currency?: string }[]
        access: { valid_until: string }
      }>('/sessions', { method: 'POST', body: JSON.stringify({ code }) })

      const { data: conexion, error } = await db
        .from('bancos')
        .insert({
          user_id: auth.user_id,
          session_id: sesion.session_id,
          banco: auth.banco,
          pais: auth.pais,
          logo: auth.logo,
          cuentas: sesion.accounts.map((a) => ({ uid: a.uid, iban: a.account_id?.iban, nombre: a.name })),
          valido_hasta: sesion.access.valid_until,
        })
        .select()
        .single()
      if (error) throw error

      const r = await sincronizarYGuardar(conexion as Conexion, psuDe(req))
      volver.searchParams.set('banco', 'error' in r ? 'error' : 'ok')
      if ('nuevos' in r) volver.searchParams.set('nuevos', String(r.nuevos))
      return Response.redirect(volver.toString(), 302)
    }

    // --- Tarea programada ---
    if (ruta === '/cron') {
      if (!secretoValido(req.headers.get('x-cron-secret'))) return json({ error: 'No autorizado' }, 401)
      const { data } = await db.from('bancos').select('*').gt('valido_hasta', new Date().toISOString())
      const resultados = []
      for (const c of (data ?? []) as Conexion[]) resultados.push(await sincronizarYGuardar(c))
      return json({ resultados })
    }

    // --- Rutas del usuario ---
    const user = await usuario(req)
    if (!user) return json({ error: 'No autorizado' }, 401)

    if (ruta === '/bancos') {
      const pais = (url.searchParams.get('pais') ?? 'ES').toUpperCase()
      const lista = await listarBancos(pais)
      return json(lista.map((b) => ({ nombre: b.name, pais: b.country, logo: b.logo, beta: !!b.beta })))
    }

    const body = req.method === 'POST' ? await req.json().catch(() => ({})) : {}

    if (ruta === '/conectar') {
      const { banco, pais = 'ES', volver_a } = body as { banco: string; pais?: string; volver_a: string }
      if (!banco || typeof banco !== 'string') return json({ error: 'Faltan datos' }, 400)
      if (!origenPermitido(volver_a ?? '')) return json({ error: 'Dirección de vuelta no permitida' }, 400)
      const aspsp = (await listarBancos(pais)).find((b) => b.name === banco)
      if (!aspsp) return json({ error: 'Banco no encontrado' }, 404)
      const segundos = Math.min(aspsp.maximum_consent_validity ?? 180 * 86400, 180 * 86400)

      const { data: auth, error } = await db
        .from('bancos_auth')
        .insert({ user_id: user.id, banco, pais, logo: aspsp.logo, volver_a })
        .select('state')
        .single()
      if (error) throw error

      const r = await eb<{ url: string }>('/auth', {
        method: 'POST',
        body: JSON.stringify({
          access: { valid_until: new Date(Date.now() + segundos * 1000 - 60_000).toISOString() },
          aspsp: { name: banco, country: pais },
          state: auth.state,
          redirect_url: CALLBACK,
          psu_type: 'personal',
        }),
      })
      return json({ url: r.url })
    }

    if (ruta === '/sincronizar') {
      const { data } = await db.from('bancos').select('*').eq('user_id', user.id).gt('valido_hasta', new Date().toISOString())
      const psu = psuDe(req)
      const resultados = []
      for (const c of (data ?? []) as Conexion[]) resultados.push(await sincronizarYGuardar(c, psu))
      return json({ resultados })
    }

    if (ruta === '/desconectar') {
      const { data: c } = await db.from('bancos').select('*').eq('id', body.id).eq('user_id', user.id).maybeSingle()
      if (!c) return json({ error: 'No encontrado' }, 404)
      await eb(`/sessions/${c.session_id}`, { method: 'DELETE' }).catch(() => {})
      await db.from('bancos').delete().eq('id', c.id)
      return json({ ok: true })
    }

    // Aprender: aplicar una categoría a todos los movimientos de un comercio
    if (ruta === '/regla') {
      const { comercio, categoria_id } = body as { comercio: string; categoria_id: string }
      const patron = normalizar(comercio ?? '')
      if (!patron || !categoria_id) return json({ error: 'Faltan datos' }, 400)
      await db.from('reglas').upsert({ user_id: user.id, patron, categoria_id }, { onConflict: 'user_id,patron' })
      return json({ patron })
    }

    return json({ error: 'Ruta no encontrada' }, 404)
  } catch (e) {
    console.error('[banco]', e)
    // El detalle se queda en los logs del servidor; al cliente, un mensaje genérico
    return json({ error: 'Error interno. Inténtalo de nuevo en unos minutos.' }, 500)
  }
})

