import { useState } from 'react'
import { useAuth } from '../lib/auth'
import { APP_NAME, TAGLINE } from '../config'

export default function Login() {
  const { signIn, signUp } = useAuth()
  const [name, setName] = useState('')
  const [pw, setPw] = useState('')
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)

  const go = async (kind: 'in' | 'up') => {
    if (!name.trim()) { setMsg('Enter your name.'); return }
    setBusy(true); setMsg('')
    const e = kind === 'in' ? await signIn(name, pw) : await signUp(name, pw)
    setBusy(false)
    if (e) setMsg(e)
  }

  return (
    <main className="login">
      <h1>{APP_NAME}</h1>
      <p className="tagline">{TAGLINE}</p>
      <form onSubmit={(e) => { e.preventDefault(); go('in') }}>
        <label>Your name
          <input value={name} onChange={(e) => setName(e.target.value)} autoCapitalize="words" autoComplete="username" />
        </label>
        <label>Password <small>(leave empty to use your name)</small>
          <input type="password" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="current-password" />
        </label>
        {msg && <p className="error" role="alert">{msg}</p>}
        <button className="btn primary" disabled={busy}>{busy ? 'Please wait…' : 'Sign in'}</button>
        <button type="button" className="btn ghost" disabled={busy} onClick={() => go('up')}>Request access</button>
      </form>
      <p className="hint">New accounts wait for Admin approval before they can open anything.</p>
    </main>
  )
}
