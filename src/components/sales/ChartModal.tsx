import {
  ArcElement,
  BarController,
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  DoughnutController,
  Legend,
  LinearScale,
  Tooltip,
} from 'chart.js'
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { csvCell, downloadCSV } from '../../lib/csvExport'
import { downloadWorkbook } from '../../lib/spreadsheetExport'
import { fmt, fmt0 } from '../../lib/format'
import { useTheme } from '../../context/ThemeContext'
import { getPieColors } from '../../lib/pieColors'
import type { PieEntry } from '../../lib/pieData'

ChartJS.register(
  ArcElement,
  BarElement,
  BarController,
  DoughnutController,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
)

const TOP = 50

export type ChartModalConfig =
  | { kind: 'pie'; entries: PieEntry[]; title: string }
  | { kind: 'stock'; entries: PieEntry[]; title: string }
  | {
      kind: 'bar'
      months: string[]
      cashVals: number[]
      qtyVals: number[]
      title: string
      showToggle?: boolean
    }

interface ChartModalProps {
  config: ChartModalConfig | null
  onClose: () => void
}

function sliceEntries(entries: PieEntry[]) {
  const data = entries.filter(e => e.value > 0).sort((a, b) => b.value - a.value)
  const sliced = data.slice(0, TOP)
  return { data, sliced }
}

