// eslint-disable-next-line @typescript-eslint/no-require-imports
const ExcelJS = require('exceljs')

export type AgeStatus = 'Fresh' | 'Moderate' | 'Slow' | 'Dead stock' | 'Unknown'
export type Branch = 'Prime' | 'Liberty' | 'Marino'

export interface StockRow {
  imei: string
  rawImei: string
  brand: string
  model: string
  date: Date | null
  location: string
}

export interface UnsoldRow extends StockRow {
  branch: Branch
  transferDate: Date | null
  // Total age = GRN date → today
  totalDays: number | null
  // Branch age = transfer date → today (for Liberty/Marino), or GRN date → today (for Prime)
  branchDays: number | null
  // Phase 1 = days at Prime before transfer
  warehouseDays: number | null
  // Bucket is based on BRANCH age (how long current branch has held it)
  bucket: AgeStatus
  // Bucket based on TOTAL age
  totalBucket: AgeStatus
  overdue: number
}

export function normIMEI(s: any): string {
  return String(s ?? '').replace(/[\s\-]/g, '').toUpperCase()
}

export function parseDateVal(v: any): Date | null {
  if (!v) return null
  if (v instanceof Date) return isNaN(v.getTime()) ? null : v
  if (typeof v === 'number') {
    const epoch = new Date(1899, 11, 30)
    const d = new Date(epoch.getTime() + v * 86400000)
    return isNaN(d.getTime()) ? null : d
  }
  const s = String(v).trim()
  const m1 = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/)
  if (m1) {
    const y = m1[3].length === 2 ? 2000 + parseInt(m1[3]) : parseInt(m1[3])
    return new Date(y, parseInt(m1[1]) - 1, parseInt(m1[2]))
  }
  const m2 = s.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/)
  if (m2) return new Date(parseInt(m2[1]), parseInt(m2[2]) - 1, parseInt(m2[3]))
  const d = new Date(s)
  return isNaN(d.getTime()) ? null : d
}

export function ageBucket(days: number): AgeStatus {
  if (days <= 10) return 'Fresh'
  if (days <= 20) return 'Moderate'
  if (days <= 30) return 'Slow'
  return 'Dead stock'
}

export function bucketThreshold(b: AgeStatus): number {
  return { Fresh: 10, Moderate: 20, Slow: 30, 'Dead stock': 31 }[b] ?? 0
}

export function actionLabel(bucket: AgeStatus, branch: Branch): { label: string; cls: string } {
  if (bucket === 'Dead stock') return { label: 'Urgent: discount / return', cls: 'action-urgent' }
  if (bucket === 'Slow') return { label: 'Consider discounting', cls: 'action-discount' }
  if (bucket === 'Moderate') return { label: 'Monitor — review pricing', cls: 'action-monitor' }
  return { label: 'On track', cls: 'action-ok' }
}

export function bucketColor(b: AgeStatus): { bg: string; color: string } {
  return {
    Fresh:        { bg: '#f0fdf4', color: '#166534' },
    Moderate:     { bg: '#fefce8', color: '#854d0e' },
    Slow:         { bg: '#fff7ed', color: '#9a3412' },
    'Dead stock': { bg: '#fef2f2', color: '#7f1d1d' },
    Unknown:      { bg: '#f3f4f6', color: '#6b7280' },
  }[b]
}

function findColIndex(headers: string[], candidates: string[]): number {
  for (const c of candidates) {
    const i = headers.findIndex(h => h.trim().toUpperCase() === c.toUpperCase())
    if (i >= 0) return i
  }
  for (const c of candidates) {
    const i = headers.findIndex(h => h.trim().toUpperCase().includes(c.toUpperCase()))
    if (i >= 0) return i
  }
  return -1
}

export async function readExcelFile(file: File): Promise<Record<string, any>[]> {
  const buffer = await file.arrayBuffer()
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.load(buffer)
  const ws = wb.worksheets[0]
  if (!ws) return []
  const rows: Record<string, any>[] = []
  let headers: string[] = []
  ws.eachRow((row: any, rowNum: number) => {
    const values = (row.values as any[]).slice(1)
    if (rowNum === 1) {
      headers = values.map((v: any) => String(v ?? ''))
    } else {
      const obj: Record<string, any> = {}
      headers.forEach((h, i) => { obj[h] = values[i] ?? '' })
      rows.push(obj)
    }
  })
  return rows
}

export function extractIMEIsFromPDFBuffer(buffer: ArrayBuffer): { imeis: string[]; date: Date | null } {
  const str = new TextDecoder('latin1').decode(new Uint8Array(buffer))
  const imeis = [...str.matchAll(/\b(\d{15})\b/g)].map(m => normIMEI(m[1]))
  const dates = [...str.matchAll(/(\d{4}-\d{2}-\d{2})/g)]
  const date = dates[0] ? new Date(dates[0][1]) : null
  return { imeis, date }
}

