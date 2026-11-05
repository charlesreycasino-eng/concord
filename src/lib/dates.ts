const pad = (n: number) => String(n).padStart(2, '0')
export const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
export const parse = (s: string) => { const [y, m, d] = s.slice(0, 10).split('-').map(Number); return new Date(y, m - 1, d) }
export const addDays = (s: string, n: number) => { const d = parse(s); d.setDate(d.getDate() + n); return iso(d) }
export const addMonths = (s: string, n: number) => { const d = parse(s); d.setDate(1); d.setMonth(d.getMonth() + n); return iso(d) }
export const startOfWeek = (s: string) => { const d = parse(s); d.setDate(d.getDate() - d.getDay()); return iso(d) }
export const todayIn = (tz: string) => {
  try { return new Date().toLocaleDateString('en-CA', { timeZone: tz }) } catch { return iso(new Date()) }
}
export const dateOfTs = (ts: string, tz: string) => {
  try { return new Date(ts).toLocaleDateString('en-CA', { timeZone: tz }) } catch { return ts.slice(0, 10) }
}
export const fmtDate = (s?: string | null) =>
  s ? parse(s).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '—'
export const fmtDateTime = (s: string) =>
  new Date(s).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })
