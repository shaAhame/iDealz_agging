'use client'
import { useState, useMemo } from 'react'
import { UnsoldRow, Branch, AgeStatus, actionLabel, bucketColor } from '@/lib/ageing'

const branchBadge: Record<string, { bg: string; color: string }> = {
  Prime:   { bg: '#dbeafe', color: '#1e3a8a' },
  Liberty: { bg: '#ede9fe', color: '#3730a3' },
  Marino:  { bg: '#d1fae5', color: '#064e3b' },
}

function Badge({ label, bg, color }: { label: string; bg: string; color: string }) {
  return (
    <span style={{ display: 'inline-block', fontSize: 11, fontWeight: 500, padding: '2px 8px', borderRadius: 999, background: bg, color, whiteSpace: 'nowrap' }}>
      {label}
    </span>
  )
}

function DualAgePill({ branchDays, totalDays, bucket, totalBucket }: {
  branchDays: number | null; totalDays: number | null
  bucket: string; totalBucket: string
}) {
  const bc = bucketColor(bucket as any)
  const tc = bucketColor(totalBucket as any)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <span style={{ fontSize: 10, color: '#9ca3af', width: 52, flexShrink: 0 }}>Branch:</span>
        <span style={{ fontSize: 12, fontWeight: 700, color: bc.color, background: bc.bg, padding: '1px 6px', borderRadius: 4 }}>
          {branchDays !== null ? `${branchDays}d` : '—'}
        </span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <span style={{ fontSize: 10, color: '#9ca3af', width: 52, flexShrink: 0 }}>Total:</span>
        <span style={{ fontSize: 12, fontWeight: 600, color: tc.color, background: tc.bg, padding: '1px 6px', borderRadius: 4 }}>
          {totalDays !== null ? `${totalDays}d` : '—'}
        </span>
      </div>
    </div>
  )
}

