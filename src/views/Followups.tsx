import { useState } from 'react'
import { supabase } from '../supabase'
import { useAuth } from '../lib/auth'
import { useData } from '../lib/data'
import { Empty, Modal, Progress, StatusBadge } from '../ui'
import { addDays, addMonths, fmtDate, fmtDateTime, iso, parse, startOfWeek } from '../lib/dates'
import DiscussionModal from './DiscussionModal'
import { useEffect } from 'react'
import type { Note } from '../types'

interface Tile { key: string; kind: 'f' | 'd'; id: string; date: string; title: string; who: string; done: number; total: number; status?: string }

export default function Followups() {
  const { d, nameOf, today } = useData()
  const { can } = useAuth()
  const [mode, setMode] = useState<'week' | 'month'>('week')
  const [cursor, setCursor] = useState(today)
  const [sel, setSel] = useState(today)
  const [openD, setOpenD] = useState<string | null>(null)
  const [openF, setOpenF] = useState<string | 'new' | null>(null)

  const prog = (discId: string | null) => {
    const its = d.checklist.filter((c) => c.discussion_id === discId)
    return { done: its.filter((c) => c.is_complete).length, total: its.length }
  }
  const tiles: Tile[] = [
    ...d.followups.filter((f) => !f.deleted_at).map((f) => ({
      key: 'f' + f.id, kind: 'f' as const, id: f.id, date: f.due_date, title: f.title,
      who: nameOf(f.owner_id || f.creator_id), ...prog(f.linked_discussion_id)
    })),
    ...d.discussions.filter((x) => !x.deleted_at && x.d_date).map((x) => ({
      key: 'd' + x.id, kind: 'd' as const, id: x.id, date: x.d_date as string, title: x.title,
      who: nameOf(x.creator_id), status: x.status, ...prog(x.id)
    }))
  ]
  const on = (day: string) => tiles.filter((t) => t.date === day)

  const days = mode === 'week'
    ? Array.from({ length: 7 }, (_, i) => addDays(startOfWeek(cursor), i))
    : Array.from({ length: 42 }, (_, i) => addDays(startOfWeek(iso(new Date(parse(cursor).getFullYear(), parse(cursor).getMonth(), 1))), i))
  const move = (dir: number) => setCursor(mode === 'week' ? addDays(cursor, 7 * dir) : addMonths(cursor, dir))
  const label = mode === 'month'
    ? parse(cursor).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
    : `${fmtDate(days[0])} – ${fmtDate(days[6])}`

  const open = (t: Tile) => (t.kind === 'd' ? setOpenD(t.id) : setOpenF(t.id))
  const TileBtn = ({ t }: { t: Tile }) => (
    <button className={'tile ' + (t.kind === 'd' ? 'tile-d' : 'tile-f')} onClick={() => open(t)}>
      <span className="muted small">{t.kind === 'd' ? 'D-date' : 'Follow-up'} · {t.who}</span>
      <strong>{t.title}</strong>
      {t.status && <StatusBadge s={t.status as any} />}
      {t.total > 0 && <Progress done={t.done} total={t.total} />}
    </button>
  )

  return (
    <div className="page">
      <div className="toolbar">
        <h1>Follow-ups</h1>
        <div className="grow" />
        <button className={'btn ' + (mode === 'week' ? 'primary' : 'ghost')} onClick={() => setMode('week')}>Week</button>
        <button className={'btn ' + (mode === 'month' ? 'primary' : 'ghost')} onClick={() => setMode('month')}>Month</button>
      </div>
      <div className="toolbar">
        <button className="btn ghost" onClick={() => move(-1)} aria-label="Previous">‹</button>
        <strong className="grow center">{label}</strong>
        <button className="btn ghost" onClick={() => setCursor(today)}>Today</button>
        <button className="btn ghost" onClick={() => move(1)} aria-label="Next">›</button>
      </div>

      {mode === 'week' ? (
        days.map((day) => (
          <section key={day} className={'day' + (day === today ? ' today' : '')}>
            <h3>{parse(day).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'short' })}</h3>
            {on(day).length === 0 ? <p className="empty small">Nothing due.</p> : on(day).map((t) => <TileBtn key={t.key} t={t} />)}
          </section>
        ))
      ) : (
        <>
          <div className="month">
            {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((c, i) => <b key={i} className="dow">{c}</b>)}
            {days.map((day) => {
              const n = on(day).length
              const other = parse(day).getMonth() !== parse(cursor).getMonth()
              return (
                <button key={day} className={'cell' + (other ? ' other' : '') + (day === today ? ' today' : '') + (day === sel ? ' sel' : '')} onClick={() => setSel(day)}>
                  <span>{parse(day).getDate()}</span>
                  {n > 0 && <i className="dot">{n}</i>}
                </button>
              )
            })}
          </div>
          <section className="day">
            <h3>{fmtDate(sel)}</h3>
            {on(sel).length === 0 ? <Empty text="Nothing due on this day." /> : on(sel).map((t) => <TileBtn key={t.key} t={t} />)}
          </section>
        </>
      )}

      {can('create_followup') && <button className="fab" onClick={() => setOpenF('new')}>＋ Follow-up</button>}
      {openD && <DiscussionModal id={openD} onClose={() => setOpenD(null)} />}
      {openF && <FollowupModal id={openF} onClose={() => setOpenF(null)} />}
    </div>
  )
}

