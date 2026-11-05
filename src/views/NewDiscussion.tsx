import { useState } from 'react'
import { supabase } from '../supabase'
import { useAuth } from '../lib/auth'
import { useData } from '../lib/data'
import { Modal, useToast } from '../ui'

export default function NewDiscussion({ onClose }: { onClose: () => void }) {
  const { profile, can } = useAuth()
  const { reload, setting } = useData()
  const toast = useToast()
  const [title, setTitle] = useState('')
  const [desc, setDesc] = useState('')
  const [items, setItems] = useState('')
  const [dd, setDd] = useState('')
  const [busy, setBusy] = useState(false)

  const save = async () => {
    if (!title.trim() || !profile) return
    setBusy(true)
    const ins = await supabase.from('discussions')
      .insert({ title: title.trim(), description: desc.trim(), d_date: can('set_d_date') && dd ? dd : null, creator_id: profile.id })
      .select().single()
    if (ins.error || !ins.data) { toast(ins.error?.message || 'Could not save', true); setBusy(false); return }
    const lines = items.split('\n').map((s) => s.trim()).filter(Boolean)
    if (lines.length) {
      const r = await supabase.from('checklist_items')
        .insert(lines.map((t, i) => ({ discussion_id: ins.data.id, title: t, sort_order: i })))
      if (r.error) toast(r.error.message, true)
    }
    await reload()
    toast('Discussion created')
    onClose()
  }

  return (
    <Modal title="New discussion" onClose={onClose}>
      <label>Title<input value={title} onChange={(e) => setTitle(e.target.value)} autoFocus /></label>
      <label>Remarks<textarea rows={3} value={desc} onChange={(e) => setDesc(e.target.value)} /></label>
      <label>Checklist <small>(one item per line)</small>
        <textarea rows={4} value={items} onChange={(e) => setItems(e.target.value)} />
      </label>
      {can('set_d_date') ? (
        <label>D-date <small>(empty = {setting('auto_d_date_days')} days from today)</small>
          <input type="date" value={dd} onChange={(e) => setDd(e.target.value)} />
        </label>
      ) : (
        <p className="hint">The D-date is set automatically to {setting('auto_d_date_days')} days from today.</p>
      )}
      <button className="btn primary" disabled={busy || !title.trim()} onClick={save}>{busy ? 'Saving…' : 'Create discussion'}</button>
    </Modal>
  )
}
