import { createContext, useCallback, useContext, useEffect, useState, ReactNode } from 'react'
import { supabase } from '../supabase'
import { useAuth } from './auth'
import { useToast } from '../ui'
import { SETTING_DEFAULTS } from '../config'
import { todayIn } from './dates'
import type { AutoRule, ChecklistItem, Department, Discussion, FollowUp, Participant, Poll, PollRecipient, PollResponse, Profile, Setting } from '../types'

export interface DataState {
  profiles: Profile[]; discussions: Discussion[]; checklist: ChecklistItem[]; participants: Participant[]
  followups: FollowUp[]; polls: Poll[]; recipients: PollRecipient[]; responses: PollResponse[]
  settings: Setting[]; departments: Department[]; rules: AutoRule[]
}
const empty: DataState = {
  profiles: [], discussions: [], checklist: [], participants: [], followups: [], polls: [],
  recipients: [], responses: [], settings: [], departments: [], rules: []
}
const TABLES: [keyof DataState, string][] = [
  ['profiles', 'profiles'], ['discussions', 'discussions'], ['checklist', 'checklist_items'],
  ['participants', 'discussion_participants'], ['followups', 'follow_up_items'], ['polls', 'polls'],
  ['recipients', 'poll_recipients'], ['responses', 'poll_responses'], ['settings', 'app_settings'],
  ['departments', 'departments'], ['rules', 'auto_add_rules']
]

interface DataCtx {
  d: DataState; version: number; error: string; loaded: boolean; today: string
  reload: () => Promise<void>
  act: (p: PromiseLike<{ error: { message: string } | null }>, ok?: string) => Promise<boolean>
  setting: (k: string) => string
  nameOf: (id?: string | null) => string
}
const Ctx = createContext<DataCtx>(null as unknown as DataCtx)
export const useData = () => useContext(Ctx)

export function DataProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth()
  const toast = useToast()
  const [d, setD] = useState<DataState>(empty)
  const [version, setVersion] = useState(0)
  const [error, setError] = useState('')
  const [loaded, setLoaded] = useState(false)

  const reload = useCallback(async () => {
    const res = await Promise.all(TABLES.map(([, t]) => supabase.from(t).select('*')))
    const bad = res.find((r) => r.error)
    setError(bad?.error ? bad.error.message : '')
    const next: any = { ...empty }
    res.forEach((r, i) => { next[TABLES[i][0]] = r.data || [] })
    setD(next as DataState)
    setVersion((v) => v + 1)
    setLoaded(true)
  }, [])

  useEffect(() => {
    if (!session) return
    reload()
    const onFocus = () => { if (document.visibilityState === 'visible') reload() }
    document.addEventListener('visibilitychange', onFocus)
    window.addEventListener('online', onFocus)
    const t = setInterval(onFocus, 60000)
    return () => { document.removeEventListener('visibilitychange', onFocus); window.removeEventListener('online', onFocus); clearInterval(t) }
  }, [session, reload])

  const act: DataCtx['act'] = useCallback(async (p, ok) => {
    const { error: e } = await p
    if (e) { toast(e.message, true); return false }
    if (ok) toast(ok)
    await reload()
    return true
  }, [reload, toast])

  const setting = (k: string) => d.settings.find((s) => s.key === k)?.value ?? SETTING_DEFAULTS[k] ?? ''
  const nameOf = (id?: string | null) => d.profiles.find((p) => p.id === id)?.display_name || 'Unknown'
  const today = todayIn(setting('timezone'))

  return <Ctx.Provider value={{ d, version, error, loaded, today, reload, act, setting, nameOf }}>{children}</Ctx.Provider>
}
