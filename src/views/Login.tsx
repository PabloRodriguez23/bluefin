import { useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'

type Modo = 'entrar' | 'registro'

const TRADUCCIONES: [RegExp, string][] = [
  [/invalid login credentials/i, 'Email o contraseña incorrectos.'],
  [/email not confirmed/i, 'Tienes que confirmar tu email: revisa tu bandeja de entrada.'],
  [/already registered/i, 'Ya existe una cuenta con ese email. Prueba a entrar.'],
  [/password should be at least/i, 'La contraseña debe tener al menos 6 caracteres.'],
  [/signups? not allowed|signup_disabled/i, 'El registro de cuentas nuevas está cerrado.'],
  [/rate limit/i, 'Demasiados intentos. Espera un momento y vuelve a probar.'],
  [/fetch/i, 'No hay conexión con el servidor.'],
]
const traducir = (msg: string) => TRADUCCIONES.find(([re]) => re.test(msg))?.[1] ?? msg

export function Login() {
  const [modo, setModo] = useState<Modo>('entrar')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [verPassword, setVerPassword] = useState(false)
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState('')
  const [aviso, setAviso] = useState('')

  const enviar = async (e: FormEvent) => {
    e.preventDefault()
    if (!supabase) return
    setCargando(true)
    setError('')
    setAviso('')
    const credenciales = { email: email.trim(), password }
    const { data, error } =
      modo === 'entrar'
        ? await supabase.auth.signInWithPassword(credenciales)
        : await supabase.auth.signUp({ ...credenciales, options: { emailRedirectTo: window.location.href } })
    setCargando(false)
    if (error) return setError(traducir(error.message))
    if (modo === 'registro' && !data.session) {
      setAviso('¡Cuenta creada! Te hemos enviado un email para confirmarla. Después vuelve aquí y entra.')
      setModo('entrar')
    }
  }

  return (
    <div className="login">
      <form className="card login-card" onSubmit={enviar}>
        <img src={`${import.meta.env.BASE_URL}icons/icon.svg`} alt="" width={64} height={64} className="login-logo" />
        <h1>Bluefin</h1>
        <p className="muted">
          {modo === 'entrar'
            ? 'Entra para ver tus finanzas en todos tus dispositivos.'
            : 'Crea tu cuenta: tus datos se sincronizarán entre el móvil y el ordenador.'}
        </p>

        <label className="field">
          <span>Email</span>
          <input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label className="field">
          <span>Contraseña</span>
          <div className="password-wrap">
            <input
              type={verPassword ? 'text' : 'password'}
              required
              minLength={6}
              autoComplete={modo === 'entrar' ? 'current-password' : 'new-password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <button
              type="button"
              className="password-toggle"
              onClick={() => setVerPassword((v) => !v)}
              aria-label={verPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
              aria-pressed={verPassword}
              title={verPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
            >
              {verPassword ? <OjoTachado /> : <Ojo />}
            </button>
          </div>
        </label>

        {error && <p className="form-error">{error}</p>}
        {aviso && <p className="form-ok">{aviso}</p>}

        <button className="btn btn-primary btn-big login-btn" disabled={cargando}>
          {cargando ? 'Un momento…' : modo === 'entrar' ? 'Entrar' : 'Crear cuenta'}
        </button>

        <button
          type="button"
          className="link-btn"
          onClick={() => {
            setModo(modo === 'entrar' ? 'registro' : 'entrar')
            setError('')
          }}
        >
          {modo === 'entrar' ? '¿No tienes cuenta? Crea una' : '¿Ya tienes cuenta? Entra'}
        </button>
      </form>
    </div>
  )
}

const Ojo = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
)

const OjoTachado = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M10.6 5.1A10.9 10.9 0 0 1 12 5c6.5 0 10 7 10 7a17.6 17.6 0 0 1-3.2 4.2M6.6 6.6C3.8 8.4 2 12 2 12s3.5 7 10 7a10 10 0 0 0 5.4-1.6" />
    <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
    <path d="M3 3l18 18" />
  </svg>
)
