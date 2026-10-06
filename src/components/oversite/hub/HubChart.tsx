import {
  ArcElement,
  BarController,
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  DoughnutController,
  Filler,
  Legend,
  LinearScale,
  LineController,
  LineElement,
  PointElement,
  Tooltip,
  type ChartConfiguration,
} from 'chart.js'
import { useEffect, useRef } from 'react'

ChartJS.register(
  ArcElement, BarController, BarElement, CategoryScale, DoughnutController, Filler, Legend,
  LinearScale, LineController, LineElement, PointElement, Tooltip,
)

/** Read a CSS custom property from :root (theme-aware colours for Chart.js). */
export function cssVar(name: string, fallback = '#888'): string {
  if (typeof document === 'undefined') return fallback
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  return v || fallback
}

/** Hex/rgb colour with alpha (for fills). */
export function withAlpha(color: string, alpha: number): string {
  const c = color.trim()
  if (c.startsWith('#') && (c.length === 7 || c.length === 4)) {
    const hex = c.length === 4 ? c.slice(1).split('').map(x => x + x).join('') : c.slice(1)
    const n = parseInt(hex, 16)
    return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`
  }
  return c
}

/** A Chart.js canvas that rebuilds when `config` or `deps` change. */
export function HubChart({ config, height = 220, label }: { config: ChartConfiguration; height?: number; label: string }) {
  const ref = useRef<HTMLCanvasElement | null>(null)
  useEffect(() => {
    if (!ref.current) return
    const chart = new ChartJS(ref.current, config)
    return () => chart.destroy()
  }, [config])
  return (
    <div className="hub-chart" style={{ height }}>
      <canvas ref={ref} role="img" aria-label={label} />
    </div>
  )
}
