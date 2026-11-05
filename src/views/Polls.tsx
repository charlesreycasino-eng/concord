import { useState } from 'react'
import { supabase } from '../supabase'
import { useAuth } from '../lib/auth'
import { useData } from '../lib/data'
import { Empty, Modal, useToast } from '../ui'
import { fmtDateTime } from '../lib/dates'
import type { Poll } from '../types'

type Sort = 'new' | 'updated' | 'latest' | 'oldest'

export default function Polls() {
  const { d, act, nameOf } = useData()
  const { profile, can } = useAuth()
  const [filter, setFilter] = useState<'open' | 'closed' | 'old' | 'all'>('open')
  const [disc, setDisc] = useState('')
  const [mineOnly, setMineOnly] = useState(false)
  const [sort, setSort] = useState<Sort>('new')
  const [creating, setCreating] = useState(false)
  const [expanded, setExpanded] = useState<string | null>(null)
  if (!profile) return null

  const accepted = d.profiles.filter((p) => p.account_status === 'accepted')
  const inAudience = (p: Poll) => p.audience_all || d.recipients.some((r) => r.poll_id === p.id && r.user_id === profile.id)
  const resp = (p: Poll) => d.responses.filter((r) => r.poll_id === p.id)
  const stamp = (p: Poll, pick: 'max' | 'min') => {
    const t = resp(p).map((r) => new Date(r.updated_at).getTime())
    return t.length ? (pick === 'max' ? Math.max(...t) : Math.min(...t)) : pick === 'max' ? 0 : Infinity
  }

  let list = d.polls.filter((p) => {
    if (filter === 'old') return !!p.deleted_at
    if (p.deleted_at) return false
    return filter === 'all' || p.status === filter
  })
  if (disc) list = list.filter((p) => p.linked_discussion_id === disc)
  if (mineOnly) list = list.filter(inAudience)
  list = [...list].sort((a, b) =>
    sort === 'new' ? b.created_at.localeCompare(a.created_at)
    : sort === 'updated' ? b.updated_at.localeCompare(a.updated_at)
    : sort === 'latest' ? stamp(b, 'max') - stamp(a, 'max')
    : stamp(a, 'min') - stamp(b, 'min'))

  return (
    <div className="page">
      <div className="toolbar"><h1>Polls</h1></div>
      <div className="filters">
        <select value={filter} onChange={(e) => setFilter(e.target.value as any)} aria-label="Status">
          <option value="open">Open</option><option value="closed">Closed</option><option value="old">Old</option><option value="all">All</option>
        </select>
        <select value={disc} onChange={(e) => setDisc(e.target.value)} aria-label="Linked discussion">
          <option value="">Any discussion</option>
          {d.discussions.filter((x) => !x.deleted_at).map((x) => <option key={x.id} value={x.id}>D-{x.seq} {x.title}</option>)}
        </select>
        <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} aria-label="Sort">
          <option value="new">Newest poll</option><option value="updated">Recently updated</option>
          <option value="latest">Latest response</option><option value="oldest">Oldest response</option>
        </select>
        <label className="check inline"><input type="checkbox" checked={mineOnly} onChange={(e) => setMineOnly(e.target.checked)} /> For me</label>
      </div>
      {list.length === 0 && <Empty text="No polls match. Create one with the button below." />}
      {list.map((p) => {
        const rs = resp(p)
        const total = p.audience_all ? accepted.length : d.recipients.filter((r) => r.poll_id === p.id).length
        const mine = rs.find((r) => r.user_id === profile.id)
        const count = (v: string) => rs.filter((r) => r.response === v).length
        const link = d.discussions.find((x) => x.id === p.linked_discussion_id)
        return (
          <article className="poll" key={p.id}>
            <div className="row wrap">
              <span className={'badge ' + (p.status === 'open' ? 'st-agreed' : 'st-resolved')}>{p.status === 'open' ? 'Open' : 'Closed'}</span>
              {p.deleted_at && <span className="badge">Old</span>}
              {link && <span className="muted small">D-{link.seq}</span>}
              <span className="grow" />
              <span className="muted small">{nameOf(p.creator_id)} · {fmtDateTime(p.created_at)}</span>
            </div>
            <strong>{p.question}</strong>
            <p className="small">{rs.length}/{total} responded · Yes {count('Yes')} · Some {count('Some')} · No {count('No')}</p>
            {p.status === 'open' && !p.deleted_at && inAudience(p) && (
              <div className="seg" role="group" aria-label="Your answer">
                {(['Yes', 'Some', 'No'] as const).map((v) => (
                  <button key={v} className={'btn ' + (mine?.response === v ? 'primary' : 'ghost')}
                    onClick={() => act(supabase.from('poll_responses').upsert({ poll_id: p.id, user_id: profile.id, response: v }, { onConflict: 'poll_id,user_id' }), 'Answer saved')}>{v}</button>
                ))}
              </div>
            )}
            <div className="row wrap">
              <button className="btn ghost" onClick={() => setExpanded(expanded === p.id ? null : p.id)}>{expanded === p.id ? 'Hide responses' : 'Show responses'}</button>
              {can('manage_polls') && (
                <>
                  <button className="btn ghost" onClick={() => act(supabase.from('polls').update({ status: p.status === 'open' ? 'closed' : 'open' }).eq('id', p.id), 'Updated')}>{p.status === 'open' ? 'Close' : 'Reopen'}</button>
                  <button className="btn ghost" onClick={() => { if (window.confirm(p.deleted_at ? 'Restore this poll?' : 'Move this poll to Old?')) act(supabase.from('polls').update({ deleted_at: p.deleted_at ? null : new Date().toISOString() }).eq('id', p.id), 'Updated') }}>{p.deleted_at ? 'Restore' : 'Move to Old'}</button>
                </>
              )}
            </div>
            {expanded === p.id && (
              <ul className="plain">
                {(p.audience_all ? accepted : accepted.filter((a) => d.recipients.some((r) => r.poll_id === p.id && r.user_id === a.id))).map((a) => {
                  const r = rs.find((q) => q.user_id === a.id)
                  return <li key={a.id}><b>{a.display_name}</b>: {r ? `${r.response} · ${fmtDateTime(r.updated_at)}` : <span className="muted">no answer yet</span>}</li>
                })}
              </ul>
            )}
          </article>
        )
      })}
      {can('create_poll') && <button className="fab" onClick={() => setCreating(true)}>＋ New poll</button>}
      {creating && <NewPoll onClose={() => setCreating(false)} />}
    </div>
  )
}

