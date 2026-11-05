import { useEffect, useState, ReactNode } from 'react'
import { supabase } from '../supabase'
import { useAuth } from '../lib/auth'
import { useData } from '../lib/data'
import { copyText, Empty, useToast } from '../ui'
import { buildPrompts } from '../lib/prompts'
import { describeLog } from '../lib/describe'
import { fmtDate, fmtDateTime } from '../lib/dates'
import type { Log, LoginEvent, Perm, Profile } from '../types'

export default function Settings() {
  const { can, effRole } = useAuth()
  const admin = effRole === 'admin'
  return (
    <div className="page">
      <div className="toolbar"><h1>Settings</h1></div>
      {can('view_prompts') && <Section title="Telegram prompts" open><Prompts /></Section>}
      {admin && <Section title="Accounts"><Accounts /></Section>}
      {admin && <Section title="Roles and access"><Matrix /></Section>}
      {admin && <Section title="Auto-add rules"><AutoAdd /></Section>}
      {admin && <Section title="App settings and templates"><AppSettings /></Section>}
      {can('view_audit') && <Section title="Audit log"><Audit /></Section>}
      {admin && <Section title="Logins"><Logins /></Section>}
    </div>
  )
}

const Section = ({ title, open, children }: { title: string; open?: boolean; children: ReactNode }) => (
  <details className="acc big" open={open}><summary>{title}</summary><div className="acc-body">{children}</div></details>
)

function Prompts() {
  const { d, setting, today } = useData()
  const toast = useToast()
  const list = buildPrompts(d, setting, today)
  const copy = async (t: string) => toast((await copyText(t)) ? 'Copied – paste into Telegram' : 'Copy failed', false)
  if (!list.length) return <Empty text="No prompts due today." />
  return (
    <>
      {list.map((p) => (
        <div className="panel" key={p.key}>
          <div className="row wrap">
            <b>D-{p.disc.seq} {p.disc.title}</b>
            <span className="badge">{p.kind === 'gather' ? 'Gathering check' : 'Implementation check'}</span>
          </div>
          <p className="small muted">
            For {p.owner?.display_name || 'unknown'}{p.owner?.telegram_username ? ` (@${p.owner.telegram_username.replace(/^@/, '')})` : ' – no Telegram username set'} · due {fmtDate(p.dueOn)}
          </p>
          {p.messages.map((m, i) => (
            <div key={i} className="msg">
              <pre>{m.text}</pre>
              <button className="btn" onClick={() => copy(m.text)}>Copy</button>
            </div>
          ))}
          {p.messages.length > 1 && <button className="btn ghost" onClick={() => copy(p.messages.map((m) => m.text).join('\n\n---\n\n'))}>Copy all</button>}
        </div>
      ))}
    </>
  )
}

