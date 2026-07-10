'use client'
import { useState, useCallback, useRef } from 'react'
import dynamic from 'next/dynamic'
import AlertsPanel from '@/components/AlertsPanel'
import BranchSummary from '@/components/BranchSummary'
import AgeingTable from '@/components/AgeingTable'
import {
  StockRow, UnsoldRow, Branch,
  parseStockFile, parseTransferFile,
  buildUnsoldRows, exportToCSV
} from '@/lib/ageing'
import { exportCSV, exportExcel, exportPDF } from '@/lib/export'
import { Download, RefreshCw, CheckCircle, Plus, X, Upload, FileSpreadsheet, FileText } from 'lucide-react'

const AgeChart = dynamic(() => import('@/components/AgeChart'), { ssr: false })

const TODAY = new Date()

interface FileEntry { name: string; count: number; id: string; branch?: string }

// ── Date picker input ────────────────────────────────────────────────────────
function DateInput({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <label style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 4 }}>
        {label}
      </label>
      <input
        type="date"
        value={value}
        onChange={e => onChange(e.target.value)}
        style={{ fontSize: 13, padding: '6px 10px', borderRadius: 8, border: '1px solid #d1d5db', width: '100%', color: value ? '#111827' : '#9ca3af' }}
      />
      {!value && <div style={{ fontSize: 11, color: '#f59e0b', marginTop: 3 }}>⚠ Enter date so ageing can be calculated</div>}
    </div>
  )
}

// ── Upload zone ──────────────────────────────────────────────────────────────
function UploadZone({ step, label, files, accept, onFiles, onRemove, hint }: {
  step: number; label: string; files: FileEntry[]
  accept: string; onFiles: (f: File[]) => void
  onRemove: (id: string) => void; hint?: string
}) {
  const ref = useRef<HTMLInputElement>(null)
  const [drag, setDrag] = useState(false)
  const open = () => { if (ref.current) { ref.current.value = ''; ref.current.click() } }

  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 18, height: 18, borderRadius: '50%', background: '#dbeafe', color: '#1e40af', fontSize: 10, fontWeight: 700, flexShrink: 0 }}>{step}</span>
        {label}
      </div>
      {hint && <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 6 }}>{hint}</div>}
      {files.map(f => (
        <div key={f.id} style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: '6px 10px', marginBottom: 6 }}>
          <CheckCircle size={13} color="#16a34a" style={{ flexShrink: 0 }} />
          <div style={{ flex: 1, overflow: 'hidden' }}>
            <div style={{ fontSize: 11, color: '#166534', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={f.name}>{f.name}</div>
            {f.branch && <div style={{ fontSize: 10, color: '#6b7280' }}>Branch: {f.branch} · {f.count} IMEIs</div>}
            {!f.branch && <div style={{ fontSize: 10, color: '#6b7280' }}>{f.count} IMEIs</div>}
          </div>
          <button onClick={() => onRemove(f.id)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: 2, display: 'flex', alignItems: 'center', flexShrink: 0 }} title="Remove">
            <X size={13} color="#dc2626" />
          </button>
        </div>
      ))}
      <input ref={ref} type="file" accept={accept} multiple style={{ display: 'none' }}
        onChange={e => { const l = e.target.files; if (l && l.length > 0) onFiles(Array.from(l)); e.target.value = '' }} />
      <div
        onClick={open}
        onDragOver={e => { e.preventDefault(); e.stopPropagation(); setDrag(true) }}
        onDragEnter={e => { e.preventDefault(); e.stopPropagation(); setDrag(true) }}
        onDragLeave={() => setDrag(false)}
        onDrop={e => { e.preventDefault(); e.stopPropagation(); setDrag(false); const l = Array.from(e.dataTransfer.files); if (l.length) onFiles(l) }}
        style={{ border: `2px dashed ${drag ? '#3b82f6' : '#d1d5db'}`, borderRadius: 10, padding: '12px 10px', textAlign: 'center', cursor: 'pointer', background: drag ? '#eff6ff' : '#fafafa', transition: 'all 0.15s', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}
      >
        <Upload size={15} color={drag ? '#3b82f6' : '#9ca3af'} />
        <span style={{ fontSize: 12, color: drag ? '#3b82f6' : '#9ca3af', fontWeight: 500 }}>
          {files.length > 0 ? 'Add more files' : 'Click or drag files here'}
        </span>
        <span style={{ fontSize: 10, color: '#d1d5db' }}>{accept.replace(/\./g, '').toUpperCase().replace(/,/g, ' · ')}</span>
      </div>
    </div>
  )
}

