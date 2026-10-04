import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

/** null si no hay credenciales: la app funciona entonces solo en local. */
export const supabase = url && key ? createClient(url, key) : null
