// eslint-disable-next-line @typescript-eslint/no-require-imports
const ExcelJS = require('exceljs')

export type AgeStatus = 'Fresh' | 'Moderate' | 'Slow' | 'Dead stock' | 'Unknown'
export type Branch = 'Prime' | 'Liberty' | 'Marino'

export interface StockRow {
  imei: string
  rawImei: string
  brand: string
  model: string
  itemCode: string
  date: Date | null
  location: string
}

export interface UnsoldRow extends StockRow {
  branch: Branch
  transferDate: Date | null
  totalDays: number | null
  branchDays: number | null
  warehouseDays: number | null
  bucket: AgeStatus
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
  return ({
    Fresh:        { bg: '#f0fdf4', color: '#166534' },
    Moderate:     { bg: '#fefce8', color: '#854d0e' },
    Slow:         { bg: '#fff7ed', color: '#9a3412' },
    'Dead stock': { bg: '#fef2f2', color: '#7f1d1d' },
    Unknown:      { bg: '#f3f4f6', color: '#6b7280' },
  } as any)[b] ?? { bg: '#f3f4f6', color: '#6b7280' }
}

function guessBrand(name: string): string {
  const n = name.toUpperCase()
  if (n.includes('IPHONE') || n.includes('APPLE') || n.includes('AIRTAG') || n.includes('IPAD') || n.includes('MACBOOK')) return 'Apple'
  if (n.includes('SAMSUNG') || n.includes('GALAXY')) return 'Samsung'
  if (n.includes('REDMI') || n.includes('XIAOMI') || n.includes('MI ')) return 'Xiaomi'
  if (n.includes('HUAWEI')) return 'Huawei'
  if (n.includes('OPPO')) return 'Oppo'
  if (n.includes('VIVO')) return 'Vivo'
  if (n.includes('NOKIA')) return 'Nokia'
  if (n.includes('HONOR')) return 'Honor'
  if (n.includes('INFINIX')) return 'Infinix'
  if (n.includes('BLACKVIEW')) return 'Blackview'
  return 'Other'
}

function detectBranchFromHeader(headerText: string): Branch {
  const t = headerText.toUpperCase()
  if (t.includes('MARINO')) return 'Marino'
  if (t.includes('LIBERTY') || t.includes('HEAD OFFICE')) return 'Liberty'
  if (t.includes('PRIME') || t.includes('IDEALZ-PRIME')) return 'Prime'
  return 'Prime'
}

function isLocationWiseReport(rows: any[][]): boolean {
  const flat = rows.slice(0, 4).map(r => (r || []).join(' ')).join(' ').toUpperCase()
  return flat.includes('LOCATION WISE STOCK') || flat.includes('LOCATION :')
}

// Location Wise Stock report parser
// Row N  : ItemCode (col0), ItemName (col5-ish), Qty (col8-ish)
// Row N+1: empty col0, serial numbers spread across other columns
function parseLocationWiseReport(rows: any[][], reportDate: Date | null, branch: Branch): StockRow[] {
  const results: StockRow[] = []
  let currentItemCode = ''
  let currentItemName = ''

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i] || []
    const col0 = String(row[0] ?? '').trim()

    // Find item name — scan columns for a meaningful name string
    let itemName = ''
    for (let c = 1; c < row.length; c++) {
      const v = String(row[c] ?? '').trim()
      if (v.length > 5 && /[A-Za-z]/.test(v) && !/^\d+(\.\d+)?$/.test(v)) {
        itemName = v
        break
      }
    }

    // Product row: col0 has item code starting with letter
    if (col0 && /^[A-Za-z]/.test(col0) && itemName) {
      currentItemCode = col0
      currentItemName = itemName
      continue
    }

    // Serial row: col0 is empty, other columns have serials
    if (!col0 && currentItemCode) {
      for (let c = 0; c < row.length; c++) {
        const val = String(row[c] ?? '').trim()
        if (/^\d{15}$/.test(val)) {
          results.push({
            imei: normIMEI(val),
            rawImei: val,
            brand: guessBrand(currentItemName),
            model: currentItemName,
            itemCode: currentItemCode,
            date: reportDate,
            location: branch,
          })
        }
      }
    }
  }

  return results
}

