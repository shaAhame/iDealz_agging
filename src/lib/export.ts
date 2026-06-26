import { UnsoldRow, actionLabel } from './ageing'

const fmt = (d: Date | null) =>
  d ? d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'

// ── CSV (already exists, keeping for reference) ────────────────────────────
export function exportCSV(rows: UnsoldRow[]) {
  const header = [
    'IMEI', 'Brand', 'Model', 'Branch',
    'GRN Date', 'Transfer Date',
    'Warehouse Days (at Prime)',
    'Branch Days', 'Branch Status',
    'Total Days', 'Total Status',
    'Days Overdue', 'Action'
  ]
  const data = rows.map(r => {
    const act = actionLabel(r.bucket, r.branch)
    return [
      r.rawImei, r.brand, r.model, r.branch,
      fmt(r.date), fmt(r.transferDate),
      r.warehouseDays ?? '',
      r.branchDays ?? '', r.bucket,
      r.totalDays ?? '', r.totalBucket,
      r.overdue > 0 ? r.overdue : '',
      act.label,
    ]
  })
  const csv = [header, ...data]
    .map(row => row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
    .join('\n')
  trigger(new Blob([csv], { type: 'text/csv' }), `idealz_ageing_${today()}.csv`)
}

// ── Excel ──────────────────────────────────────────────────────────────────
export async function exportExcel(rows: UnsoldRow[]) {
  const ExcelJS = require('exceljs')
  const wb = new ExcelJS.Workbook()
  wb.creator = 'iDealz Lanka'
  wb.created = new Date()

  const ws = wb.addWorksheet('Unsold Stock Ageing')

  // Column definitions
  ws.columns = [
    { header: 'IMEI',                    key: 'imei',          width: 20 },
    { header: 'Brand',                   key: 'brand',         width: 14 },
    { header: 'Model',                   key: 'model',         width: 28 },
    { header: 'Branch',                  key: 'branch',        width: 10 },
    { header: 'GRN Date',               key: 'grn',           width: 14 },
    { header: 'Transfer Date',           key: 'transfer',      width: 14 },
    { header: 'Warehouse Days (Prime)',  key: 'warehouse',     width: 20 },
    { header: 'Branch Days',             key: 'branchDays',    width: 14 },
    { header: 'Branch Status',           key: 'branchStatus',  width: 14 },
    { header: 'Total Days',              key: 'totalDays',     width: 12 },
    { header: 'Total Status',            key: 'totalStatus',   width: 14 },
    { header: 'Days Overdue',            key: 'overdue',       width: 14 },
    { header: 'Action',                  key: 'action',        width: 26 },
  ]

  // Header row styling
  const headerRow = ws.getRow(1)
  headerRow.eachCell((cell: any) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A8A' } }
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 }
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }
    cell.border = {
      bottom: { style: 'thin', color: { argb: 'FFBFDBFE' } },
      right: { style: 'thin', color: { argb: 'FF1E40AF' } },
    }
  })
  headerRow.height = 32

  // Status colors
  const statusFill: Record<string, string> = {
    Fresh:        'FFD1FAE5',
    Moderate:     'FFFEF9C3',
    Slow:         'FFFFEDD5',
    'Dead stock': 'FFFEE2E2',
  }
  const statusFont: Record<string, string> = {
    Fresh:        'FF166534',
    Moderate:     'FF854D0E',
    Slow:         'FF9A3412',
    'Dead stock': 'FF7F1D1D',
  }
  const branchFill: Record<string, string> = {
    Prime:   'FFDBEAFE',
    Liberty: 'FFEDE9FE',
    Marino:  'FFD1FAE5',
  }
  const branchFont: Record<string, string> = {
    Prime:   'FF1E3A8A',
    Liberty: 'FF3730A3',
    Marino:  'FF064E3B',
  }

  // Data rows
  rows.forEach((r, idx) => {
    const act = actionLabel(r.bucket, r.branch)
    const row = ws.addRow({
      imei:         r.rawImei,
      brand:        r.brand || '—',
      model:        r.model || '—',
      branch:       r.branch,
      grn:          fmt(r.date),
      transfer:     fmt(r.transferDate),
      warehouse:    r.warehouseDays ?? '—',
      branchDays:   r.branchDays ?? '—',
      branchStatus: r.bucket,
      totalDays:    r.totalDays ?? '—',
      totalStatus:  r.totalBucket,
      overdue:      r.overdue > 0 ? r.overdue : '—',
      action:       act.label,
    })

    // Zebra striping
    const baseFill = idx % 2 === 0 ? 'FFFFFFFF' : 'FFF8FAFC'

    row.eachCell((cell: any, col: number) => {
      cell.alignment = { vertical: 'middle', horizontal: col === 1 ? 'left' : 'center' }
      cell.border = { bottom: { style: 'hair', color: { argb: 'FFE5E7EB' } } }
    })

    // Branch color
    const branchCell = row.getCell('branch')
    branchCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: branchFill[r.branch] || baseFill } }
    branchCell.font = { bold: true, color: { argb: branchFont[r.branch] || 'FF374151' }, size: 11 }

    // Branch status color
    const bsCell = row.getCell('branchStatus')
    bsCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: statusFill[r.bucket] || baseFill } }
    bsCell.font = { bold: true, color: { argb: statusFont[r.bucket] || 'FF374151' }, size: 11 }

    // Total status color
    const tsCell = row.getCell('totalStatus')
    tsCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: statusFill[r.totalBucket] || baseFill } }
    tsCell.font = { color: { argb: statusFont[r.totalBucket] || 'FF374151' }, size: 11 }

    // Overdue highlight
    if (r.overdue > 0) {
      const odCell = row.getCell('overdue')
      odCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEE2E2' } }
      odCell.font = { bold: true, color: { argb: 'FF7F1D1D' }, size: 11 }
    }

    row.height = 22
  })

  // Summary sheet
  const ws2 = wb.addWorksheet('Summary')
  ws2.columns = [
    { header: 'Category', key: 'cat', width: 24 },
    { header: 'Count',    key: 'cnt', width: 10 },
  ]
  ws2.getRow(1).eachCell((cell: any) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A8A' } }
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 }
    cell.alignment = { horizontal: 'center' }
  })

  const counts = (filterFn: (r: UnsoldRow) => boolean) => rows.filter(filterFn).length
  const summaryData = [
    ['Total Unsold',              rows.length],
    ['— Fresh (0–10d)',           counts(r => r.bucket === 'Fresh')],
    ['— Moderate (11–20d)',       counts(r => r.bucket === 'Moderate')],
    ['— Slow (21–30d)',           counts(r => r.bucket === 'Slow')],
    ['— Dead stock (31d+)',       counts(r => r.bucket === 'Dead stock')],
    ['', ''],
    ['Prime — Total unsold',      counts(r => r.branch === 'Prime')],
    ['Prime — Dead stock',        counts(r => r.branch === 'Prime' && r.bucket === 'Dead stock')],
    ['Liberty — Total unsold',    counts(r => r.branch === 'Liberty')],
    ['Liberty — Dead stock',      counts(r => r.branch === 'Liberty' && r.bucket === 'Dead stock')],
    ['Marino — Total unsold',     counts(r => r.branch === 'Marino')],
    ['Marino — Dead stock',       counts(r => r.branch === 'Marino' && r.bucket === 'Dead stock')],
    ['', ''],
    ['Generated on', new Date().toLocaleDateString('en-GB')],
  ]
  summaryData.forEach(([cat, cnt]) => {
    const row = ws2.addRow({ cat, cnt })
    row.height = 20
    row.getCell('cat').alignment = { horizontal: 'left' }
    row.getCell('cnt').alignment = { horizontal: 'center' }
    if (String(cat).startsWith('— Dead') || String(cat).includes('Dead stock')) {
      row.getCell('cnt').font = { bold: true, color: { argb: 'FF7F1D1D' } }
    }
  })

  // Download
  const buf = await wb.xlsx.writeBuffer()
  trigger(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `idealz_ageing_${today()}.xlsx`)
}

