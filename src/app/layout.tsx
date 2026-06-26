import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'iDealz — Stock Ageing Dashboard',
  description: 'IMEI stock ageing tracker for Prime, Liberty and Marino branches',
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
