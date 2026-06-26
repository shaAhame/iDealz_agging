'use client'
import { useRef, useState } from 'react'
import { Upload, CheckCircle } from 'lucide-react'

interface Props {
  label: string
  step: number
  accept?: string
  onFile: (file: File) => void
  loaded?: string
  color?: string
}

export default function FileUploadZone({ label, step, accept = '.xlsx,.xls,.pdf', onFile, loaded, color = '#3b82f6' }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDragging(false)
    const f = e.dataTransfer.files[0]
    if (f) onFile(f)
  }

  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 18, height: 18, borderRadius: '50%', background: '#dbeafe', color: '#1e40af', fontSize: 10, fontWeight: 600 }}>{step}</span>
        {label}
      </div>
      <div
        className={`drop-zone${loaded ? ' loaded' : dragging ? ' dragover' : ''}`}
        onClick={() => inputRef.current?.click()}
        onDragOver={e => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        style={{ minHeight: 80, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4 }}
      >
        <input ref={inputRef} type="file" accept={accept} style={{ display: 'none' }} onChange={e => e.target.files?.[0] && onFile(e.target.files[0])} />
        {loaded ? (
          <>
            <CheckCircle size={20} color="#22c55e" />
            <div style={{ fontSize: 12, fontWeight: 500, color: '#16a34a' }}>{loaded}</div>
          </>
        ) : (
          <>
            <Upload size={18} color="#9ca3af" />
            <div style={{ fontSize: 12, color: '#9ca3af' }}>Excel or PDF</div>
          </>
        )}
      </div>
    </div>
  )
}
