'use client'
import { useState, useMemo } from 'react'
import { UnsoldRow, Branch, AgeStatus, actionLabel, bucketColor } from '@/lib/ageing'

const branchStyle: Record<string, { bg: string; color: string }> = {
  Prime:   { bg: '#dbeafe', color: '#1e3a8a' },
  Liberty: { bg: '#ede9fe', color: '#3730a3' },
  Marino:  { bg: '#d1fae5', color: '#064e3b' },
}

function Badge({ label, bg, color, small }: { label: string; bg: string; color: string; small?: boolean }) {
  return (
    <span style={{
      display: 'inline-block', fontWeight: 500, padding: small ? '1px 6px' : '2px 8px',
      borderRadius: 999, background: bg, color, whiteSpace: 'nowrap',
      fontSize: small ? 10 : 11,
    }}>{label}</span>
  )
}

function AgePill({ days, bucket }: { days: number | null; bucket: string }) {
  const c = bucketColor(bucket as any)
  return (
    <span style={{
      fontSize: 12, fontWeight: 700, color: c.color,
      background: c.bg, padding: '2px 7px', borderRadius: 6, whiteSpace: 'nowrap'
    }}>
      {days !== null ? `${days}d` : '—'}
    </span>
  )
}

// Expanded row detail panel
function ExpandedRow({ r }: { r: UnsoldRow }) {
  const act = actionLabel(r.bucket, r.branch)
  const fmt = (d: Date | null) =>
    d ? d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'

  const items = [
    { label: 'GRN Date',              val: fmt(r.date) },
    { label: 'Transfer Date',         val: fmt(r.transferDate) },
    { label: 'Warehouse Days (Prime)',val: r.warehouseDays !== null ? `${r.warehouseDays}d` : '—' },
    { label: 'Branch Days',           val: r.branchDays !== null ? `${r.branchDays}d` : '—' },
    { label: 'Total Days',            val: r.totalDays !== null ? `${r.totalDays}d` : '—' },
    { label: 'Branch Status',         val: r.bucket },
    { label: 'Total Status',          val: r.totalBucket },
    { label: 'Days Overdue',          val: r.overdue > 0 ? `+${r.overdue}d` : '—' },
    { label: 'Action',                val: act.label },
  ]

  return (
    <tr>
      <td colSpan={7} style={{ padding: '0 12px 12px 40px', background: '#f8fafc', borderBottom: '2px solid #e5e7eb' }}>
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
          gap: '8px 16px', padding: '12px 16px', background: '#fff',
          borderRadius: 10, border: '1px solid #e5e7eb',
        }}>
          {items.map(({ label, val }) => (
            <div key={label}>
              <div style={{ fontSize: 10, color: '#9ca3af', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 2 }}>{label}</div>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>{val}</div>
            </div>
          ))}
        </div>
      </td>
    </tr>
  )
}

