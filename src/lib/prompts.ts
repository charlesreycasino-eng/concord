import type { DataState } from './data'
import type { Discussion, Profile } from '../types'
import { addDays, dateOfTs } from './dates'

export interface PromptMsg { item: string; text: string }
export interface Prompt {
  key: string; kind: 'gather' | 'impl'; disc: Discussion; owner?: Profile; dueOn: string; messages: PromptMsg[]
}

const fill = (tpl: string, who: string, topic: string, item: string) =>
  tpl.replace(/\[Staff Name\]/g, who).replace(/\[Topic\]/g, topic).replace(/\[Checklist Item\]/g, item)

// Prompts are computed from live data – nothing is sent automatically; Admin copies the text.
export function buildPrompts(d: DataState, setting: (k: string) => string, today: string): Prompt[] {
  const before = Number(setting('gather_prompt_days_before')) || 2
  const after = Number(setting('impl_check_days_after')) || 7
  const tz = setting('timezone')
  const out: Prompt[] = []
  for (const disc of d.discussions) {
    if (disc.deleted_at) continue
    let kind: 'gather' | 'impl' | null = null
    let dueOn = ''
    if (disc.status === 'gathering' && disc.d_date) {
      dueOn = addDays(disc.d_date, -before)
      if (today >= dueOn) kind = 'gather'
    } else if ((disc.status === 'agreed' || disc.status === 'approved') && disc.decision_at) {
      dueOn = addDays(dateOfTs(disc.decision_at, tz), after)
      if (today >= dueOn) kind = 'impl'
    }
    if (!kind) continue
    const owner = d.profiles.find((p) => p.id === disc.creator_id)
    const items = d.checklist.filter((c) => c.discussion_id === disc.id && !c.is_complete).map((c) => c.title)
    const names = items.length ? items : ['the overall status']
    const tpl = setting(kind === 'gather' ? 'tpl_gather' : 'tpl_impl')
    out.push({
      key: `${kind}-${disc.id}`, kind, disc, owner, dueOn,
      messages: names.map((item) => ({ item, text: fill(tpl, owner?.display_name || 'there', disc.title, item) }))
    })
  }
  return out.sort((a, b) => a.dueOn.localeCompare(b.dueOn))
}