// ── PDF ─────────────────────────────────────────────────────────────────────
export async function exportPDF(rows: UnsoldRow[]) {
  // Dynamically load jsPDF + autoTable
  await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js')
  await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js')

  const { jsPDF } = (window as any).jspdf
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })

  // Title
  doc.setFillColor(30, 58, 138)
  doc.rect(0, 0, 297, 18, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  doc.text('iDealz Lanka — Unsold Stock Ageing Report', 14, 12)
  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.text(`Generated: ${new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}   Total unsold: ${rows.length}`, 200, 12)

  // Summary row
  const counts = {
    Fresh:        rows.filter(r => r.bucket === 'Fresh').length,
    Moderate:     rows.filter(r => r.bucket === 'Moderate').length,
    Slow:         rows.filter(r => r.bucket === 'Slow').length,
    'Dead stock': rows.filter(r => r.bucket === 'Dead stock').length,
  }
  doc.setTextColor(30, 58, 138)
  doc.setFontSize(9)
  doc.setFont('helvetica', 'bold')
  doc.text(
    `Fresh: ${counts.Fresh}   Moderate: ${counts.Moderate}   Slow: ${counts.Slow}   Dead stock: ${counts['Dead stock']}`,
    14, 24
  )

  // Status colors for PDF
  const statusColor: Record<string, [number, number, number]> = {
    Fresh:        [220, 252, 231],
    Moderate:     [254, 249, 195],
    Slow:         [255, 237, 213],
    'Dead stock': [254, 226, 226],
  }
  const branchColor: Record<string, [number, number, number]> = {
    Prime:   [219, 234, 254],
    Liberty: [237, 233, 254],
    Marino:  [209, 250, 229],
  }

  ;(doc as any).autoTable({
    startY: 28,
    head: [[
      'IMEI', 'Brand', 'Model', 'Branch',
      'GRN Date', 'Transfer Date',
      'WH Days', 'Branch Days', 'Branch Status',
      'Total Days', 'Total Status',
      'Overdue', 'Action'
    ]],
    body: rows.map(r => {
      const act = actionLabel(r.bucket, r.branch)
      return [
        r.rawImei, r.brand || '—', r.model || '—', r.branch,
        fmt(r.date), fmt(r.transferDate),
        r.warehouseDays ?? '—',
        r.branchDays ?? '—', r.bucket,
        r.totalDays ?? '—', r.totalBucket,
        r.overdue > 0 ? `+${r.overdue}d` : '—',
        act.label,
      ]
    }),
    theme: 'grid',
    headStyles: {
      fillColor: [30, 58, 138],
      textColor: [255, 255, 255],
      fontSize: 8,
      fontStyle: 'bold',
      halign: 'center',
      cellPadding: 3,
    },
    bodyStyles: { fontSize: 8, cellPadding: 2.5 },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: {
      0: { cellWidth: 32, halign: 'left' },
      1: { cellWidth: 16 },
      2: { cellWidth: 30 },
      3: { cellWidth: 16, halign: 'center' },
      4: { cellWidth: 20, halign: 'center' },
      5: { cellWidth: 20, halign: 'center' },
      6: { cellWidth: 14, halign: 'center' },
      7: { cellWidth: 18, halign: 'center' },
      8: { cellWidth: 20, halign: 'center' },
      9: { cellWidth: 16, halign: 'center' },
      10: { cellWidth: 18, halign: 'center' },
      11: { cellWidth: 14, halign: 'center' },
      12: { cellWidth: 26, halign: 'center' },
    },
    didParseCell: (data: any) => {
      if (data.section === 'body') {
        // Branch column
        if (data.column.index === 3) {
          const c = branchColor[data.cell.raw as string]
          if (c) { data.cell.styles.fillColor = c; data.cell.styles.fontStyle = 'bold' }
        }
        // Branch status
        if (data.column.index === 8) {
          const c = statusColor[data.cell.raw as string]
          if (c) { data.cell.styles.fillColor = c; data.cell.styles.fontStyle = 'bold' }
        }
        // Total status
        if (data.column.index === 10) {
          const c = statusColor[data.cell.raw as string]
          if (c) data.cell.styles.fillColor = c
        }
        // Overdue
        if (data.column.index === 11 && String(data.cell.raw).startsWith('+')) {
          data.cell.styles.fillColor = [254, 226, 226]
          data.cell.styles.fontStyle = 'bold'
          data.cell.styles.textColor = [127, 29, 29]
        }
      }
    },
    margin: { left: 5, right: 5 },
  })

  // Page numbers
  const pageCount = (doc as any).internal.getNumberOfPages()
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)
    doc.setFontSize(8)
    doc.setTextColor(156, 163, 175)
    doc.text(`Page ${i} of ${pageCount}`, 280, 205)
    doc.text('iDealz Lanka (Pvt) Ltd', 14, 205)
  }

  doc.save(`idealz_ageing_${today()}.pdf`)
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function today() { return new Date().toISOString().slice(0, 10) }

function trigger(blob: Blob, filename: string) {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) { resolve(); return }
    const s = document.createElement('script')
    s.src = src; s.onload = () => resolve(); s.onerror = reject
    document.head.appendChild(s)
  })
}