// Read Excel file as raw 2D array
export async function readExcelRaw(file: File): Promise<{ rows: any[][]; headerText: string }> {
  const buffer = await file.arrayBuffer()
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.load(buffer)
  const ws = wb.worksheets[0]
  if (!ws) return { rows: [], headerText: '' }
  const rows: any[][] = []
  let headerText = ''
  ws.eachRow((row: any, rowNum: number) => {
    const values = (row.values as any[]).slice(1)
    if (rowNum <= 4) headerText += values.join(' ') + ' '
    rows.push(values)
  })
  return { rows, headerText }
}

function findColIndex(headers: string[], candidates: string[]): number {
  for (const c of candidates) {
    const i = headers.findIndex(h => String(h).trim().toUpperCase() === c.toUpperCase())
    if (i >= 0) return i
  }
  for (const c of candidates) {
    const i = headers.findIndex(h => String(h).trim().toUpperCase().includes(c.toUpperCase()))
    if (i >= 0) return i
  }
  return -1
}

function parseStockExcelRows(rows: any[][]): StockRow[] {
  if (!rows.length) return []
  const headers = (rows[0] || []).map((v: any) => String(v ?? ''))
  const iIdx = findColIndex(headers, ['IMEI', 'imei', 'Serial', 'SERIAL NO'])
  const dIdx = findColIndex(headers, ['DATE', 'GRN DATE', 'ARRIVAL DATE'])
  const bIdx = findColIndex(headers, ['BRAND', 'Clean Brand'])
  const mIdx = findColIndex(headers, ['MODEL', 'PRODUCT', 'DESCRIPTION', 'CATEGORY', 'Item Name'])
  const cIdx = findColIndex(headers, ['Item Code', 'CODE', 'SKU'])
  if (iIdx < 0) throw new Error('No IMEI column found in stock file')
  return rows.slice(1)
    .filter(r => normIMEI(r[iIdx]).length >= 10)
    .map(r => ({
      imei: normIMEI(r[iIdx]),
      rawImei: String(r[iIdx]),
      brand: bIdx >= 0 ? String(r[bIdx] ?? '') : guessBrand(mIdx >= 0 ? String(r[mIdx] ?? '') : ''),
      model: mIdx >= 0 ? String(r[mIdx] ?? '') : '',
      itemCode: cIdx >= 0 ? String(r[cIdx] ?? '') : '',
      date: dIdx >= 0 ? parseDateVal(r[dIdx]) : null,
      location: 'Prime',
    }))
}

// Auto-detect file format and parse
export async function parseStockFile(file: File, reportDate: Date | null, branchHint?: Branch): Promise<StockRow[]> {
  const ext = file.name.split('.').pop()?.toLowerCase()
  if (ext === 'pdf') {
    const buf = await file.arrayBuffer()
    const { imeis, date } = extractIMEIsFromPDFBuffer(buf)
    return imeis.map(imei => ({
      imei, rawImei: imei, brand: '', model: '', itemCode: '',
      date: reportDate ?? date, location: branchHint ?? 'Prime',
    }))
  }
  const { rows, headerText } = await readExcelRaw(file)
  if (!rows.length) return []
  if (isLocationWiseReport(rows)) {
    const branch = branchHint ?? detectBranchFromHeader(headerText)
    return parseLocationWiseReport(rows, reportDate, branch)
  }
  return parseStockExcelRows(rows)
}

