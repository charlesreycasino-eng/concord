import { useState } from 'react'
import { useAuth } from '../lib/auth'
import { useData } from '../lib/data'
import { STATUS_ORDER } from '../config'
import { Empty, Progress, StatusBadge } from '../ui'
import { fmtDate } from '../lib/dates'
import DiscussionModal from './DiscussionModal'
import NewDiscussion from './NewDiscussion'

export default function Meeting() {
  const { d, nameOf, today } = useData()
  const { can } = useAuth()
  const [open, setOpen] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [stack, setStack] = useState(false)
  const [old, setOld] = useState(false)
  const list = d.discussions.filter((x) => !!x.deleted_at === old)

  return (
    <div className="page">
      <div className="toolbar">
        <h1>{old ? 'Meeting · Old' : 'Meeting'}</h1>
        <div className="grow" />
        <button className="btn ghost" onClick={() => setOld(!old)}>{old ? 'Show active' : 'Show old'}</button>
        <button className="btn ghost" onClick={() => setStack(!stack)}>{stack ? 'Columns' : 'Stack'}</button>
      </div>
      <div className={'board' + (stack ? ' stack' : '')}>
        {STATUS_ORDER.map((s) => {
          const col = list.filter((x) => x.status === s)
          return (
            <section className="col" key={s}>
              <h3><StatusBadge s={s} /><span className="count">{col.length}</span></h3>
              {col.length === 0 && <Empty text="Nothing here yet." />}
              {col.map((x) => {
                const its = d.checklist.filter((c) => c.discussion_id === x.id)
                const people = d.participants.filter((p) => p.discussion_id === x.id).map((p) => nameOf(p.user_id).split(' ')[0])
                const overdue = x.status === 'gathering' && !!x.d_date && x.d_date < today
                return (
                  <button key={x.id} className={'card st-' + x.status} onClick={() => setOpen(x.id)}>
                    <div className="card-top">
                      <span className="muted">D-{x.seq}</span>
                      <span className={'dchip' + (overdue ? ' late' : '')}>{overdue ? 'Overdue · ' : ''}{fmtDate(x.d_date)}</span>
                    </div>
                    <strong>{x.title}</strong>
                    <Progress done={its.filter((c) => c.is_complete).length} total={its.length} />
                    <span className="muted small">{nameOf(x.creator_id)}{people.length > 1 ? ` + ${people.length - 1}` : ''}</span>
                    {x.status === 'unresolved' && x.review_on && <span className="muted small">Review on {fmtDate(x.review_on)}</span>}
                  </button>
                )
              })}
            </section>
          )
        })}
      </div>
      {can('create_discussion') && <button className="fab" onClick={() => setCreating(true)}>＋ New discussion</button>}
      {open && <DiscussionModal id={open} onClose={() => setOpen(null)} />}
      {creating && <NewDiscussion onClose={() => setCreating(false)} />}
    </div>
  )
}