export default function AgeingTable({ rows }: { rows: UnsoldRow[] }) {
  const [branch, setBranch] = useState<'all' | Branch>('all')
  const [age, setAge] = useState<'all' | AgeStatus>('all')
  const [search, setSearch] = useState('')
  const [sortDir, setSortDir] = useState<'desc' | 'asc'>('desc')

  const filtered = useMemo(() => {
    let r = rows
    if (branch !== 'all') r = r.filter(x => x.branch === branch)
    if (age !== 'all') r = r.filter(x => x.bucket === age)
    if (search) {
      const q = search.toLowerCase()
      r = r.filter(x =>
        x.rawImei.toLowerCase().includes(q) ||
        x.model.toLowerCase().includes(q) ||
        x.brand.toLowerCase().includes(q)
      )
    }
    return [...r].sort((a, b) =>
      sortDir === 'desc'
        ? (b.branchDays ?? 0) - (a.branchDays ?? 0)
        : (a.branchDays ?? 0) - (b.branchDays ?? 0)
    )
  }, [rows, branch, age, search, sortDir])

  const tabStyle = (active: boolean): React.CSSProperties => ({
    fontSize: 12, padding: '5px 12px', cursor: 'pointer', borderRadius: 999,
    border: active ? '1.5px solid #374151' : '1px solid #d1d5db',
    background: active ? '#f9fafb' : 'transparent',
    color: active ? '#111827' : '#6b7280', fontWeight: active ? 600 : 400,
  })

  const fmt = (d: Date | null) =>
    d ? d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'

  return (
    <div>
      {/* Filters */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12, alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {(['all', 'Prime', 'Liberty', 'Marino'] as const).map(b => (
            <button key={b} style={tabStyle(branch === b)} onClick={() => setBranch(b)}>
              {b === 'all' ? 'All branches' : b}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          {(['all', 'Fresh', 'Moderate', 'Slow', 'Dead stock'] as const).map(a => (
            <button key={a} style={tabStyle(age === a)} onClick={() => setAge(a)}>
              {a === 'all' ? 'All' : a}
            </button>
          ))}
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search IMEI / model…"
            style={{ fontSize: 12, padding: '5px 10px', borderRadius: 8, border: '1px solid #d1d5db', width: 170 }}
          />
        </div>
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 10, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 11, color: '#6b7280', display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ width: 8, height: 8, borderRadius: 2, background: '#166534', display: 'inline-block' }}></span>
          Branch age = how long current branch has held it (drives status)
        </span>
        <span style={{ fontSize: 11, color: '#6b7280', display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ width: 8, height: 8, borderRadius: 2, background: '#9ca3af', display: 'inline-block' }}></span>
          Total age = GRN date → today
        </span>
      </div>

      {/* Table */}
      <div style={{ overflowX: 'auto', borderRadius: 10, border: '1px solid #e5e7eb' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ background: '#f9fafb' }}>
              <th style={th()}>IMEI</th>
              <th style={th()}>Brand</th>
              <th style={th()}>Model</th>
              <th style={th()}>Branch</th>
              <th style={th()}>GRN Date</th>
              <th style={th()}>Transfer Date</th>
              <th style={th()}>Warehouse Days<br/><span style={{ fontWeight: 400, color: '#9ca3af' }}>(at Prime)</span></th>
              <th style={{ ...th(), cursor: 'pointer' }} onClick={() => setSortDir(d => d === 'desc' ? 'asc' : 'desc')}>
                Age ↕<br/><span style={{ fontWeight: 400, color: '#9ca3af' }}>Branch / Total</span>
              </th>
              <th style={th()}>Branch Status</th>
              <th style={th()}>Total Status</th>
              <th style={th()}>Days Overdue</th>
              <th style={th()}>Action</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={12} style={{ textAlign: 'center', padding: '2rem', color: '#9ca3af', fontSize: 13 }}>
                  No records match this filter.
                </td>
              </tr>
            ) : filtered.map((r, i) => {
              const act = actionLabel(r.bucket, r.branch)
              const bb = branchBadge[r.branch]
              const bc = bucketColor(r.bucket)
              const tc = bucketColor(r.totalBucket)
              return (
                <tr key={i} style={{ borderBottom: '1px solid #f3f4f6' }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#f9fafb')}
                  onMouseLeave={e => (e.currentTarget.style.background = '')}>
                  <td style={td()}><span style={{ fontFamily: 'monospace', fontSize: 11 }}>{r.rawImei}</span></td>
                  <td style={td()}>{r.brand || '—'}</td>
                  <td style={{ ...td(), maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.model}>{r.model || '—'}</td>
                  <td style={td()}><Badge label={r.branch} bg={bb.bg} color={bb.color} /></td>
                  <td style={{ ...td(), whiteSpace: 'nowrap' }}>{fmt(r.date)}</td>
                  <td style={{ ...td(), whiteSpace: 'nowrap' }}>{fmt(r.transferDate)}</td>
                  <td style={td()}>
                    {r.warehouseDays !== null
                      ? <span style={{ fontWeight: 600, color: '#6b7280' }}>{r.warehouseDays}d</span>
                      : <span style={{ color: '#d1d5db' }}>—</span>}
                  </td>
                  <td style={td()}>
                    <DualAgePill
                      branchDays={r.branchDays}
                      totalDays={r.totalDays}
                      bucket={r.bucket}
                      totalBucket={r.totalBucket}
                    />
                  </td>
                  <td style={td()}><Badge label={r.bucket} bg={bc.bg} color={bc.color} /></td>
                  <td style={td()}><Badge label={r.totalBucket} bg={tc.bg} color={tc.color} /></td>
                  <td style={td()}>
                    {r.overdue > 0
                      ? <span style={{ background: '#fee2e2', color: '#7f1d1d', fontSize: 10, padding: '2px 6px', borderRadius: 4, fontWeight: 600 }}>+{r.overdue}d</span>
                      : <span style={{ color: '#d1d5db' }}>—</span>}
                  </td>
                  <td style={td()}><span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 999, fontWeight: 500, whiteSpace: 'nowrap', background: act.cls === 'action-urgent' ? '#fee2e2' : act.cls === 'action-discount' ? '#fef9c3' : act.cls === 'action-monitor' ? '#dbeafe' : '#dcfce7', color: act.cls === 'action-urgent' ? '#7f1d1d' : act.cls === 'action-discount' ? '#854d0e' : act.cls === 'action-monitor' ? '#1e3a8a' : '#166534' }}>{act.label}</span></td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 6 }}>
        Showing {filtered.length} of {rows.length} unsold units · Sorted by branch age
      </div>
    </div>
  )
}

const th = (): React.CSSProperties => ({
  padding: '8px 10px', textAlign: 'left', fontWeight: 600, fontSize: 11,
  color: '#6b7280', borderBottom: '1px solid #e5e7eb', whiteSpace: 'nowrap',
  lineHeight: 1.4,
})
const td = (): React.CSSProperties => ({
  padding: '8px 10px', verticalAlign: 'middle',
})