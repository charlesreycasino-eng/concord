import { STATUS_META, Status } from '../config'
import type { Log } from '../types'
import { fmtDate } from './dates'

const changed = (b: any, a: any, k: string) => (b?.[k] ?? null) !== (a?.[k] ?? null)
const st = (s: string) => STATUS_META[s as Status]?.label || s

export function describeLog(l: Log, nameOf: (id?: string | null) => string): string {
  const b = l.before_data, a = l.after_data
  switch (l.entity_type) {
    case 'discussion': {
      if (l.action === 'insert') return `Created discussion “${a.title}”`
      const out: string[] = []
      if (changed(b, a, 'status')) out.push(`status ${st(b.status)} → ${st(a.status)}`)
      if (changed(b, a, 'd_date')) out.push(`D-date ${fmtDate(b.d_date)} → ${fmtDate(a.d_date)}`)
      if (changed(b, a, 'deleted_at')) out.push(a.deleted_at ? 'moved to Old' : 'restored from Old')
      if (changed(b, a, 'title') || changed(b, a, 'description')) out.push('edited details')
      return out.length ? out.join('; ') : 'Updated discussion'
    }
    case 'checklist_item': {
      if (l.action === 'insert') return `Added item “${a.title}”`
      if (l.action === 'delete') return `Removed item “${b.title}”`
      const out: string[] = []
      if (changed(b, a, 'is_complete')) out.push(`${a.is_complete ? 'checked' : 'unchecked'} “${a.title}”`)
      if (changed(b, a, 'remarks')) out.push(`remark on “${a.title}”`)
      if (changed(b, a, 'title')) out.push(`renamed “${b.title}” → “${a.title}”`)
      return out.join('; ') || 'Updated item'
    }
    case 'participant':
      return l.action === 'insert' ? `Added ${nameOf(a.user_id)} to the topic` : `Removed ${nameOf(b.user_id)} from the topic`
    case 'poll_response':
      return l.action === 'insert' ? `Answered ${a.response}` : `Changed answer ${b.response} → ${a.response}`
    case 'poll': {
      if (l.action === 'insert') return `Created poll “${a.question}”`
      const out: string[] = []
      if (changed(b, a, 'status')) out.push(a.status === 'closed' ? 'closed poll' : 'reopened poll')
      if (changed(b, a, 'deleted_at')) out.push(a.deleted_at ? 'moved poll to Old' : 'restored poll')
      return `${out.join('; ') || 'Updated poll'} “${a.question}”`
    }
    case 'profile': {
      if (l.action === 'insert') return `Account requested: ${a.display_name}`
      const out: string[] = []
      for (const k of ['account_status', 'role', 'elevated', 'department_id', 'telegram_username', 'display_name'])
        if (changed(b, a, k)) out.push(`${k.replace('_', ' ')} ${b?.[k] ?? '—'} → ${a?.[k] ?? '—'}`)
      return `${a.display_name}: ${out.join('; ') || 'updated'}`
    }
    case 'permission':
      return `Permission “${a.capability}” now head=${a.role_head ? 'Yes' : 'No'}, staff=${a.role_staff ? 'Yes' : 'No'}`
    case 'setting':
      return `Setting ${a?.key || b?.key} changed`
    default:
      return `${l.action} ${l.entity_type}`
  }
}
