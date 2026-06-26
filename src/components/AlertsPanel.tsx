'use client'
import { UnsoldRow } from '@/lib/ageing'
import { AlertTriangle, Clock, Eye, CheckCircle } from 'lucide-react'

export default function AlertsPanel({ rows }: { rows: UnsoldRow[] }) {
  const dead = rows.filter(r => r.bucket === 'Dead stock')
  const slow = rows.filter(r => r.bucket === 'Slow')
  const moderate = rows.filter(r => r.bucket === 'Moderate')

  const bc = (items: UnsoldRow[]) => {
    const c = { Prime: 0, Liberty: 0, Marino: 0 }
    items.forEach(r => c[r.branch]++)
    return c
  }

  if (!dead.length && !slow.length && !moderate.length) {
    return (
      <div style={{ background: '#f0fdf4', borderLeft: '4px solid #22c55e', borderRadius: 10, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
        <CheckCircle size={16} color="#16a34a" />
        <span style={{ fontSize: 13, color: '#166534', fontWeight: 500 }}>All unsold stock is fresh — no action needed right now.</span>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {dead.length > 0 && (() => {
        const b = bc(dead)
        const oldest = [...dead].sort((a, b) => (b.branchDays ?? 0) - (a.branchDays ?? 0))[0]
        return (
          <div style={{ background: '#fee2e2', borderLeft: '4px solid #ef4444', borderRadius: 10, padding: '12px 16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <AlertTriangle size={16} color="#dc2626" />
                <span style={{ fontSize: 13, fontWeight: 600, color: '#7f1d1d' }}>{dead.length} dead stock unit{dead.length > 1 ? 's' : ''} — immediate action required</span>
              </div>
              <span style={{ fontSize: 11, fontWeight: 500, padding: '2px 9px', borderRadius: 999, background: '#fecaca', color: '#7f1d1d' }}>Urgent: discount / return</span>
            </div>
            <div style={{ fontSize: 11, color: '#991b1b', marginTop: 6 }}>
              Prime: <strong>{b.Prime}</strong> · Liberty: <strong>{b.Liberty}</strong> · Marino: <strong>{b.Marino}</strong>
              {oldest && <> · Oldest at branch: <strong>{oldest.model || oldest.rawImei}</strong> — branch {oldest.branchDays}d / total {oldest.totalDays}d ({oldest.branch})</>}
            </div>
          </div>
        )
      })()}

      {slow.length > 0 && (() => {
        const b = bc(slow)
        return (
          <div style={{ background: '#ffedd5', borderLeft: '4px solid #f97316', borderRadius: 10, padding: '12px 16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Clock size={16} color="#ea580c" />
                <span style={{ fontSize: 13, fontWeight: 600, color: '#9a3412' }}>{slow.length} slow-moving unit{slow.length > 1 ? 's' : ''} — branch age 21–30 days</span>
              </div>
              <span style={{ fontSize: 11, fontWeight: 500, padding: '2px 9px', borderRadius: 999, background: '#fed7aa', color: '#9a3412' }}>Consider discounting</span>
            </div>
            <div style={{ fontSize: 11, color: '#c2410c', marginTop: 6 }}>
              Prime: <strong>{b.Prime}</strong> · Liberty: <strong>{b.Liberty}</strong> · Marino: <strong>{b.Marino}</strong> — at risk of becoming dead stock
            </div>
          </div>
        )
      })()}

      {moderate.length > 0 && (() => {
        const b = bc(moderate)
        return (
          <div style={{ background: '#fef9c3', borderLeft: '4px solid #eab308', borderRadius: 10, padding: '12px 16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Eye size={16} color="#ca8a04" />
                <span style={{ fontSize: 13, fontWeight: 600, color: '#854d0e' }}>{moderate.length} moderate unit{moderate.length > 1 ? 's' : ''} — branch age 11–20 days</span>
              </div>
              <span style={{ fontSize: 11, fontWeight: 500, padding: '2px 9px', borderRadius: 999, background: '#fef08a', color: '#854d0e' }}>Monitor — review pricing</span>
            </div>
            <div style={{ fontSize: 11, color: '#92400e', marginTop: 6 }}>
              Prime: <strong>{b.Prime}</strong> · Liberty: <strong>{b.Liberty}</strong> · Marino: <strong>{b.Marino}</strong>
            </div>
          </div>
        )
      })()}
    </div>
  )
}