export default function AgeingTable({ rows }: { rows: UnsoldRow[] }) {
  const [branch, setBranch] = useState<'all' | Branch>('all')
  const [age, setAge] = useState<'all' | AgeStatus>('all')
  const [search, setSearch] = useState('')
  const [sortDir, setSortDir] = useState<'desc' | 'asc'>('desc')
  const [expanded, setExpanded] = useState<Set<number>>(new Set())
  const [page, setPage] = useState(1)
  const PER_PAGE = 20

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

  const totalPages = Math.ceil(filtered.length / PER_PAGE)
  const paginated = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE)

  const toggleExpand = (i: number) => {
    setExpanded(prev => {
      const next = new Set(prev)
      next.has(i) ? next.delete(i) : next.add(i)
      return next
    })
  }

  const tabStyle = (active: boolean): React.CSSProperties => ({
    fontSize: 12, padding: '4px 12px', cursor: 'pointer', borderRadius: 999,
    border: active ? '1.5px solid #374151' : '1px solid #d1d5db',
    background: active ? '#f1f5f9' : 'transparent',
    color: active ? '#111827' : '#6b7280',
    fontWeight: active ? 600 : 400,
  })

  return (
    <div>
      {/* Filters */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 10, alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
          {(['all', 'Prime', 'Liberty', 'Marino'] as const).map(b => (
            <button key={b} style={tabStyle(branch === b)} onClick={() => { setBranch(b); setPage(1) }}>
              {b === 'all' ? 'All branches' : b}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', alignItems: 'center' }}>
          {(['all', 'Fresh', 'Moderate', 'Slow', 'Dead stock'] as const).map(a => (
            <button key={a} style={tabStyle(age === a)} onClick={() => { setAge(a); setPage(1) }}>
              {a === 'all' ? 'All' : a}
            </button>
          ))}
          <input
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1) }}
            placeholder="Search IMEI / model…"
            style={{ fontSize: 12, padding: '4px 10px', borderRadius: 8, border: '1px solid #d1d5db', width: 160 }}
          />
        </div>
      </div>

      {/* Hint */}
      <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 8 }}>
        Click any row to see full details &nbsp;·&nbsp; Branch age drives status color
      </div>

      {/* Table */}
      <div style={{ overflowX: 'auto', borderRadius: 10, border: '1px solid #e5e7eb' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ background: '#f9fafb' }}>
              <th style={th()}></th>
              <th style={th()}>IMEI</th>
              <th style={th()}>Model</th>
              <th style={th()}>Branch</th>
              <th style={{ ...th(), cursor: 'pointer' }} onClick={() => setSortDir(d => d === 'desc' ? 'asc' : 'desc')}>
                Branch Age {sortDir === 'desc' ? '↓' : '↑'}
              </th>
              <th style={th()}>Total Age</th>
              <th style={th()}>Status / Action</th>
            </tr>
          </thead>
          <tbody>
            {paginated.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: '2rem', color: '#9ca3af', fontSize: 13 }}>
                  No records match this filter.
                </td>
              </tr>
            ) : paginated.map((r, i) => {
              const globalIdx = (page - 1) * PER_PAGE + i
              const isOpen = expanded.has(globalIdx)
              const act = actionLabel(r.bucket, r.branch)
              const bc = bucketColor(r.bucket)
              const bs = branchStyle[r.branch]
              const actionColors: Record<string, { bg: string; color: string }> = {
                'action-urgent':   { bg: '#fee2e2', color: '#7f1d1d' },
                'action-discount': { bg: '#fef9c3', color: '#854d0e' },
                'action-monitor':  { bg: '#dbeafe', color: '#1e3a8a' },
                'action-ok':       { bg: '#dcfce7', color: '#166534' },
              }
              const ac = actionColors[act.cls] || actionColors['action-ok']

              return [
                <tr
                  key={`row-${globalIdx}`}
                  onClick={() => toggleExpand(globalIdx)}
                  style={{ borderBottom: isOpen ? 'none' : '1px solid #f3f4f6', cursor: 'pointer', background: isOpen ? '#f8fafc' : '' }}
                  onMouseEnter={e => { if (!isOpen) e.currentTarget.style.background = '#f9fafb' }}
                  onMouseLeave={e => { if (!isOpen) e.currentTarget.style.background = '' }}
                >
                  {/* Expand chevron */}
                  <td style={{ ...td(), width: 28, color: '#9ca3af', fontSize: 14, textAlign: 'center', userSelect: 'none' }}>
                    {isOpen ? '▾' : '▸'}
                  </td>
                  {/* IMEI */}
                  <td style={td()}>
                    <span style={{ fontFamily: 'monospace', fontSize: 11, color: '#374151' }}>{r.rawImei}</span>
                    {r.brand && <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 1 }}>{r.brand}</div>}
                  </td>
                  {/* Model */}
                  <td style={{ ...td(), maxWidth: 160 }}>
                    <span style={{ fontSize: 12, color: '#374151', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.model}>
                      {r.model || '—'}
                    </span>
                  </td>
                  {/* Branch */}
                  <td style={td()}>
                    <Badge label={r.branch} bg={bs.bg} color={bs.color} />
                  </td>
                  {/* Branch age */}
                  <td style={td()}>
                    <AgePill days={r.branchDays} bucket={r.bucket} />
                    {r.overdue > 0 && (
                      <span style={{ fontSize: 10, marginLeft: 5, background: '#fee2e2', color: '#7f1d1d', padding: '1px 5px', borderRadius: 4, fontWeight: 600 }}>
                        +{r.overdue}d
                      </span>
                    )}
                  </td>
                  {/* Total age */}
                  <td style={td()}>
                    <AgePill days={r.totalDays} bucket={r.totalBucket} />
                  </td>
                  {/* Status + Action */}
                  <td style={td()}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                      <Badge label={r.bucket} bg={bc.bg} color={bc.color} small />
                      <Badge label={act.label} bg={ac.bg} color={ac.color} small />
                    </div>
                  </td>
                </tr>,
                isOpen && <ExpandedRow key={`exp-${globalIdx}`} r={r} />
              ]
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination + count */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 10, flexWrap: 'wrap', gap: 8 }}>
        <div style={{ fontSize: 11, color: '#9ca3af' }}>
          Showing {((page - 1) * PER_PAGE) + 1}–{Math.min(page * PER_PAGE, filtered.length)} of {filtered.length} unsold units
        </div>
        {totalPages > 1 && (
          <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              style={{ fontSize: 12, padding: '4px 10px', borderRadius: 6, border: '1px solid #d1d5db', background: '#fff', cursor: page === 1 ? 'not-allowed' : 'pointer', opacity: page === 1 ? 0.4 : 1 }}
            >← Prev</button>
            {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
              const p = totalPages <= 7 ? i + 1 : i < 3 ? i + 1 : i === 3 ? page : i === 4 ? '…' : totalPages - (6 - i)
              if (p === '…') return <span key="dots" style={{ fontSize: 12, color: '#9ca3af', padding: '0 4px' }}>…</span>
              return (
                <button
                  key={p}
                  onClick={() => setPage(Number(p))}
                  style={{ fontSize: 12, padding: '4px 9px', borderRadius: 6, border: `1px solid ${page === p ? '#374151' : '#d1d5db'}`, background: page === p ? '#1e293b' : '#fff', color: page === p ? '#fff' : '#374151', cursor: 'pointer', fontWeight: page === p ? 600 : 400 }}
                >{p}</button>
              )
            })}
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              style={{ fontSize: 12, padding: '4px 10px', borderRadius: 6, border: '1px solid #d1d5db', background: '#fff', cursor: page === totalPages ? 'not-allowed' : 'pointer', opacity: page === totalPages ? 0.4 : 1 }}
            >Next →</button>
          </div>
        )}
      </div>
    </div>
  )
}

const th = (): React.CSSProperties => ({
  padding: '8px 10px', textAlign: 'left', fontWeight: 600, fontSize: 11,
  color: '#6b7280', borderBottom: '1px solid #e5e7eb', whiteSpace: 'nowrap',
})
const td = (): React.CSSProperties => ({
  padding: '8px 10px', verticalAlign: 'middle',
})