function FollowupModal({ id, onClose }: { id: string; onClose: () => void }) {
  const { d, act, nameOf, version, today, reload } = useData()
  const { profile, effRole } = useAuth()
  const f = id === 'new' ? null : d.followups.find((v) => v.id === id) || null
  const [title, setTitle] = useState(f?.title || '')
  const [desc, setDesc] = useState(f?.description || '')
  const [due, setDue] = useState(f?.due_date || today)
  const [owner, setOwner] = useState(f?.owner_id || '')
  const [link, setLink] = useState(f?.linked_discussion_id || '')
  const [notes, setNotes] = useState<Note[]>([])
  const [note, setNote] = useState('')

  useEffect(() => {
    if (!f) return
    supabase.from('notes').select('*').eq('follow_up_id', f.id).order('created_at').then((r) => setNotes((r.data || []) as Note[]))
  }, [f?.id, version])

  if (!profile) return null
  const mine = !f || f.creator_id === profile.id || effRole === 'admin' || effRole === 'head'
  const body = { title: title.trim(), description: desc, due_date: due, owner_id: owner || null, linked_discussion_id: link || null }

  const save = async () => {
    if (!title.trim()) return
    const q = f
      ? supabase.from('follow_up_items').update(body).eq('id', f.id)
      : supabase.from('follow_up_items').insert({ ...body, creator_id: profile.id })
    if (await act(q, 'Saved')) onClose()
  }
  const addNote = async () => {
    if (!f || !note.trim()) return
    if (await act(supabase.from('notes').insert({ follow_up_id: f.id, author_id: profile.id, body: note.trim() }), 'Note added')) setNote('')
  }
  const archive = async () => {
    if (!f || !window.confirm('Remove this follow-up?')) return
    if (await act(supabase.from('follow_up_items').update({ deleted_at: new Date().toISOString() }).eq('id', f.id), 'Removed')) onClose()
  }
  void reload

  return (
    <Modal title={f ? 'Follow-up' : 'New follow-up'} onClose={onClose}>
      <label>Title<input value={title} disabled={!mine} onChange={(e) => setTitle(e.target.value)} /></label>
      <label>Details<textarea rows={3} value={desc} disabled={!mine} onChange={(e) => setDesc(e.target.value)} /></label>
      <label>Due date<input type="date" value={due} disabled={!mine} onChange={(e) => setDue(e.target.value)} /></label>
      <label>Assigned to
        <select value={owner} disabled={!mine} onChange={(e) => setOwner(e.target.value)}>
          <option value="">Me / unassigned</option>
          {d.profiles.filter((p) => p.account_status === 'accepted').map((p) => <option key={p.id} value={p.id}>{p.display_name}</option>)}
        </select>
      </label>
      <label>Linked discussion <small>(optional)</small>
        <select value={link} disabled={!mine} onChange={(e) => setLink(e.target.value)}>
          <option value="">None</option>
          {d.discussions.filter((x) => !x.deleted_at).map((x) => <option key={x.id} value={x.id}>D-{x.seq} {x.title}</option>)}
        </select>
      </label>
      {mine && <button className="btn primary" onClick={save} disabled={!title.trim()}>{f ? 'Save changes' : 'Add follow-up'}</button>}
      {f && (
        <>
          <h3>Notes</h3>
          {notes.length === 0 && <p className="empty">No notes yet.</p>}
          {notes.map((n) => <p key={n.id} className="note"><b>{nameOf(n.author_id)}</b> <span className="muted small">{fmtDateTime(n.created_at)}</span><br />{n.body}</p>)}
          <div className="row">
            <input placeholder="Add a note" value={note} onChange={(e) => setNote(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') addNote() }} />
            <button className="btn" onClick={addNote}>Post</button>
          </div>
          {mine && <button className="btn danger" onClick={archive}>Remove follow-up</button>}
        </>
      )}
    </Modal>
  )
}
