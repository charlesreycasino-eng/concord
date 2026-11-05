import { useEffect, useState } from 'react'
import { supabase } from './supabase'
import { AuthProvider, useAuth } from './lib/auth'
import { DataProvider, useData } from './lib/data'
import { ToastProvider, Modal, useToast } from './ui'
import { APP_NAME } from './config'
import { buildPrompts } from './lib/prompts'
import Login from './views/Login'
import Meeting from './views/Meeting'
import Followups from './views/Followups'
import Polls from './views/Polls'
import Settings from './views/Settings'

type Tab = 'meeting' | 'followups' | 'polls' | 'settings'

export default function App() {
  return (
    <ToastProvider>
      <AuthProvider><Root /></AuthProvider>
    </ToastProvider>
  )
}

function Root() {
  const { session, profile, loading, signOut, refreshProfile } = useAuth()
  if (loading) return <main className="center-screen"><p>Loading…</p></main>
  if (!session) return <Login />
  if (!profile) {
    return (
      <main className="center-screen">
        <h1>{APP_NAME}</h1>
        <p>Your account exists but its profile is missing. Run supabase/schema.sql in Supabase, then try again.</p>
        <button className="btn" onClick={refreshProfile}>Try again</button>
        <button className="btn ghost" onClick={signOut}>Sign out</button>
      </main>
    )
  }
  if (profile.account_status !== 'accepted') {
    return (
      <main className="center-screen">
        <h1>{APP_NAME}</h1>
        <p>{profile.account_status === 'blocked' ? 'Your access has been blocked. Please contact Admin.' : `Hi ${profile.display_name}, your request is waiting for Admin approval.`}</p>
        <button className="btn" onClick={refreshProfile}>Check again</button>
        <button className="btn ghost" onClick={signOut}>Sign out</button>
      </main>
    )
  }
  return <DataProvider><Shell /></DataProvider>
}

function Shell() {
  const { profile, can, signOut, refreshProfile } = useAuth()
  const { d, error, setting, today } = useData()
  const [tab, setTab] = useState<Tab>('meeting')
  const [me, setMe] = useState(false)
  const [online, setOnline] = useState(navigator.onLine)
  useEffect(() => {
    const on = () => setOnline(true), off = () => setOnline(false)
    window.addEventListener('online', on); window.addEventListener('offline', off)
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off) }
  }, [])
  const prompts = can('view_prompts') ? buildPrompts(d, setting, today).length : 0
  const showSettings = can('open_settings')
  const t: [Tab, string][] = [['meeting', 'Meeting'], ['followups', 'Follow-ups'], ['polls', 'Polls']]

  return (
    <div className="shell">
      <header className="top">
        <strong className="brand">{APP_NAME}</strong>
        <span className="grow" />
        {showSettings && (
          <button className={'icon-btn' + (tab === 'settings' ? ' on' : '')} onClick={() => setTab('settings')} aria-label="Settings">
            ⚙{prompts > 0 && <i className="pip">{prompts}</i>}
          </button>
        )}
        <button className="chip" onClick={() => setMe(true)}>{profile?.display_name}</button>
      </header>
      {!online && <p className="banner">You are offline. Changes will not save until you reconnect.</p>}
      {error && <p className="banner bad">Could not load data: {error}. If this is a new project, run supabase/schema.sql.</p>}
      <main>
        {tab === 'meeting' && <Meeting />}
        {tab === 'followups' && <Followups />}
        {tab === 'polls' && <Polls />}
        {tab === 'settings' && showSettings && <Settings />}
      </main>
      <nav className="tabs">
        {t.map(([k, l]) => <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}</button>)}
      </nav>
      {me && <MyAccount onClose={() => setMe(false)} onSaved={refreshProfile} signOut={signOut} />}
    </div>
  )
}

function MyAccount({ onClose, onSaved, signOut }: { onClose: () => void; onSaved: () => Promise<void>; signOut: () => Promise<void> }) {
  const { profile } = useAuth()
  const toast = useToast()
  const [name, setName] = useState(profile?.display_name || '')
  const [tg, setTg] = useState(profile?.telegram_username || '')
  if (!profile) return null
  const save = async () => {
    const { error } = await supabase.from('profiles').update({ display_name: name.trim() || profile.display_name, telegram_username: tg.replace(/^@/, '').trim() || null }).eq('id', profile.id)
    if (error) { toast(error.message, true); return }
    await onSaved(); toast('Saved'); onClose()
  }
  return (
    <Modal title="My account" onClose={onClose}>
      <label>Display name<input value={name} onChange={(e) => setName(e.target.value)} /></label>
      <label>Telegram username <small>(without @)</small><input value={tg} onChange={(e) => setTg(e.target.value)} /></label>
      <button className="btn primary" onClick={save}>Save changes</button>
      <button className="btn ghost" onClick={signOut}>Sign out</button>
    </Modal>
  )
}
