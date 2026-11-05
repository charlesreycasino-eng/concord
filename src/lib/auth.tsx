import { createContext, useCallback, useContext, useEffect, useState, ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../supabase'
import { EMAIL_DOMAIN, PASSWORD_SUFFIX } from '../config'
import type { Perm, Profile } from '../types'

type Eff = 'admin' | 'head' | 'staff' | null
interface AuthCtx {
  session: Session | null; profile: Profile | null; loading: boolean; effRole: Eff
  can: (cap: string) => boolean
  signIn: (name: string, pw: string) => Promise<string | null>
  signUp: (name: string, pw: string) => Promise<string | null>
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
}
const Ctx = createContext<AuthCtx>(null as unknown as AuthCtx)
export const useAuth = () => useContext(Ctx)

const norm = (n: string) => n.trim().toLowerCase().replace(/[^a-z0-9._-]/g, '')
const toEmail = (n: string) => `${norm(n)}@${EMAIL_DOMAIN}`
// Empty password → the name itself is the password (name = password).
const toPassword = (n: string, pw: string) => (pw.trim() ? pw : norm(n)) + PASSWORD_SUFFIX

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [matrix, setMatrix] = useState<Perm[]>([])
  const [loading, setLoading] = useState(true)

  const loadProfile = useCallback(async (uid: string) => {
    const p = await supabase.from('profiles').select('*').eq('id', uid).maybeSingle()
    setProfile((p.data as Profile) || null)
    const m = await supabase.from('permission_matrix').select('*').order('sort')
    setMatrix((m.data || []) as Perm[])
  }, [])

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session)
      if (data.session) await loadProfile(data.session.user.id)
      setLoading(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s)
      if (s) setTimeout(() => loadProfile(s.user.id), 0)
      else { setProfile(null); setMatrix([]) }
    })
    return () => sub.subscription.unsubscribe()
  }, [loadProfile])

  const effRole: Eff =
    profile && profile.account_status === 'accepted'
      ? profile.role === 'admin' ? 'admin' : profile.role === 'head' && profile.elevated ? 'head' : 'staff'
      : null

  const can = (cap: string) => {
    if (effRole === 'admin') return true
    if (!effRole) return false
    const row = matrix.find((m) => m.capability === cap)
    return !!(row && (effRole === 'head' ? row.role_head : row.role_staff))
  }

  const afterLogin = async () => { await supabase.rpc('record_login', { ua: navigator.userAgent }) }

  const signIn = async (name: string, pw: string) => {
    if (!norm(name)) return 'Use letters or numbers in your name.'
    const { error } = await supabase.auth.signInWithPassword({ email: toEmail(name), password: toPassword(name, pw) })
    if (error) return /invalid/i.test(error.message) ? 'Name or password not recognised. New here? Tap Request access.' : error.message
    await afterLogin()
    return null
  }
  const signUp = async (name: string, pw: string) => {
    if (!norm(name)) return 'Use letters or numbers in your name.'
    const { data, error } = await supabase.auth.signUp({
      email: toEmail(name), password: toPassword(name, pw),
      options: { data: { username: norm(name), display_name: name.trim() } }
    })
    if (error) return /registered/i.test(error.message) ? 'That name is taken. Try Sign in, or add a surname.' : error.message
    if (!data.session) return 'Account created, but Supabase still requires email confirmation. Turn off “Confirm email” (Authentication → Providers → Email).'
    await afterLogin()
    return null
  }
  const signOut = async () => { await supabase.auth.signOut() }
  const refreshProfile = async () => { if (session) await loadProfile(session.user.id) }

  return (
    <Ctx.Provider value={{ session, profile, loading, effRole, can, signIn, signUp, signOut, refreshProfile }}>
      {children}
    </Ctx.Provider>
  )
}