export function ChartModal({ config, onClose }: ChartModalProps) {
  const { theme } = useTheme()
  const pieColors = getPieColors(theme)
  const chartGrid = theme === 'light' ? 'rgba(100, 100, 110, 0.18)' : 'rgba(46, 51, 80, 0.4)'
  const chartTick = theme === 'light' ? '#636366' : '#7b82a8'
  const chartBorder = theme === 'light' ? '#d8d8de' : '#1a1d27'
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const chartRef = useRef<ChartJS | null>(null)
  const [barMode, setBarMode] = useState<'cash' | 'qty'>('cash')

  useEffect(() => {
    if (!config) return
    setBarMode('cash')
  }, [config])

  useEffect(() => {
    if (!config) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [config])

  useEffect(() => {
    if (!config) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [config, onClose])

  useLayoutEffect(() => {
    if (!config || !canvasRef.current) return

    chartRef.current?.destroy()
    chartRef.current = null

    const ctx = canvasRef.current.getContext('2d')
    if (!ctx) return

    if (config.kind === 'bar') {
      const vals = barMode === 'cash' ? config.cashVals : config.qtyVals
      chartRef.current = new ChartJS(ctx, {
        type: 'bar',
        data: {
          labels: config.months,
          datasets: [{
            label: barMode === 'cash' ? 'Cash' : 'Qty',
            data: vals,
            backgroundColor: config.months.map((_, i) => pieColors[i % pieColors.length]),
            borderColor: chartBorder,
            borderWidth: 1,
            borderRadius: 5,
          }],
        },
        options: {
          responsive: true,
          maintainAspectRatio: true,
          plugins: {
            legend: { display: false },
            tooltip: { callbacks: { label: c => `  ${fmt(c.raw as number)}` } },
          },
          scales: {
            x: { ticks: { color: chartTick, font: { size: 11 } }, grid: { color: chartGrid } },
            y: {
              ticks: { color: chartTick, font: { size: 11 }, callback: v => fmt(v as number) },
              grid: { color: chartGrid },
            },
          },
        },
      })
      return () => chartRef.current?.destroy()
    }

    const { sliced } = sliceEntries(config.entries)
    chartRef.current = new ChartJS(ctx, {
      type: 'doughnut',
      data: {
        labels: sliced.map(e => e.label),
        datasets: [{
          data: sliced.map(e => e.value),
          backgroundColor: pieColors.slice(0, sliced.length),
          borderColor: chartBorder,
          borderWidth: 2,
          hoverOffset: 10,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        cutout: '58%',
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: c => {
                const total = sliced.reduce((s, e) => s + e.value, 0)
                const pct = total > 0 ? (((c.raw as number) / total) * 100).toFixed(1) : '0'
                return `  ${fmt(c.raw as number)}  (${pct}%)`
              },
            },
          },
        },
      },
    })

    return () => {
      chartRef.current?.destroy()
      chartRef.current = null
    }
  }, [config, barMode, theme, pieColors, chartGrid, chartTick, chartBorder])

  if (!config) return null

  function handleExportCsv() {
    const base = config!.title.replace(/\s+/g, '_')
    if (config!.kind === 'bar') {
      const totalCash = config!.cashVals.reduce((s, v) => s + v, 0)
      const totalQty = config!.qtyVals.reduce((s, v) => s + v, 0)
      const cashRows: string[][] = [['#', 'Month', 'Cash', 'Share']]
      const qtyRows: string[][] = [['#', 'Month', 'Qty', 'Share']]
      config!.months.forEach((m, i) => {
        const cashPct = totalCash > 0 ? ((config!.cashVals[i] / totalCash) * 100).toFixed(1) : '0'
        const qtyPct = totalQty > 0 ? ((config!.qtyVals[i] / totalQty) * 100).toFixed(1) : '0'
        cashRows.push([String(i + 1), m, fmt(config!.cashVals[i]), `${cashPct}%`])
        qtyRows.push([String(i + 1), m, fmt(config!.qtyVals[i]), `${qtyPct}%`])
      })
      downloadWorkbook(
        [
          { name: 'Cash', rows: cashRows },
          { name: 'Qty', rows: qtyRows },
        ],
        `${base}.xlsx`,
      )
      return
    }

    if (config!.kind === 'stock') {
      const lines: string[] = []
      const { sliced } = sliceEntries(config!.entries)
      const total = sliced.reduce((s, e) => s + e.value, 0)
      lines.push([csvCell('#'), csvCell('SKU'), csvCell('Name'), csvCell('Total Cost'), csvCell('WMS Stock'), csvCell('Open Orders'), csvCell('Share')].join(','))
      sliced.forEach((e, i) => {
        const pct = total > 0 ? ((e.value / total) * 100).toFixed(1) : '0'
        lines.push([csvCell(String(i + 1)), csvCell(e.sku || ''), csvCell(e.label), csvCell(fmt(e.value)), csvCell(fmt0(e.qty || 0)), csvCell(fmt0(e.ooQty || 0)), csvCell(`${pct}%`)].join(','))
      })
      downloadCSV(lines.join('\r\n'), `${base}.csv`)
      return
    }

    const { sliced } = sliceEntries(config!.entries)
    const totalCash = sliced.reduce((s, e) => s + e.value, 0)
    const totalQty = sliced.reduce((s, e) => s + (e.qty || 0), 0)
    const hasSku = sliced.some(e => e.sku?.trim())
    const cashRows: string[][] = [
      hasSku ? ['#', 'SKU', 'Name', 'Cash', 'Share'] : ['#', 'Name', 'Cash', 'Share'],
    ]
    const qtyRows: string[][] = [
      hasSku ? ['#', 'SKU', 'Name', 'Qty', 'Share'] : ['#', 'Name', 'Qty', 'Share'],
    ]
    sliced.forEach((e, i) => {
      const cashPct = totalCash > 0 ? ((e.value / totalCash) * 100).toFixed(1) : '0'
      const qtyPct = totalQty > 0 ? (((e.qty || 0) / totalQty) * 100).toFixed(1) : '0'
      if (hasSku) {
        cashRows.push([String(i + 1), e.sku || '', e.label, fmt(e.value), `${cashPct}%`])
        qtyRows.push([String(i + 1), e.sku || '', e.label, fmt(e.qty || 0), `${qtyPct}%`])
      } else {
        cashRows.push([String(i + 1), e.label, fmt(e.value), `${cashPct}%`])
        qtyRows.push([String(i + 1), e.label, fmt(e.qty || 0), `${qtyPct}%`])
      }
    })
    downloadWorkbook(
      [
        { name: 'Cash', rows: cashRows },
        { name: 'Qty', rows: qtyRows },
      ],
      `${base}.xlsx`,
    )
  }

  let title = config.title
  let sub = ''
  let totalLabel = ''
  let tableHead: ReactNode = null
  let tableBody: ReactNode = null
  let tableFoot: ReactNode = null

  if (config.kind === 'bar') {
    const vals = barMode === 'cash' ? config.cashVals : config.qtyVals
    const total = vals.reduce((s, v) => s + v, 0)
    const totalCash = config.cashVals.reduce((s, v) => s + v, 0)
    const totalQty = config.qtyVals.reduce((s, v) => s + v, 0)
    sub = `${config.months.length} month${config.months.length === 1 ? '' : 's'}`
    totalLabel = fmt(total)
    tableHead = (
      <tr>
        <th>#</th>
        <th>Month</th>
        <th style={{ textAlign: 'right' }}>Cash</th>
        <th style={{ textAlign: 'right' }}>Qty</th>
        <th style={{ textAlign: 'right' }}>Share</th>
      </tr>
    )
    tableBody = config.months.map((m, i) => {
      const pct = totalCash > 0 ? ((config.cashVals[i] / totalCash) * 100).toFixed(1) : '0.0'
      return (
        <tr key={m}>
          <td style={{ textAlign: 'center', color: 'var(--muted)' }}>{i + 1}</td>
          <td>
            <span className="pie-dot-sm" style={{ background: pieColors[i % pieColors.length] }} />
            {m}
          </td>
          <td style={{ textAlign: 'right' }}>{fmt(config.cashVals[i])}</td>
          <td style={{ textAlign: 'right', color: 'var(--muted)' }}>{fmt(config.qtyVals[i])}</td>
          <td style={{ textAlign: 'right', color: 'var(--acc)', fontWeight: 700 }}>{pct}%</td>
        </tr>
      )
    })
    tableFoot = (
      <tr>
        <td colSpan={2}>Total</td>
        <td style={{ textAlign: 'right' }}>{fmt(totalCash)}</td>
        <td style={{ textAlign: 'right', color: 'var(--muted)' }}>{fmt(totalQty)}</td>
        <td style={{ textAlign: 'right', color: 'var(--acc)' }}>100%</td>
      </tr>
    )
  } else if (config.kind === 'stock') {
    const { data, sliced } = sliceEntries(config.entries)
    const total = sliced.reduce((s, e) => s + e.value, 0)
    const totalQty = sliced.reduce((s, e) => s + (e.qty || 0), 0)
    const totalOO = sliced.reduce((s, e) => s + (e.ooQty || 0), 0)
    sub = data.length > TOP ? `Top ${TOP} of ${data.length}` : `${data.length} item${data.length === 1 ? '' : 's'}`
    totalLabel = fmt(total)
    tableHead = (
      <tr>
        <th>#</th>
        <th>SKU</th>
        <th>Name</th>
        <th style={{ textAlign: 'right' }}>Total Cost</th>
        <th style={{ textAlign: 'right', color: 'var(--acc2)' }}>WMS Stock</th>
        <th style={{ textAlign: 'right' }}>Open Orders</th>
        <th style={{ textAlign: 'right' }}>Share</th>
      </tr>
    )
    tableBody = sliced.map((e, i) => {
      const pct = total > 0 ? ((e.value / total) * 100).toFixed(1) : '0.0'
      return (
        <tr key={`${e.sku}-${i}`}>
          <td>{i + 1}</td>
          <td style={{ color: 'var(--muted)', fontSize: '0.72rem', whiteSpace: 'nowrap' }}>{e.sku || '—'}</td>
          <td>
            <span className="pie-dot-sm" style={{ background: pieColors[i % pieColors.length] }} />
            {e.label}
          </td>
          <td style={{ textAlign: 'right' }}>{fmt(e.value)}</td>
          <td style={{ textAlign: 'right', color: 'var(--acc2)' }}>{fmt0(e.qty || 0)}</td>
          <td style={{ textAlign: 'right', color: 'var(--muted)' }}>{fmt0(e.ooQty || 0)}</td>
          <td style={{ textAlign: 'right', color: 'var(--acc)', fontWeight: 700 }}>{pct}%</td>
        </tr>
      )
    })
    tableFoot = (
      <tr>
        <td colSpan={3}>Total</td>
        <td style={{ textAlign: 'right' }}>{fmt(total)}</td>
        <td style={{ textAlign: 'right', color: 'var(--acc2)' }}>{fmt0(totalQty)}</td>
        <td style={{ textAlign: 'right', color: 'var(--muted)' }}>{fmt0(totalOO)}</td>
        <td style={{ textAlign: 'right', color: 'var(--acc)' }}>100%</td>
      </tr>
    )
  } else {
    const { data, sliced } = sliceEntries(config.entries)
    const total = sliced.reduce((s, e) => s + e.value, 0)
    const totalQty = sliced.reduce((s, e) => s + (e.qty || 0), 0)
    const hasSku = sliced.some(e => e.sku?.trim())
    sub = data.length > TOP ? `Top ${TOP} of ${data.length}` : `${data.length} entr${data.length === 1 ? 'y' : 'ies'}`
    totalLabel = fmt(total)
    tableHead = hasSku ? (
      <tr>
        <th>#</th>
        <th>SKU</th>
        <th>Name</th>
        <th style={{ textAlign: 'right' }}>Cash</th>
        <th style={{ textAlign: 'right' }}>Qty</th>
        <th style={{ textAlign: 'right' }}>Share</th>
      </tr>
    ) : (
      <tr>
        <th>#</th>
        <th>Name</th>
        <th style={{ textAlign: 'right' }}>Cash</th>
        <th style={{ textAlign: 'right' }}>Qty</th>
        <th style={{ textAlign: 'right' }}>Share</th>
      </tr>
    )
    tableBody = sliced.map((e, i) => {
      const pct = total > 0 ? ((e.value / total) * 100).toFixed(1) : '0.0'
      return (
        <tr key={`${e.label}-${i}`}>
          <td>{i + 1}</td>
          {hasSku && (
            <td style={{ textAlign: 'left', color: 'var(--muted)', fontSize: '0.72rem', whiteSpace: 'nowrap' }}>
              {e.sku || '—'}
            </td>
          )}
          <td>
            <span className="pie-dot-sm" style={{ background: pieColors[i % pieColors.length] }} />
            {e.label}
          </td>
          <td style={{ textAlign: 'right' }}>{fmt(e.value)}</td>
          <td style={{ textAlign: 'right', color: 'var(--muted)' }}>{fmt(e.qty || 0)}</td>
          <td style={{ textAlign: 'right', color: 'var(--acc)', fontWeight: 700 }}>{pct}%</td>
        </tr>
      )
    })
    tableFoot = hasSku ? (
      <tr>
        <td colSpan={3}>Total</td>
        <td style={{ textAlign: 'right' }}>{fmt(total)}</td>
        <td style={{ textAlign: 'right', color: 'var(--muted)' }}>{fmt(totalQty)}</td>
        <td style={{ textAlign: 'right', color: 'var(--acc)' }}>100%</td>
      </tr>
    ) : (
      <tr>
        <td colSpan={2}>Total</td>
        <td style={{ textAlign: 'right' }}>{fmt(total)}</td>
        <td style={{ textAlign: 'right', color: 'var(--muted)' }}>{fmt(totalQty)}</td>
        <td style={{ textAlign: 'right', color: 'var(--acc)' }}>100%</td>
      </tr>
    )
  }

  return createPortal(
    <div
      className="pie-overlay"
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div className="pie-modal">
        <div className="pie-modal-hdr">
          <span>📊 {title}</span>
          <span className="pie-modal-sub">{sub}</span>
          {config.kind === 'bar' && config.showToggle && (
            <div className="bar-tog-row">
              <button
                type="button"
                className={`bar-tog${barMode === 'cash' ? ' active' : ''}`}
                onClick={() => setBarMode('cash')}
              >
                💰 Cash
              </button>
              <button
                type="button"
                className={`bar-tog${barMode === 'qty' ? ' active' : ''}`}
                onClick={() => setBarMode('qty')}
              >
                📦 Qty
              </button>
            </div>
          )}
          <button type="button" className="dl-btn" style={{ marginLeft: 'auto', marginRight: 6 }} onClick={handleExportCsv}>
            📥 Export CSV
          </button>
          <button type="button" className="pie-close" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="pie-modal-body">
          <div className="pie-chart-side">
            <div className="pie-canvas-wrap">
              <canvas ref={canvasRef} />
            </div>
            <div className="pie-total-lbl">
              Total: <b>{totalLabel}</b>
            </div>
          </div>
          <div className="pie-table-side">
            <table className="pie-tbl">
              <thead>{tableHead}</thead>
              <tbody>{tableBody}</tbody>
              <tfoot>{tableFoot}</tfoot>
            </table>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}