export async function parseTransferFile(file: File, reportDate: Date | null): Promise<Map<string, Date | null>> {
  const map = new Map<string, Date | null>()
  const ext = file.name.split('.').pop()?.toLowerCase()
  if (ext === 'pdf') {
    const buf = await file.arrayBuffer()
    const { imeis, date } = extractIMEIsFromPDFBuffer(buf)
    imeis.forEach(i => map.set(i, reportDate ?? date))
    return map
  }
  const { rows, headerText } = await readExcelRaw(file)
  if (!rows.length) return map
  if (isLocationWiseReport(rows)) {
    const parsed = parseLocationWiseReport(rows, reportDate, 'Prime')
    parsed.forEach(r => map.set(r.imei, reportDate))
    return map
  }
  const headers = (rows[0] || []).map((v: any) => String(v ?? ''))
  const iIdx = findColIndex(headers, ['IMEI', 'imei', 'Serial'])
  const dIdx = findColIndex(headers, ['DATE', 'TRANSFER DATE', 'GRN DATE'])
  if (iIdx < 0) throw new Error('No IMEI column found in transfer file')
  rows.slice(1).filter(r => normIMEI(r[iIdx]).length >= 10).forEach(r => {
    map.set(normIMEI(r[iIdx]), dIdx >= 0 ? parseDateVal(r[dIdx]) : reportDate)
  })
  return map
}

export function extractIMEIsFromPDFBuffer(buffer: ArrayBuffer): { imeis: string[]; date: Date | null } {
  const str = new TextDecoder('latin1').decode(new Uint8Array(buffer))
  const imeis = [...str.matchAll(/\b(\d{15})\b/g)].map(m => normIMEI(m[1]))
  const dates = [...str.matchAll(/(\d{4}-\d{2}-\d{2})/g)]
  const date = dates[0] ? new Date(dates[0][1]) : null
  return { imeis, date }
}

export function buildUnsoldRows(
  stockData: StockRow[],
  libertyIMEIs: Map<string, Date | null>,
  marinoIMEIs: Map<string, Date | null>,
  salesIMEIs: Set<string>
): UnsoldRow[] {
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const diff = (a: Date | null, b: Date): number | null => {
    if (!a) return null
    const d = new Date(a); d.setHours(0, 0, 0, 0)
    return Math.max(0, Math.floor((b.getTime() - d.getTime()) / 86400000))
  }
  return stockData.filter(r => !salesIMEIs.has(r.imei)).map(r => {
    let branch: Branch = (r.location as Branch) || 'Prime'
    let transferDate: Date | null = null
    if (libertyIMEIs.has(r.imei)) { branch = 'Liberty'; transferDate = libertyIMEIs.get(r.imei) ?? null }
    else if (marinoIMEIs.has(r.imei)) { branch = 'Marino'; transferDate = marinoIMEIs.get(r.imei) ?? null }
    const totalDays = diff(r.date, today)
    const warehouseDays = (branch !== 'Prime' && r.date && transferDate) ? diff(r.date, transferDate) : null
    const branchDays = branch !== 'Prime' ? diff(transferDate, today) : totalDays
    const bucket: AgeStatus = branchDays !== null ? ageBucket(branchDays) : 'Unknown'
    const totalBucket: AgeStatus = totalDays !== null ? ageBucket(totalDays) : 'Unknown'
    const overdue = branchDays !== null ? Math.max(0, branchDays - bucketThreshold(bucket)) : 0
    return { ...r, branch, transferDate, totalDays, branchDays, warehouseDays, bucket, totalBucket, overdue }
  })
}

export function exportToCSV(rows: UnsoldRow[]): void {
  const header = ['IMEI', 'Brand', 'Model', 'Item Code', 'Branch', 'Report Date', 'Total Days', 'Branch Days', 'Branch Status', 'Days Overdue', 'Action']
  const fmt = (d: Date | null) => d ? d.toLocaleDateString('en-GB') : ''
  const data = rows.map(r => {
    const act = actionLabel(r.bucket, r.branch)
    return [r.rawImei, r.brand, r.model, r.itemCode, r.branch, fmt(r.date), r.totalDays ?? '', r.branchDays ?? '', r.bucket, r.overdue > 0 ? r.overdue : '', act.label]
  })
  const csv = [header, ...data].map(row => row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n')
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
  a.download = `idealz_ageing_${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
}
