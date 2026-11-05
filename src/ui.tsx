import { createContext, useCallback, useContext, useEffect, useState, ReactNode } from 'react'
import { STATUS_META, Status } from './config'

export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [onClose])
  return (
    <div className="overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <section className="sheet" role="dialog" aria-modal="true" aria-label={title}>
        <header className="sheet-head">
          <h2>{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close">✕</button>
        </header>
        <div className="sheet-body">{children}</div>
      </section>
    </div>
  )
}

const ToastCtx = createContext<(m: string, bad?: boolean) => void>(() => {})
export const useToast = () => useContext(ToastCtx)
export function ToastProvider({ children }: { children: ReactNode }) {
  const [t, setT] = useState<{ m: string; bad: boolean } | null>(null)
  const show = useCallback((m: string, bad = false) => {
    setT({ m, bad })
    setTimeout(() => setT(null), 3500)
  }, [])
  return (
    <ToastCtx.Provider value={show}>
      {children}
      {t && <div className={'toast' + (t.bad ? ' bad' : '')} role="status">{t.m}</div>}
    </ToastCtx.Provider>
  )
}

export const StatusBadge = ({ s }: { s: Status }) => (
  <span className={`badge st-${s}`}><span aria-hidden="true">{STATUS_META[s].icon}</span> {STATUS_META[s].label}</span>
)
export const Empty = ({ text }: { text: string }) => <p className="empty">{text}</p>
export const Progress = ({ done, total }: { done: number; total: number }) => (
  <div className="prog" title={`${done} of ${total} done`}>
    <div className="bar"><i style={{ width: total ? `${(done / total) * 100}%` : '0%' }} /></div>
    <span>{total ? `${done}/${total}` : 'No checklist'}</span>
  </div>
)

export async function copyText(t: string) {
  try { await navigator.clipboard.writeText(t); return true } catch {
    const a = document.createElement('textarea')
    a.value = t; document.body.appendChild(a); a.select()
    const ok = document.execCommand('copy'); a.remove(); return ok
  }
}
