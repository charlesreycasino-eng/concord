// ===== EASY CONFIG – the values you are most likely to edit =====
// Supabase connection (the publishable key is safe to ship in a browser app).
export const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL || 'https://dtrzgqjebruogynexbsp.supabase.co'
export const SUPABASE_KEY =
  import.meta.env.VITE_SUPABASE_KEY || 'sb_publishable_nN9ly_xF-qEVeoSnuDuaPQ_s2DuvZOY'

export const APP_NAME = 'Concord'
export const TAGLINE = 'Meet. Agree. Execute.'

// Username + password sign-in is mapped onto Supabase email auth with a hidden address.
// If sign-up ever says "email invalid", change this domain.
export const EMAIL_DOMAIN = 'concord-team.app'
// Added to every password behind the scenes so very short passwords (e.g. a first name)
// still satisfy Supabase's minimum length. Changing it later locks everyone out.
export const PASSWORD_SUFFIX = '@concord'

// Fallbacks used until app_settings loads (the live values are edited in Settings → App settings).
export const SETTING_DEFAULTS: Record<string, string> = {
  timezone: 'Asia/Manila',
  auto_d_date_days: '7',
  unresolved_review_days: '7',
  gather_prompt_days_before: '2',
  impl_check_days_after: '7',
  tpl_gather: 'Good day [Staff Name],\n\nJust checking in on [Topic], specifically: [Checklist Item].\nAre we on track with this? Is there anything I can help with?',
  tpl_impl: 'Good day [Staff Name],\n\nFollowing up on [Topic], specifically: [Checklist Item].\nIt has been a week since this was agreed/approved. Has it been implemented or resolved? Is there anything I can help with?'
}

// ===== Status model (the database enforces the same flow – see supabase/schema.sql) =====
export type Status = 'gathering' | 'agreed' | 'approved' | 'resolved' | 'unresolved'
export const STATUS_ORDER: Status[] = ['gathering', 'agreed', 'approved', 'resolved', 'unresolved']
export const STATUS_META: Record<Status, { label: string; icon: string }> = {
  gathering: { label: 'Gathering', icon: '◔' },
  agreed: { label: 'Agreed', icon: '✓' },
  approved: { label: 'Approved', icon: '★' },
  resolved: { label: 'Resolved', icon: '●' },
  unresolved: { label: 'Unresolved', icon: '!' }
}
export const NEXT: Record<Status, Status[]> = {
  gathering: ['agreed', 'approved', 'resolved', 'unresolved'],
  agreed: ['resolved', 'unresolved'],
  approved: ['resolved', 'unresolved'],
  resolved: ['unresolved'],
  unresolved: ['gathering', 'agreed', 'approved', 'resolved']
}
