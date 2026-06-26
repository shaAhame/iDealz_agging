# iDealz Stock Ageing Dashboard

IMEI-level stock ageing tracker for Prime, Liberty, and Marino branches.

## Age buckets
| Status | Days in stock |
|---|---|
| 🟢 Fresh | 0 – 10 days |
| 🟡 Moderate | 11 – 20 days |
| 🟠 Slow | 21 – 30 days |
| 🔴 Dead stock | 31+ days |

## How it works
1. All stock arrives at **Prime** — upload the GRN file (Excel or PDF)
2. Upload the **Transfer → Liberty** GRN file (Excel or PDF)
3. Upload the **Transfer → Marino** GRN file (Excel or PDF)
4. Upload the **Daily Sales Report** (Excel, all branches)

The app automatically:
- Assigns each IMEI to its current branch (Prime by default, Liberty/Marino if transferred)
- Calculates days in stock from the GRN date to today
- Shows alerts for slow/dead stock per branch
- Lets you filter by branch and age bucket
- Exports full report to CSV

## Column requirements

### Stock arrival / Transfer files (Excel)
| Column | Accepted headers |
|---|---|
| IMEI | `IMEI`, `imei` |
| Date | `DATE`, `GRN DATE`, `ARRIVAL` |
| Brand | `BRAND`, `Clean Brand` |
| Model | `MODEL`, `PRODUCT`, `DESCRIPTION` |
| Location | `LOCATION`, `BRANCH` |

### Sales report (Excel)
| Column | Accepted headers |
|---|---|
| IMEI | `IMEI`, `imei` or column F |

PDF files: IMEIs (15-digit numbers) and the first date found are extracted automatically.

## Deploy to Vercel

### Option 1 — GitHub + Vercel (recommended)
1. Push this folder to a GitHub repository
2. Go to [vercel.com](https://vercel.com) → New Project → Import your repo
3. Framework: **Next.js** (auto-detected)
4. Click **Deploy** — done!

### Option 2 — Vercel CLI
```bash
npm install -g vercel
cd idealz-ageing
npm install
vercel
```

### Option 3 — Run locally
```bash
npm install
npm run dev
# Open http://localhost:3000
```

## Tech stack
- Next.js 14 (App Router)
- TypeScript
- Tailwind CSS
- SheetJS (xlsx) for Excel/PDF parsing
- Chart.js + react-chartjs-2
- Lucide React icons