// ── Main Dashboard ───────────────────────────────────────────────────────────
export default function Dashboard() {
  // Date inputs — one per upload slot
  const [stockDate, setStockDate] = useState('')
  const [libertyDate, setLibertyDate] = useState('')
  const [marinoDate, setMarinoDate] = useState('')

  // Per-file data stores
  const [stockByFile, setStockByFile] = useState<Record<string, StockRow[]>>({})
  const [libertyByFile, setLibertyByFile] = useState<Record<string, Map<string, Date | null>>>({})
  const [marinoByFile, setMarinoByFile] = useState<Record<string, Map<string, Date | null>>>({})
  const [salesByFile, setSalesByFile] = useState<Record<string, Set<string>>>({})

  const [stockFiles, setStockFiles] = useState<FileEntry[]>([])
  const [libertyFiles, setLibertyFiles] = useState<FileEntry[]>([])
  const [marinoFiles, setMarinoFiles] = useState<FileEntry[]>([])
  const [salesFiles, setSalesFiles] = useState<FileEntry[]>([])

  const [unsoldRows, setUnsoldRows] = useState<UnsoldRow[]>([])
  const [status, setStatus] = useState('')

  const uid = () => Math.random().toString(36).slice(2)

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

  // STOCK — Location Wise Stock reports, auto-detects branch
  const handleStock = async (files: File[]) => {
    setStatus('Reading stock files…')
    try {
      const date = stockDate ? new Date(stockDate) : null
      const newByFile = { ...stockByFile }
      const entries: FileEntry[] = []
      for (const file of files) {
        const parsed = await parseStockFile(file, date)
        const id = uid()
        newByFile[id] = parsed
        // Show which branch was detected
        const branches = [...new Set(parsed.map(r => r.location))].join(', ')
        entries.push({ name: file.name, count: parsed.length, id, branch: branches || 'Auto-detected' })
      }
      setStockByFile(newByFile)
      setStockFiles(p => [...p, ...entries])
      rebuildFromStores(newByFile, libertyByFile, marinoByFile, salesByFile)
      setStatus('')
    } catch (e: any) { setStatus('⚠ ' + e.message) }
  }

  const removeStock = (id: string) => {
    const next = { ...stockByFile }; delete next[id]
    setStockByFile(next); setStockFiles(p => p.filter(f => f.id !== id))
    rebuildFromStores(next, libertyByFile, marinoByFile, salesByFile)
  }

  // LIBERTY transfers
  const handleLiberty = async (files: File[]) => {
    setStatus('Reading Liberty transfer files…')
    try {
      const date = libertyDate ? new Date(libertyDate) : null
      const newByFile = { ...libertyByFile }
      const entries: FileEntry[] = []
      for (const file of files) {
        const map = await parseTransferFile(file, date)
        const id = uid()
        newByFile[id] = map
        entries.push({ name: file.name, count: map.size, id })
      }
      setLibertyByFile(newByFile); setLibertyFiles(p => [...p, ...entries])
      rebuildFromStores(stockByFile, newByFile, marinoByFile, salesByFile)
      setStatus('')
    } catch (e: any) { setStatus('⚠ ' + e.message) }
  }

  const removeLiberty = (id: string) => {
    const next = { ...libertyByFile }; delete next[id]
    setLibertyByFile(next); setLibertyFiles(p => p.filter(f => f.id !== id))
    rebuildFromStores(stockByFile, next, marinoByFile, salesByFile)
  }

  // MARINO transfers
  const handleMarino = async (files: File[]) => {
    setStatus('Reading Marino transfer files…')
    try {
      const date = marinoDate ? new Date(marinoDate) : null
      const newByFile = { ...marinoByFile }
      const entries: FileEntry[] = []
      for (const file of files) {
        const map = await parseTransferFile(file, date)
        const id = uid()
        newByFile[id] = map
        entries.push({ name: file.name, count: map.size, id })
      }
      setMarinoByFile(newByFile); setMarinoFiles(p => [...p, ...entries])
      rebuildFromStores(stockByFile, libertyByFile, newByFile, salesByFile)
      setStatus('')
    } catch (e: any) { setStatus('⚠ ' + e.message) }
  }

  const removeMarino = (id: string) => {
    const next = { ...marinoByFile }; delete next[id]
    setMarinoByFile(next); setMarinoFiles(p => p.filter(f => f.id !== id))
    rebuildFromStores(stockByFile, libertyByFile, next, salesByFile)
  }

  // SALES
  const handleSales = async (files: File[]) => {
    setStatus('Reading sales files…')
    try {
      const newByFile = { ...salesByFile }
      const entries: FileEntry[] = []
      for (const file of files) {
        const parsed = await parseStockFile(file, null)
        // If it parses as stock, use IMEIs from it
        if (parsed.length > 0) {
          const set = new Set(parsed.map(r => r.imei))
          const id = uid()
          newByFile[id] = set
          entries.push({ name: file.name, count: set.size, id })
        } else {
          // Try reading as flat Excel with IMEI column
          const { readExcelRaw } = await import('@/lib/ageing')
          const { rows } = await readExcelRaw(file)
          const headers = (rows[0] || []).map((v: any) => String(v ?? '').toUpperCase())
          const iIdx = headers.findIndex(h => h.includes('IMEI'))
          if (iIdx >= 0) {
            const set = new Set<string>()
            rows.slice(1).forEach(r => {
              const v = String(r[iIdx] ?? '').replace(/[\s\-]/g, '').toUpperCase()
              if (v.length >= 10) set.add(v)
            })
            const id = uid()
            newByFile[id] = set
            entries.push({ name: file.name, count: set.size, id })
          }
        }
      }
      setSalesByFile(newByFile); setSalesFiles(p => [...p, ...entries])
      rebuildFromStores(stockByFile, libertyByFile, marinoByFile, newByFile)
      setStatus('')
    } catch (e: any) { setStatus('⚠ ' + e.message) }
  }

  const removeSales = (id: string) => {
    const next = { ...salesByFile }; delete next[id]
    setSalesByFile(next); setSalesFiles(p => p.filter(f => f.id !== id))
    rebuildFromStores(stockByFile, libertyByFile, marinoByFile, next)
  }

  const reset = () => {
    setStockByFile({}); setLibertyByFile({}); setMarinoByFile({}); setSalesByFile({})
    setStockFiles([]); setLibertyFiles([]); setMarinoFiles([]); setSalesFiles([])
    setUnsoldRows([]); setStatus('')
    setStockDate(''); setLibertyDate(''); setMarinoDate('')
  }

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
            <>
              <button onClick={() => exportCSV(unsoldRows)} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, padding: '6px 14px', borderRadius: 8, border: '1px solid #d1d5db', background: '#fff', cursor: 'pointer' }}>
                <Download size={14} /> CSV
              </button>
              <button onClick={() => exportExcel(unsoldRows)} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, padding: '6px 14px', borderRadius: 8, border: '1px solid #16a34a', background: '#f0fdf4', color: '#15803d', cursor: 'pointer', fontWeight: 500 }}>
                <FileSpreadsheet size={14} /> Excel
              </button>
              <button onClick={() => exportPDF(unsoldRows)} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, padding: '6px 14px', borderRadius: 8, border: '1px solid #dc2626', background: '#fef2f2', color: '#dc2626', cursor: 'pointer', fontWeight: 500 }}>
                <FileText size={14} /> PDF
              </button>
            </>
          )}
          <button onClick={reset} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, padding: '6px 14px', borderRadius: 8, border: '1px solid #d1d5db', background: '#fff', cursor: 'pointer' }}>
            <RefreshCw size={14} /> Reset
          </button>
        </div>
      </div>

      <div style={{ maxWidth: 1300, margin: '0 auto', padding: '20px 16px' }}>
        {/* Upload panel */}
        <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e5e7eb', padding: '20px', marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 4 }}>Upload files to run ageing analysis</div>
          <div style={{ fontSize: 12, color: '#9ca3af', marginBottom: 16 }}>
            Supports <strong>Location Wise Stock Reports</strong> (auto-detects branch) and standard GRN Excel/PDF files.
            Enter the report date so ageing days can be calculated.
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 20 }}>
            {/* Stock */}
            <div style={{ padding: 14, background: '#f8fafc', borderRadius: 12, border: '1px solid #e5e7eb' }}>
              <DateInput label="Stock report date" value={stockDate} onChange={v => setStockDate(v)} />
              <UploadZone step={1} label="Stock files (all branches)" files={stockFiles} accept=".xlsx,.xls,.pdf"
                onFiles={handleStock} onRemove={removeStock}
                hint="Upload Location Wise Stock reports — branch is auto-detected from file" />
            </div>

            {/* Liberty transfers */}
            <div style={{ padding: 14, background: '#f8fafc', borderRadius: 12, border: '1px solid #e5e7eb' }}>
              <DateInput label="Liberty transfer date" value={libertyDate} onChange={v => setLibertyDate(v)} />
              <UploadZone step={2} label="Transfer GRNs → Liberty" files={libertyFiles} accept=".xlsx,.xls,.pdf"
                onFiles={handleLiberty} onRemove={removeLiberty}
                hint="GRN files for stock sent from Prime to Liberty" />
            </div>

            {/* Marino transfers */}
            <div style={{ padding: 14, background: '#f8fafc', borderRadius: 12, border: '1px solid #e5e7eb' }}>
              <DateInput label="Marino transfer date" value={marinoDate} onChange={v => setMarinoDate(v)} />
              <UploadZone step={3} label="Transfer GRNs → Marino" files={marinoFiles} accept=".xlsx,.xls,.pdf"
                onFiles={handleMarino} onRemove={removeMarino}
                hint="GRN files for stock sent from Prime to Marino" />
            </div>

            {/* Sales */}
            <div style={{ padding: 14, background: '#f8fafc', borderRadius: 12, border: '1px solid #e5e7eb' }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Sales report</div>
              <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 10 }}>Upload daily sales Excel to mark IMEIs as sold</div>
              <UploadZone step={4} label="Sales reports (all branches)" files={salesFiles} accept=".xlsx,.xls"
                onFiles={handleSales} onRemove={removeSales}
                hint="Standard sales report with IMEI column" />
            </div>
          </div>

          {status && (
            <div style={{ fontSize: 12, color: status.startsWith('⚠') ? '#dc2626' : '#6b7280', marginTop: 12, textAlign: 'center', padding: 8, background: status.startsWith('⚠') ? '#fef2f2' : '#f9fafb', borderRadius: 8 }}>
              {status}
            </div>
          )}
        </div>

        {showDash && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: 10, marginBottom: 16 }}>
              {[
                { label: 'Total in stock', val: allStock.length, color: '#111827', bg: '#f9fafb' },
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

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 12, marginBottom: 16 }}>
              <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e5e7eb', padding: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 12 }}>Branch breakdown</div>
                <BranchSummary rows={unsoldRows} />
              </div>
              <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e5e7eb', padding: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 12 }}>Age distribution</div>
                <AgeChart counts={counts} />
              </div>
            </div>

            <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e5e7eb', padding: 16, marginBottom: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 12 }}>🔔 Alerts</div>
              <AlertsPanel rows={unsoldRows} />
            </div>

            <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e5e7eb', padding: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 12 }}>Unsold stock detail</div>
              <AgeingTable rows={unsoldRows} />
            </div>
          </>
        )}

        {!showDash && (
          <div style={{ textAlign: 'center', padding: '4rem', color: '#9ca3af' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>📦</div>
            <div style={{ fontSize: 15, fontWeight: 500, color: '#6b7280', marginBottom: 6 }}>Upload your Location Wise Stock reports to begin</div>
            <div style={{ fontSize: 13 }}>Enter the report date first, then upload the files</div>
          </div>
        )}
      </div>
    </div>
  )
}
