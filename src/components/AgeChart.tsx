'use client'
import { Bar } from 'react-chartjs-2'
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Tooltip } from 'chart.js'

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip)

export default function AgeChart({ counts }: { counts: Record<string, number> }) {
  return (
    <div style={{ position: 'relative', height: 180 }}>
      <Bar
        data={{
          labels: ['Fresh\n0–10d', 'Moderate\n11–20d', 'Slow\n21–30d', 'Dead\n31d+'],
          datasets: [{
            label: 'Unsold units',
            data: [counts.Fresh, counts.Moderate, counts.Slow, counts['Dead stock']],
            backgroundColor: ['#86efac', '#fde68a', '#fdba74', '#fca5a5'],
            borderColor: ['#16a34a', '#ca8a04', '#ea580c', '#dc2626'],
            borderWidth: 1,
            borderRadius: 6,
          }]
        }}
        options={{
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            x: { ticks: { font: { size: 10 } }, grid: { display: false } },
            y: { beginAtZero: true, ticks: { stepSize: 1, font: { size: 10 } } }
          }
        }}
      />
    </div>
  )
}
