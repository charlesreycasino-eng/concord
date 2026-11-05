import { useEffect, useState } from 'react'
import { supabase } from '../supabase'
import { useAuth } from '../lib/auth'
import { useData } from '../lib/data'
import { NEXT, STATUS_META, Status } from '../config'
import { Modal, Progress, StatusBadge } from '../ui'
import { describeLog } from '../lib/describe'
import { fmtDate, fmtDateTime } from '../lib/dates'
import type { Log, Note } from '../types'

export default function DiscussionModal({ id, onClose }: { id: string; onClose: () => void }) {
  const { d, act, nameOf, version, reload } = useData()
  const { profile, can, effRole } = useAuth()
  const x = d.discussions.find((v) => v.id === id)
  const [title, setTitle] = useState(x?.title || '')
  const [desc, setDesc] = useState(x?.description || '')
  const [dd, setDd] = useState(x?.d_date || '')
  const [notes, setNotes] = useState<Note[]>([])
  const [logs, setLogs] = useState<Log[]>([])
  const [note, setNote] = useState('')
  const [newItem, setNewItem] = useState('')
  const [next, setNext] = useState('')
  const [statusNote, setStatusNote] = useState('')
  const [pAdd, setPAdd] = useState('')

  useEffect(() => { setTitle(x?.title || ''); setDesc(x?.description || ''); setDd(x?.d_date || '') }, [x?.updated_at])
  useEffect(() => {
    ;(async () => {
      const n = await supabase.from('notes').select('*').eq('discussion_id', id).order('created_at')
      setNotes((n.data || []) as Note[])
      const l = await supabase.from('activity_logs').select('*').eq('parent_id', id).order('created_at', { ascending: false }).limit(60)
      setLogs((l.data || []) as Log[])
    })()
  }, [id, version])

  if (!x || !profile) return null

  const items = d.checklist.filter((c) => c.discussion_id === id).sort((a, b) => a.sort_order - b.sort_order)
  const parts = d.participants.filter((p) => p.discussion_id === id)
  const elevated = effRole === 'admin' || effRole === 'head'
  const isPart = parts.some((p) => p.user_id === profile.id)
  const canTick = elevated || isPart
  const canAddItem = can('add_checklist') && canTick
  const canText = can('edit_after_decision') || (x.creator_id === profile.id && (x.status === 'gathering' || x.status === 'unresolved'))
  const canDate = can('set_d_date')
  const canStatus = can('change_status')
  const nexts = NEXT[x.status]

  const saveDetails = () =>
    act(supabase.from('discussions').update({ title: title.trim() || x.title, description: desc, d_date: dd || x.d_date }).eq('id', id), 'Saved')
  const dirty = title !== x.title || desc !== x.description || (dd || '') !== (x.d_date || '')

  const changeStatus = async () => {
    if (!next) return
    const label = STATUS_META[next as Status].label
    if (!window.confirm(`Move this discussion to ${label}?`)) return
    const ok = await act(supabase.from('discussions').update({ status: next }).eq('id', id), `Moved to ${label}`)
    if (ok && statusNote.trim()) {
      await supabase.from('notes').insert({ discussion_id: id, author_id: profile.id, body: `Status → ${label}: ${statusNote.trim()}` })
      await reload()
    }
    setNext(''); setStatusNote('')
  }

  const addNote = async () => {
    if (!note.trim()) return
    const ok = await act(supabase.from('notes').insert({ discussion_id: id, author_id: profile.id, body: note.trim() }), 'Note added')
    if (ok) setNote('')
  }
  const addItem = async () => {
    if (!newItem.trim()) return
    const max = items.reduce((m, c) => Math.max(m, c.sort_order), -1)
    const ok = await act(supabase.from('checklist_items').insert({ discussion_id: id, title: newItem.trim(), sort_order: max + 1 }), 'Item added')
    if (ok) setNewItem('')
  }
  const archive = async () => {
    const msg = x.deleted_at ? 'Restore this discussion to the board?' : 'Move this discussion to Old? It stays recoverable.'
    if (!window.confirm(msg)) return
    if (await act(supabase.from('discussions').update({ deleted_at: x.deleted_at ? null : new Date().toISOString() }).eq('id', id), 'Updated')) onClose()
  }
  const addPart = async () => {
    if (!pAdd) return
    if (await act(supabase.from('discussion_participants').insert({ discussion_id: id, user_id: pAdd }), 'Participant added')) setPAdd('')
  }
  const people = d.profiles.filter((p) => p.account_status === 'accepted' && !parts.some((q) => q.user_id === p.id))

  return (
    <Modal title={`D-${x.seq}`} onClose={onClose}>
      <div className="row wrap">
        <StatusBadge s={x.status} />
        <span className="muted">Owner: {nameOf(x.creator_id)}</span>
        {x.deleted_at && <span className="badge">Old</span>}
      </div>
      {x.decision_at && <p className="hint">{x.decision_type === 'approved' ? 'Approved' : 'Agreed'} on {fmtDate(x.decision_at.slice(0, 10))}</p>}
      {x.status === 'unresolved' && x.review_on && <p className="hint">Second review on {fmtDate(x.review_on)}</p>}

      <label>Title<input value={title} disabled={!canText} onChange={(e) => setTitle(e.target.value)} /></label>
      <label>Remarks<textarea rows={3} value={desc} disabled={!canText} onChange={(e) => setDesc(e.target.value)} /></label>
      <label>D-date {x.d_date_auto && <small>(auto-set)</small>}
        <input type="date" value={dd} disabled={!canDate} onChange={(e) => setDd(e.target.value)} />
      </label>
      {dirty && (canText || canDate) && <button className="btn primary" onClick={saveDetails}>Save changes</button>}

      {canStatus && nexts.length > 0 && (
        <div className="panel">
          <label>Change status
            <select value={next} onChange={(e) => setNext(e.target.value)}>
              <option value="">Choose…</option>
              {nexts.map((s) => <option key={s} value={s}>{STATUS_META[s].label}</option>)}
            </select>
          </label>
          {next && (
            <>
              <label>Note <small>(optional)</small><input value={statusNote} onChange={(e) => setStatusNote(e.target.value)} /></label>
              <button className="btn primary" onClick={changeStatus}>Confirm change</button>
            </>
          )}
        </div>
      )}

      <h3>Checklist</h3>
      <Progress done={items.filter((c) => c.is_complete).length} total={items.length} />
      {!canTick && <p className="hint">Ask Admin to add you to this topic to tick items.</p>}
      <ul className="checks">
        {items.map((c) => (
          <li key={c.id}>
            <label className="check">
              <input type="checkbox" checked={c.is_complete} disabled={!canTick}
                onChange={() => act(supabase.from('checklist_items').update({ is_complete: !c.is_complete }).eq('id', c.id))} />
              <span className={c.is_complete ? 'done' : ''}>{c.title}</span>
            </label>
            <input className="remark" placeholder="Remark" defaultValue={c.remarks || ''} disabled={!canTick}
              onBlur={(e) => { if (e.target.value !== (c.remarks || '')) act(supabase.from('checklist_items').update({ remarks: e.target.value }).eq('id', c.id), 'Saved') }} />
            {elevated && can('add_checklist') && (
              <button className="icon-btn" aria-label="Delete item"
                onClick={() => { if (window.confirm(`Delete “${c.title}”?`)) act(supabase.from('checklist_items').delete().eq('id', c.id), 'Item removed') }}>🗑</button>
            )}
          </li>
        ))}
      </ul>
      {canAddItem && (
        <div className="row">
          <input placeholder="New checklist item" value={newItem} onChange={(e) => setNewItem(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') addItem() }} />
          <button className="btn" onClick={addItem}>Add</button>
        </div>
      )}

      <h3>Participants</h3>
      <div className="row wrap">
        {parts.map((p) => (
          <span key={p.user_id} className="chip">{nameOf(p.user_id)}
            {can('add_participants') && p.user_id !== x.creator_id && (
              <button className="x" aria-label={`Remove ${nameOf(p.user_id)}`}
                onClick={() => act(supabase.from('discussion_participants').delete().eq('discussion_id', id).eq('user_id', p.user_id))}>✕</button>
            )}
          </span>
        ))}
      </div>
      {can('add_participants') && (
        <div className="row">
          <select value={pAdd} onChange={(e) => setPAdd(e.target.value)}>
            <option value="">Add person…</option>
            {people.map((p) => <option key={p.id} value={p.id}>{p.display_name}</option>)}
          </select>
          <button className="btn" onClick={addPart} disabled={!pAdd}>Add</button>
        </div>
      )}

      <h3>Notes</h3>
      {notes.length === 0 && <p className="empty">No notes yet.</p>}
      {notes.map((n) => (
        <p key={n.id} className="note"><b>{nameOf(n.author_id)}</b> <span className="muted small">{fmtDateTime(n.created_at)}</span><br />{n.body}</p>
      ))}
      <div className="row">
        <input placeholder="Add a note" value={note} onChange={(e) => setNote(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') addNote() }} />
        <button className="btn" onClick={addNote}>Post</button>
      </div>

      <details className="acc">
        <summary>History</summary>
        {logs.length === 0 && <p className="empty">No history yet.</p>}
        {logs.map((l) => (
          <p key={l.id} className="small"><b>{l.actor_name}</b> · {describeLog(l, nameOf)} <span className="muted">{fmtDateTime(l.created_at)}</span></p>
        ))}
      </details>

      {canStatus && <button className="btn danger" onClick={archive}>{x.deleted_at ? 'Restore from Old' : 'Move to Old'}</button>}
    </Modal>
  )
}
