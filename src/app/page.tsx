'use client'
import { useState, useCallback, useRef } from 'react'
import dynamic from 'next/dynamic'
import AlertsPanel from '@/components/AlertsPanel'
import BranchSummary from '@/components/BranchSummary'
import AgeingTable from '@/components/AgeingTable'
import { exportCSV, exportExcel, exportPDF } from '@/lib/export'
import {
  StockRow, UnsoldRow,
  readExcelFile, extractIMEIsFromPDFBuffer,
  parseStockExcel, parseTransferExcel,
  buildUnsoldRows
} from '@/lib/ageing'
import { Download, RefreshCw, CheckCircle, Plus, X, Upload, FileSpreadsheet, FileText } from 'lucide-react'

const AgeChart = dynamic(() => import('@/components/AgeChart'), { ssr: false })

const TODAY = new Date()

interface FileEntry { name: string; count: number; id: string }

// ── Upload Zone ──────────────────────────────────────────────────────────────
function UploadZone({ step, label, files, accept, onFiles, onRemove }: {
  step: number
  label: string
  files: FileEntry[]
  accept: string
  onFiles: (f: File[]) => void
  onRemove: (id: string) => void
}) {
  const ref = useRef<HTMLInputElement>(null)
  const [drag, setDrag] = useState(false)

  const open = () => {
    const el = ref.current
    if (!el) return
    el.value = ''
    el.click()
  }

  return (
    <div>
      {/* Label */}
      <div style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 18, height: 18, borderRadius: '50%', background: '#dbeafe', color: '#1e40af', fontSize: 10, fontWeight: 700, flexShrink: 0 }}>{step}</span>
        {label}
      </div>

      {/* Loaded files */}
      {files.map(f => (
        <div key={f.id} style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: '6px 10px', marginBottom: 6 }}>
          <CheckCircle size={13} color="#16a34a" style={{ flexShrink: 0 }} />
          <span style={{ fontSize: 11, color: '#166534', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={f.name}>{f.name}</span>
          <span style={{ fontSize: 10, color: '#16a34a', fontWeight: 600, whiteSpace: 'nowrap', marginRight: 4 }}>{f.count} IMEIs</span>
          <button
            onClick={() => onRemove(f.id)}
            style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: 2, display: 'flex', alignItems: 'center', flexShrink: 0 }}
            title="Remove this file"
          >
            <X size={13} color="#dc2626" />
          </button>
        </div>
      ))}

      {/* Hidden input */}
      <input
        ref={ref}
        type="file"
        accept={accept}
        multiple
        style={{ display: 'none' }}
        onChange={e => {
          const list = e.target.files
          if (list && list.length > 0) onFiles(Array.from(list))
          e.target.value = ''
        }}
      />

      {/* Drop / click zone */}
      <div
        onClick={open}
        onDragOver={e => { e.preventDefault(); e.stopPropagation(); setDrag(true) }}
        onDragEnter={e => { e.preventDefault(); e.stopPropagation(); setDrag(true) }}
        onDragLeave={e => { e.preventDefault(); setDrag(false) }}
        onDrop={e => {
          e.preventDefault(); e.stopPropagation(); setDrag(false)
          const list = Array.from(e.dataTransfer.files)
          if (list.length) onFiles(list)
        }}
        style={{
          border: `2px dashed ${drag ? '#3b82f6' : '#d1d5db'}`,
          borderRadius: 10, padding: '14px 10px', textAlign: 'center',
          cursor: 'pointer', background: drag ? '#eff6ff' : '#fafafa',
          transition: 'all 0.15s', display: 'flex', flexDirection: 'column',
          alignItems: 'center', gap: 6,
        }}
      >
        <Upload size={16} color={drag ? '#3b82f6' : '#9ca3af'} />
        <span style={{ fontSize: 12, color: drag ? '#3b82f6' : '#9ca3af', fontWeight: 500 }}>
          {files.length > 0 ? 'Click or drag to add more files' : 'Click or drag files here'}
        </span>
        <span style={{ fontSize: 10, color: '#d1d5db' }}>{accept.replace(/\./g, '').toUpperCase().replace(/,/g, ' · ')}</span>
      </div>
    </div>
  )
}