export function parseStockExcel(rows: Record<string, any>[]): StockRow[] {
  if (!rows.length) return []
  const headers = Object.keys(rows[0])
  const iIdx = findColIndex(headers, ['IMEI', 'imei'])
  const dIdx = findColIndex(headers, ['DATE', 'date', 'GRN DATE', 'ARRIVAL DATE'])
  const bIdx = findColIndex(headers, ['BRAND', 'brand', 'Clean Brand', 'CLEAN BRAND'])
  const mIdx = findColIndex(headers, ['MODEL', 'model', 'PRODUCT', 'DESCRIPTION', 'CATEGORY'])
  const lIdx = findColIndex(headers, ['LOCATION', 'location', 'BRANCH', 'branch'])
  if (iIdx < 0) throw new Error('No IMEI column found in stock file')
  const iCol = headers[iIdx]
  const dCol = dIdx >= 0 ? headers[dIdx] : null
  const bCol = bIdx >= 0 ? headers[bIdx] : null
  const mCol = mIdx >= 0 ? headers[mIdx] : null
  const lCol = lIdx >= 0 ? headers[lIdx] : null
  return rows
    .filter(r => normIMEI(r[iCol]).length >= 10)
    .map(r => ({
      imei: normIMEI(r[iCol]),
      rawImei: String(r[iCol]),
      brand: bCol ? String(r[bCol] ?? '') : '',
      model: mCol ? String(r[mCol] ?? '') : '',
      date: dCol ? parseDateVal(r[dCol]) : null,
      location: lCol ? String(r[lCol] ?? '') : 'Prime',
    }))
}

export function parseTransferExcel(rows: Record<string, any>[]): Map<string, Date | null> {
  const map = new Map<string, Date | null>()
  if (!rows.length) return map
  const headers = Object.keys(rows[0])
  const iIdx = findColIndex(headers, ['IMEI', 'imei'])
  const dIdx = findColIndex(headers, ['DATE', 'date', 'TRANSFER DATE', 'GRN DATE'])
  if (iIdx < 0) throw new Error('No IMEI column found in transfer file')
  const iCol = headers[iIdx]
  const dCol = dIdx >= 0 ? headers[dIdx] : null
  rows.filter(r => normIMEI(r[iCol]).length >= 10).forEach(r => {
    map.set(normIMEI(r[iCol]), dCol ? parseDateVal(r[dCol]) : null)
  })
  return map
}

export function buildUnsoldRows(
  stockData: StockRow[],
  libertyIMEIs: Map<string, Date | null>,
  marinoIMEIs: Map<string, Date | null>,
  salesIMEIs: Set<string>
): UnsoldRow[] {
  const today = new Date(); today.setHours(0, 0, 0, 0)

  const daysBetween = (a: Date | null, b: Date): number | null => {
    if (!a) return null
    const d = new Date(a); d.setHours(0, 0, 0, 0)
    return Math.max(0, Math.floor((b.getTime() - d.getTime()) / 86400000))
  }

  return stockData
    .filter(r => !salesIMEIs.has(r.imei))
    .map(r => {
      let branch: Branch = 'Prime'
      let transferDate: Date | null = null

      if (libertyIMEIs.has(r.imei)) {
        branch = 'Liberty'
        transferDate = libertyIMEIs.get(r.imei) ?? null
      } else if (marinoIMEIs.has(r.imei)) {
        branch = 'Marino'
        transferDate = marinoIMEIs.get(r.imei) ?? null
      }

      // Total age: GRN → today
      const totalDays = daysBetween(r.date, today)

      // Warehouse days: GRN → transfer (only for transferred items)
      const warehouseDays = (branch !== 'Prime' && r.date && transferDate)
        ? daysBetween(r.date, transferDate)
        : null

      // Branch age:
      // - For Liberty/Marino: transfer date → today
      // - For Prime: GRN date → today (same as totalDays)
      const branchDays = branch !== 'Prime'
        ? daysBetween(transferDate, today)
        : totalDays

      // Primary bucket = branch age (how long THIS branch has held it)
      const bucket: AgeStatus = branchDays !== null ? ageBucket(branchDays) : 'Unknown'
      // Secondary bucket = total age
      const totalBucket: AgeStatus = totalDays !== null ? ageBucket(totalDays) : 'Unknown'

      const threshold = bucketThreshold(bucket)
      const overdue = branchDays !== null ? Math.max(0, branchDays - threshold) : 0

      return { ...r, branch, transferDate, totalDays, branchDays, warehouseDays, bucket, totalBucket, overdue }
    })
}

export function exportToCSV(rows: UnsoldRow[]): void {
  const header = [
    'IMEI', 'Brand', 'Model', 'Branch',
    'GRN Date', 'Transfer Date',
    'Total Days', 'Total Age Status',
    'Warehouse Days (at Prime)',
    'Branch Days', 'Branch Age Status',
    'Days Overdue', 'Action'
  ]
  const dataRows = rows.map(r => {
    const act = actionLabel(r.bucket, r.branch)
    return [
      r.rawImei, r.brand, r.model, r.branch,
      r.date ? r.date.toLocaleDateString('en-GB') : '',
      r.transferDate ? r.transferDate.toLocaleDateString('en-GB') : '',
      r.totalDays ?? '', r.totalBucket,
      r.warehouseDays ?? '',
      r.branchDays ?? '', r.bucket,
      r.overdue > 0 ? r.overdue : '',
      act.label,
    ]
  })
  const csv = [header, ...dataRows]
    .map(row => row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
    .join('\n')
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
  a.download = `idealz_ageing_${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
}