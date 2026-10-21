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

/** Close any open tooltip and highlight on a chart. */
export function clearChartTooltip(chart: ChartJS): void {
  try {
    chart.tooltip?.setActiveElements([], { x: 0, y: 0 })
    chart.setActiveElements([])
    chart.update('none')
  } catch {
    /* chart already destroyed */
  }
}

/** How long a tooltip stays after a finger lifts off the chart (touch screens have no mouse-out). */
export const TOUCH_TOOLTIP_MS = 2500

/**
 * A Chart.js canvas that rebuilds when `config` changes.
 *
 * `minWidth` (px): a chart with many points keeps at least that width inside a box that scrolls sideways, instead
 * of being squeezed to the screen. A tooltip never sticks: it closes when the user touches or clicks anywhere
 * else, scrolls, or (on touch) a moment after the finger lifts.
 */
export function HubChart({
  config,
  height = 220,
  label,
  minWidth,
}: {
  config: ChartConfiguration
  height?: number
  label: string
  minWidth?: number
}) {
  const ref = useRef<HTMLCanvasElement | null>(null)
  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const chart = new ChartJS(canvas, config)
    let timer: ReturnType<typeof setTimeout> | undefined
    const clear = () => clearChartTooltip(chart)
    const onOutside = (e: Event) => {
      if (!canvas.contains(e.target as Node)) clear()
    }
    const onTouchEnd = () => {
      clearTimeout(timer)
      timer = setTimeout(clear, TOUCH_TOOLTIP_MS)
    }
    document.addEventListener('pointerdown', onOutside, true)
    window.addEventListener('scroll', clear, true)
    canvas.addEventListener('touchend', onTouchEnd, { passive: true })
    return () => {
      clearTimeout(timer)
      document.removeEventListener('pointerdown', onOutside, true)
      window.removeEventListener('scroll', clear, true)
      canvas.removeEventListener('touchend', onTouchEnd)
      chart.destroy()
    }
  }, [config])
  return (
    <div className="hub-chart-scroll">
      <div className="hub-chart" style={{ height, minWidth: minWidth ? `${minWidth}px` : undefined }}>
        <canvas ref={ref} role="img" aria-label={label} />
      </div>
      {minWidth ? <p className="hub-chart-hint">Swipe sideways to see the whole chart</p> : null}
    </div>
  )
}