// ── Main Dashboard ────────────────────────────────────────────────────────────
export default function Dashboard() {
  // Raw data stores — keyed by file ID so we can remove individual files
  const [stockByFile, setStockByFile] = useState<Record<string, StockRow[]>>({})
  const [libertyByFile, setLibertyByFile] = useState<Record<string, Map<string, Date | null>>>({})
  const [marinoByFile, setMarinoByFile] = useState<Record<string, Map<string, Date | null>>>({})
  const [salesByFile, setSalesByFile] = useState<Record<string, Set<string>>>({})

  // File list UI
  const [stockFiles, setStockFiles] = useState<FileEntry[]>([])
  const [libertyFiles, setLibertyFiles] = useState<FileEntry[]>([])
  const [marinoFiles, setMarinoFiles] = useState<FileEntry[]>([])
  const [salesFiles, setSalesFiles] = useState<FileEntry[]>([])

  const [unsoldRows, setUnsoldRows] = useState<UnsoldRow[]>([])
  const [status, setStatus] = useState('')

  // ── Derive combined data from per-file stores ──────────────────────────────
  const rebuildFromStores = useCallback((
    sByFile: Record<string, StockRow[]>,
    lByFile: Record<string, Map<string, Date | null>>,
    mByFile: Record<string, Map<string, Date | null>>,
    saByFile: Record<string, Set<string>>
  ) => {
    const stock = Object.values(sByFile).flat()
    const lib = new Map<string, Date | null>()
    Object.values(lByFile).forEach(m => m.forEach((v, k) => lib.set(k, v)))
    const mar = new Map<string, Date | null>()
    Object.values(mByFile).forEach(m => m.forEach((v, k) => mar.set(k, v)))
    const sales = new Set<string>()
    Object.values(saByFile).forEach(s => s.forEach(v => sales.add(v)))
    setUnsoldRows(buildUnsoldRows(stock, lib, mar, sales))
  }, [])

  // ── Parse a single file ────────────────────────────────────────────────────
  const parseOneFile = async (file: File) => {
    const ext = file.name.split('.').pop()?.toLowerCase()
    if (ext === 'pdf') {
      const buf = await file.arrayBuffer()
      return { ...extractIMEIsFromPDFBuffer(buf), rows: undefined }
    }
    const rows = await readExcelFile(file)
    return { rows, imeis: undefined, date: undefined }
  }

  const uid = () => Math.random().toString(36).slice(2)

  // ── Stock handlers ─────────────────────────────────────────────────────────
  const handleStock = async (files: File[]) => {
    setStatus('Reading stock files…')
    try {
      const newByFile = { ...stockByFile }
      const entries: FileEntry[] = []
      for (const file of files) {
        const { rows, imeis, date } = await parseOneFile(file)
        const parsed: StockRow[] = imeis
          ? imeis.map(imei => ({ imei, rawImei: imei, brand: '', model: '', date: date ?? null, location: 'Prime' }))
          : parseStockExcel(rows!)
        const id = uid()
        newByFile[id] = parsed
        entries.push({ name: file.name, count: parsed.length, id })
      }
      setStockByFile(newByFile)
      setStockFiles(p => [...p, ...entries])
      rebuildFromStores(newByFile, libertyByFile, marinoByFile, salesByFile)
      setStatus('')
    } catch (e: any) { setStatus('⚠ ' + e.message) }
  }

  const removeStock = (id: string) => {
    const next = { ...stockByFile }; delete next[id]
    setStockByFile(next)
    setStockFiles(p => p.filter(f => f.id !== id))
    rebuildFromStores(next, libertyByFile, marinoByFile, salesByFile)
  }

  // ── Liberty handlers ───────────────────────────────────────────────────────
  const handleLiberty = async (files: File[]) => {
    setStatus('Reading Liberty transfer files…')
    try {
      const newByFile = { ...libertyByFile }
      const entries: FileEntry[] = []
      for (const file of files) {
        const { rows, imeis, date } = await parseOneFile(file)
        const map: Map<string, Date | null> = imeis
          ? new Map(imeis.map(i => [i, date ?? null]))
          : parseTransferExcel(rows!)
        const id = uid()
        newByFile[id] = map
        entries.push({ name: file.name, count: map.size, id })
      }
      setLibertyByFile(newByFile)
      setLibertyFiles(p => [...p, ...entries])
      rebuildFromStores(stockByFile, newByFile, marinoByFile, salesByFile)
      setStatus('')
    } catch (e: any) { setStatus('⚠ ' + e.message) }
  }

  const removeLiberty = (id: string) => {
    const next = { ...libertyByFile }; delete next[id]
    setLibertyByFile(next)
    setLibertyFiles(p => p.filter(f => f.id !== id))
    rebuildFromStores(stockByFile, next, marinoByFile, salesByFile)
  }

  // ── Marino handlers ────────────────────────────────────────────────────────
  const handleMarino = async (files: File[]) => {
    setStatus('Reading Marino transfer files…')
    try {
      const newByFile = { ...marinoByFile }
      const entries: FileEntry[] = []
      for (const file of files) {
        const { rows, imeis, date } = await parseOneFile(file)
        const map: Map<string, Date | null> = imeis
          ? new Map(imeis.map(i => [i, date ?? null]))
          : parseTransferExcel(rows!)
        const id = uid()
        newByFile[id] = map
        entries.push({ name: file.name, count: map.size, id })
      }
      setMarinoByFile(newByFile)
      setMarinoFiles(p => [...p, ...entries])
      rebuildFromStores(stockByFile, libertyByFile, newByFile, salesByFile)
      setStatus('')
    } catch (e: any) { setStatus('⚠ ' + e.message) }
  }

  const removeMarino = (id: string) => {
    const next = { ...marinoByFile }; delete next[id]
    setMarinoByFile(next)
    setMarinoFiles(p => p.filter(f => f.id !== id))
    rebuildFromStores(stockByFile, libertyByFile, next, salesByFile)
  }

  // ── Sales handlers ─────────────────────────────────────────────────────────
  const handleSales = async (files: File[]) => {
    setStatus('Reading sales files…')
    try {
      const newByFile = { ...salesByFile }
      const entries: FileEntry[] = []
      for (const file of files) {
        const { rows } = await parseOneFile(file)
        if (!rows?.length) continue
        const keys = Object.keys(rows[0])
        const iCol = keys.find(k => k.trim().toUpperCase().includes('IMEI')) || keys[5]
        if (!iCol) continue
        const set = new Set<string>()
        rows.filter(r => String(r[iCol]).replace(/\s/g, '').length >= 10)
          .forEach(r => set.add(String(r[iCol]).replace(/[\s\-]/g, '').toUpperCase()))
        const id = uid()
        newByFile[id] = set
        entries.push({ name: file.name, count: set.size, id })
      }
      setSalesByFile(newByFile)
      setSalesFiles(p => [...p, ...entries])
      rebuildFromStores(stockByFile, libertyByFile, marinoByFile, newByFile)
      setStatus('')
    } catch (e: any) { setStatus('⚠ ' + e.message) }
  }

  const removeSales = (id: string) => {
    const next = { ...salesByFile }; delete next[id]
    setSalesByFile(next)
    setSalesFiles(p => p.filter(f => f.id !== id))
    rebuildFromStores(stockByFile, libertyByFile, marinoByFile, next)
  }

  // ── Reset ──────────────────────────────────────────────────────────────────
  const reset = () => {
    setStockByFile({}); setLibertyByFile({}); setMarinoByFile({}); setSalesByFile({})
    setStockFiles([]); setLibertyFiles([]); setMarinoFiles([]); setSalesFiles([])
    setUnsoldRows([]); setStatus('')
  }

  // ── Derived counts ─────────────────────────────────────────────────────────
  const allStock = Object.values(stockByFile).flat()
  const allSales = new Set<string>()
  Object.values(salesByFile).forEach(s => s.forEach(v => allSales.add(v)))

  const soldFromCurrentStock = allStock.filter(r => allSales.has(r.imei)).length
  const counts = { Fresh: 0, Moderate: 0, Slow: 0, 'Dead stock': 0 }
  unsoldRows.forEach(r => { if (r.bucket in counts) (counts as any)[r.bucket]++ })

  const showDash = allStock.length > 0

  return (
    <div style={{ minHeight: '100vh', background: '#f3f4f6' }}>
      {/* Header */}
      <div style={{ background: '#fff', borderBottom: '1px solid #e5e7eb', padding: '14px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#111827', letterSpacing: -0.3 }}>iDealz Lanka — Stock Ageing</div>
          <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 1 }}>Prime · Liberty · Marino &nbsp;|&nbsp; As of {TODAY.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {showDash && (
            <button onClick={() => exportCSV(unsoldRows)} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, padding: '6px 14px', borderRadius: 8, border: '1px solid #d1d5db', background: '#fff', cursor: 'pointer' }}>
              <Download size={14} /> CSV
            </button>
            <button onClick={() => exportExcel(unsoldRows)} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, padding: '6px 14px', borderRadius: 8, border: '1px solid #16a34a', background: '#f0fdf4', color: '#15803d', cursor: 'pointer', fontWeight: 500 }}>
              <FileSpreadsheet size={14} /> Excel
            </button>
            <button onClick={() => exportPDF(unsoldRows)} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, padding: '6px 14px', borderRadius: 8, border: '1px solid #dc2626', background: '#fef2f2', color: '#dc2626', cursor: 'pointer', fontWeight: 500 }}>
              <FileText size={14} /> PDF
            </button>
          )}
          <button onClick={reset} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, padding: '6px 14px', borderRadius: 8, border: '1px solid #d1d5db', background: '#fff', cursor: 'pointer' }}>
            <RefreshCw size={14} /> Reset
          </button>
        </div>
      </div>

      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '20px 16px' }}>
        {/* Upload panel */}
        <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e5e7eb', padding: '20px', marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 4 }}>Upload files to run ageing analysis</div>
          <div style={{ fontSize: 12, color: '#9ca3af', marginBottom: 16 }}>Upload multiple GRN or transfer files — they are combined automatically. Click ✕ to remove a wrong file.</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 20 }}>
            <UploadZone step={1} label="Stock arrival GRNs (Prime)" files={stockFiles} accept=".xlsx,.xls,.pdf" onFiles={handleStock} onRemove={removeStock} />
            <UploadZone step={2} label="Transfer GRNs → Liberty" files={libertyFiles} accept=".xlsx,.xls,.pdf" onFiles={handleLiberty} onRemove={removeLiberty} />
            <UploadZone step={3} label="Transfer GRNs → Marino" files={marinoFiles} accept=".xlsx,.xls,.pdf" onFiles={handleMarino} onRemove={removeMarino} />
            <UploadZone step={4} label="Sales reports (all branches)" files={salesFiles} accept=".xlsx,.xls" onFiles={handleSales} onRemove={removeSales} />
          </div>
          {status && (
            <div style={{ fontSize: 12, color: status.startsWith('⚠') ? '#dc2626' : '#6b7280', marginTop: 12, textAlign: 'center', padding: '8px', background: status.startsWith('⚠') ? '#fef2f2' : '#f9fafb', borderRadius: 8 }}>
              {status}
            </div>
          )}
        </div>

        {showDash && (
          <>
            {/* Metrics */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: 10, marginBottom: 16 }}>
              {[
                { label: 'Total arrived', val: allStock.length, color: '#111827', bg: '#f9fafb' },
                { label: 'Sold (this stock)', val: soldFromCurrentStock, color: '#166534', bg: '#f0fdf4' },
                { label: 'Unsold', val: unsoldRows.length, color: '#111827', bg: '#f9fafb' },
                { label: 'Fresh (0–10d)', val: counts.Fresh, color: '#166534', bg: '#f0fdf4' },
                { label: 'Moderate (11–20d)', val: counts.Moderate, color: '#854d0e', bg: '#fefce8' },
                { label: 'Slow (21–30d)', val: counts.Slow, color: '#9a3412', bg: '#fff7ed' },
                { label: 'Dead stock (31d+)', val: counts['Dead stock'], color: '#7f1d1d', bg: '#fef2f2' },
              ].map(m => (
                <div key={m.label} style={{ background: m.bg, borderRadius: 10, padding: '12px 14px', border: '1px solid #e5e7eb' }}>
                  <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 4 }}>{m.label}</div>
                  <div style={{ fontSize: 22, fontWeight: 700, color: m.color }}>{m.val}</div>
                </div>
              ))}
            </div>

            {/* Branch + Chart */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 12, marginBottom: 16 }}>
              <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e5e7eb', padding: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 12 }}>Branch breakdown</div>
                <BranchSummary rows={unsoldRows} />
              </div>
              <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e5e7eb', padding: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 12 }}>Age distribution</div>
                <AgeChart counts={counts} />
              </div>
            </div>

            {/* Alerts */}
            <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e5e7eb', padding: 16, marginBottom: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 12 }}>🔔 Alerts</div>
              <AlertsPanel rows={unsoldRows} />
            </div>

            {/* Table */}
            <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e5e7eb', padding: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 12 }}>Unsold stock detail</div>
              <AgeingTable rows={unsoldRows} />
            </div>
          </>
        )}

        {!showDash && (
          <div style={{ textAlign: 'center', padding: '4rem', color: '#9ca3af' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>📦</div>
            <div style={{ fontSize: 15, fontWeight: 500, color: '#6b7280', marginBottom: 6 }}>Upload your stock arrival GRN files to begin</div>
            <div style={{ fontSize: 13 }}>You can upload multiple files — they will all be combined automatically</div>
          </div>
        )}
      </div>
    </div>
  )
}