function Accounts() {
  const { d, act } = useData()
  const { profile } = useAuth()
  const [dept, setDept] = useState('')
  const upd = (id: string, patch: Partial<Profile>, ok = 'Saved') => act(supabase.from('profiles').update(patch).eq('id', id), ok)
  const order = { pending: 0, accepted: 1, blocked: 2 } as const
  const rows = [...d.profiles].sort((a, b) => order[a.account_status] - order[b.account_status] || a.display_name.localeCompare(b.display_name))
  return (
    <>
      {rows.map((p) => (
        <div className="panel" key={p.id}>
          <div className="row wrap">
            <b>{p.display_name}</b><span className="muted small">@{p.username}</span>
            <span className={'badge ' + (p.account_status === 'accepted' ? 'st-agreed' : p.account_status === 'pending' ? 'st-unresolved' : 'st-resolved')}>{p.account_status}</span>
            <span className="grow" />
            {p.id !== profile?.id && p.account_status !== 'accepted' && <button className="btn primary" onClick={() => upd(p.id, { account_status: 'accepted' }, 'Accepted')}>Accept</button>}
            {p.id !== profile?.id && p.account_status !== 'blocked' && <button className="btn danger" onClick={() => { if (window.confirm(`Block ${p.display_name}?`)) upd(p.id, { account_status: 'blocked' }, 'Blocked') }}>Block</button>}
          </div>
          <div className="grid2">
            <label>Role
              <select value={p.role} disabled={p.id === profile?.id} onChange={(e) => upd(p.id, { role: e.target.value as Profile['role'] })}>
                <option value="staff">Staff</option><option value="head">Department Head</option><option value="admin">Admin</option>
              </select>
            </label>
            <label>Department
              <select value={p.department_id || ''} onChange={(e) => upd(p.id, { department_id: e.target.value || null })}>
                <option value="">None</option>
                {d.departments.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
              </select>
            </label>
            <label>Telegram username
              <input defaultValue={p.telegram_username || ''} placeholder="without @"
                onBlur={(e) => { if (e.target.value !== (p.telegram_username || '')) upd(p.id, { telegram_username: e.target.value.replace(/^@/, '') || null }) }} />
            </label>
            {p.role === 'head' && (
              <label className="check"><input type="checkbox" checked={p.elevated} onChange={(e) => upd(p.id, { elevated: e.target.checked })} /> Elevated (head permissions ON)</label>
            )}
          </div>
          {p.last_login_at && <p className="muted small">Last login {fmtDateTime(p.last_login_at)}</p>}
        </div>
      ))}
      <div className="row">
        <input placeholder="New department name" value={dept} onChange={(e) => setDept(e.target.value)} />
        <button className="btn" disabled={!dept.trim()} onClick={async () => { if (await act(supabase.from('departments').insert({ name: dept.trim() }), 'Department added')) setDept('') }}>Add</button>
      </div>
    </>
  )
}

function Matrix() {
  const [rows, setRows] = useState<Perm[]>([])
  const { act, version } = useData()
  useEffect(() => { supabase.from('permission_matrix').select('*').order('sort').then((r) => setRows((r.data || []) as Perm[])) }, [version])
  const set = (cap: string, col: 'role_head' | 'role_staff', v: boolean) =>
    act(supabase.from('permission_matrix').update({ [col]: v }).eq('capability', cap), 'Saved')
  return (
    <>
      <p className="hint">Admin is always Yes. The Head column applies to Heads whose “Elevated” switch is ON; otherwise they get the Staff column.</p>
      <div className="scroll">
        <table className="matrix">
          <thead><tr><th>What</th><th>Admin</th><th>Head</th><th>Staff</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.capability}>
                <td>{r.label}</td>
                <td><input type="checkbox" checked disabled aria-label="Admin" /></td>
                <td><input type="checkbox" checked={r.role_head} aria-label={`Head: ${r.label}`} onChange={(e) => set(r.capability, 'role_head', e.target.checked)} /></td>
                <td><input type="checkbox" checked={r.role_staff} aria-label={`Staff: ${r.label}`} onChange={(e) => set(r.capability, 'role_staff', e.target.checked)} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}

function AutoAdd() {
  const { d, act, nameOf } = useData()
  const [user, setUser] = useState('')
  const [kind, setKind] = useState<'all' | 'only' | 'except'>('all')
  const [kw, setKw] = useState('')
  const add = async () => {
    if (!user || (kind !== 'all' && !kw.trim())) return
    const row = { user_id: user, keyword: kind === 'all' ? null : kw.trim(), is_exception: kind === 'except' }
    if (await act(supabase.from('auto_add_rules').insert(row), 'Rule added')) setKw('')
  }
  return (
    <>
      <p className="hint">Applies when a discussion is created. A person is added if any “add” rule matches and no “except” rule matches the title.</p>
      {d.rules.length === 0 && <Empty text="No rules yet." />}
      {d.rules.map((r) => (
        <div className="row" key={r.id}>
          <span className="grow">{nameOf(r.user_id)}: {r.is_exception ? `never when title contains “${r.keyword}”` : r.keyword ? `add when title contains “${r.keyword}”` : 'add to every discussion'}</span>
          <button className="icon-btn" aria-label="Delete rule" onClick={() => act(supabase.from('auto_add_rules').delete().eq('id', r.id), 'Rule removed')}>🗑</button>
        </div>
      ))}
      <div className="panel">
        <label>Person
          <select value={user} onChange={(e) => setUser(e.target.value)}>
            <option value="">Choose…</option>
            {d.profiles.filter((p) => p.account_status === 'accepted').map((p) => <option key={p.id} value={p.id}>{p.display_name}</option>)}
          </select>
        </label>
        <label>Rule
          <select value={kind} onChange={(e) => setKind(e.target.value as any)}>
            <option value="all">Add to every discussion</option>
            <option value="only">Add when title contains…</option>
            <option value="except">Never add when title contains…</option>
          </select>
        </label>
        {kind !== 'all' && <label>Keyword<input value={kw} onChange={(e) => setKw(e.target.value)} /></label>}
        <button className="btn primary" onClick={add}>Add rule</button>
      </div>
    </>
  )
}

function AppSettings() {
  const { d, act } = useData()
  const long = (k: string) => k.startsWith('tpl_')
  return (
    <>
      <p className="hint">Templates use [Staff Name], [Topic] and [Checklist Item].</p>
      {d.settings.map((s) => (
        <label key={s.key}>{s.label || s.key}
          {long(s.key)
            ? <textarea rows={5} defaultValue={s.value} onBlur={(e) => { if (e.target.value !== s.value) act(supabase.from('app_settings').update({ value: e.target.value }).eq('key', s.key), 'Saved') }} />
            : <input defaultValue={s.value} onBlur={(e) => { if (e.target.value.trim() && e.target.value !== s.value) act(supabase.from('app_settings').update({ value: e.target.value.trim() }).eq('key', s.key), 'Saved') }} />}
        </label>
      ))}
    </>
  )
}

function Audit() {
  const { nameOf, version } = useData()
  const toast = useToast()
  const [logs, setLogs] = useState<Log[]>([])
  const [only, setOnly] = useState('')
  useEffect(() => {
    supabase.from('activity_logs').select('*').order('created_at', { ascending: false }).limit(200).then((r) => setLogs((r.data || []) as Log[]))
  }, [version])
  const shown = only ? logs.filter((l) => l.entity_type === only) : logs
  const aiPrompt = () => {
    const lines = shown.map((l) => JSON.stringify({ at: l.created_at, who: l.actor_name, type: l.entity_type, action: l.action, what: describeLog(l, nameOf) }))
    return [
      'You are an audit assistant for Concord, a small-team coordination app (discussions, follow-ups, polls).',
      'Below is the activity log as JSON lines, newest first.',
      'Tasks: 1) summarise who changed what and when; 2) flag unusual activity (status reversals, repeated D-date changes, deletions, permission or account changes, repeated edits of poll answers); 3) list anything that needs a human follow-up.',
      'Use only the data below. If something is unclear, say so instead of guessing.',
      '', ...lines
    ].join('\n')
  }
  return (
    <>
      <div className="row wrap">
        <select value={only} onChange={(e) => setOnly(e.target.value)} aria-label="Filter">
          <option value="">Everything</option><option value="discussion">Discussions</option><option value="checklist_item">Checklist</option>
          <option value="poll_response">Poll answers</option><option value="poll">Polls</option><option value="profile">Accounts</option><option value="permission">Permissions</option>
        </select>
        <button className="btn primary" onClick={async () => toast((await copyText(aiPrompt())) ? 'Copied – paste into your AI agent' : 'Copy failed')}>Copy for AI</button>
      </div>
      {shown.length === 0 && <Empty text="No activity yet." />}
      {shown.map((l) => <p key={l.id} className="small"><b>{l.actor_name}</b> · {describeLog(l, nameOf)} <span className="muted">{fmtDateTime(l.created_at)}</span></p>)}
    </>
  )
}

function Logins() {
  const [rows, setRows] = useState<LoginEvent[]>([])
  const { version } = useData()
  useEffect(() => { supabase.from('login_events').select('*').order('created_at', { ascending: false }).limit(100).then((r) => setRows((r.data || []) as LoginEvent[])) }, [version])
  if (!rows.length) return <Empty text="No logins recorded yet." />
  return <>{rows.map((r) => <p key={r.id} className="small"><b>{r.username}</b> · {fmtDateTime(r.created_at)} <span className="muted">{(r.user_agent || '').slice(0, 60)}</span></p>)}</>
}
