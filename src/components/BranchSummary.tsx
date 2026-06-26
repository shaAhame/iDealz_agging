'use client'
import { UnsoldRow, Branch } from '@/lib/ageing'

function BranchCard({ branch, rows, color, bg }: { branch: Branch; rows: UnsoldRow[]; color: string; bg: string }) {
  const counts = { Fresh: 0, Moderate: 0, Slow: 0, 'Dead stock': 0 }
  rows.forEach(r => { if (r.bucket in counts) (counts as any)[r.bucket]++ })

  return (
    <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: '14px 16px' }}>
      <div style={{ fontSize: 13, fontWeight: 600, color, marginBottom: 10 }}>{branch}</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 8px' }}>
        <span style={{ fontSize: 11, color: '#6b7280' }}>Total unsold</span>
        <span style={{ fontSize: 13, fontWeight: 600 }}>{rows.length}</span>
        <span style={{ fontSize: 11, color: '#166534' }}>Fresh</span>
        <span style={{ fontSize: 13, fontWeight: 600, color: '#166534' }}>{counts.Fresh}</span>
        <span style={{ fontSize: 11, color: '#854d0e' }}>Moderate</span>
        <span style={{ fontSize: 13, fontWeight: 600, color: '#854d0e' }}>{counts.Moderate}</span>
        <span style={{ fontSize: 11, color: '#9a3412' }}>Slow</span>
        <span style={{ fontSize: 13, fontWeight: 600, color: '#9a3412' }}>{counts.Slow}</span>
        <span style={{ fontSize: 11, color: '#7f1d1d' }}>Dead stock</span>
        <span style={{ fontSize: 13, fontWeight: 600, color: '#dc2626' }}>{counts['Dead stock']}</span>
      </div>
    </div>
  )
}

export default function BranchSummary({ rows }: { rows: UnsoldRow[] }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
      <BranchCard branch="Prime" rows={rows.filter(r => r.branch === 'Prime')} color="#1e3a8a" bg="#dbeafe" />
      <BranchCard branch="Liberty" rows={rows.filter(r => r.branch === 'Liberty')} color="#3730a3" bg="#ede9fe" />
      <BranchCard branch="Marino" rows={rows.filter(r => r.branch === 'Marino')} color="#064e3b" bg="#d1fae5" />
    </div>
  )
}
