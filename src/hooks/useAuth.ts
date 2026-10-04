import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { iniciarSync } from '../lib/sync'

/**
 * Sesión actual de Supabase. `undefined` mientras se comprueba.
 * Sin Supabase configurado devuelve `null` y la app funciona solo en local.
 */
export function useAuth() {
  const [session, setSession] = useState<Session | null | undefined>(supabase ? undefined : null)

  useEffect(() => {
    if (!supabase) return
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data } = supabase.auth.onAuthStateChange((_evento, s) => setSession(s))
    return () => data.subscription.unsubscribe()
  }, [])

  const userId = session?.user.id
  useEffect(() => {
    if (userId) void iniciarSync(userId)
  }, [userId])

  return session
}