function NewPoll({ onClose }: { onClose: () => void }) {
  const { d, reload } = useData()
  const { profile } = useAuth()
  const toast = useToast()
  const [q, setQ] = useState('')
  const [all, setAll] = useState(true)
  const [who, setWho] = useState<string[]>([])
  const [link, setLink] = useState('')
  const [busy, setBusy] = useState(false)
  const accepted = d.profiles.filter((p) => p.account_status === 'accepted')

  const save = async () => {
    if (!q.trim() || !profile) return
    setBusy(true)
    const r = await supabase.from('polls')
      .insert({ question: q.trim(), creator_id: profile.id, audience_all: all, linked_discussion_id: link || null })
      .select().single()
    if (r.error || !r.data) { toast(r.error?.message || 'Could not save', true); setBusy(false); return }
    if (!all && who.length) {
      const rr = await supabase.from('poll_recipients').insert(who.map((u) => ({ poll_id: r.data.id, user_id: u })))
      if (rr.error) toast(rr.error.message, true)
    }
    await reload(); toast('Poll created'); onClose()
  }

  return (
    <Modal title="New poll" onClose={onClose}>
      <label>Question<textarea rows={3} value={q} onChange={(e) => setQ(e.target.value)} autoFocus /></label>
      <label>Linked discussion <small>(optional)</small>
        <select value={link} onChange={(e) => setLink(e.target.value)}>
          <option value="">None</option>
          {d.discussions.filter((x) => !x.deleted_at).map((x) => <option key={x.id} value={x.id}>D-{x.seq} {x.title}</option>)}
        </select>
      </label>
      <label className="check"><input type="checkbox" checked={all} onChange={(e) => setAll(e.target.checked)} /> All staff</label>
      {!all && (
        <div className="row wrap">
          {accepted.map((p) => (
            <label key={p.id} className="check chip">
              <input type="checkbox" checked={who.includes(p.id)} onChange={() => setWho(who.includes(p.id) ? who.filter((x) => x !== p.id) : [...who, p.id])} />
              @{p.display_name}
            </label>
          ))}
        </div>
      )}
      <p className="hint">Answers are Yes, Some or No – no written explanation.</p>
      <button className="btn primary" disabled={busy || !q.trim() || (!all && who.length === 0)} onClick={save}>{busy ? 'Saving…' : 'Create poll'}</button>
    </Modal>
  )
}
