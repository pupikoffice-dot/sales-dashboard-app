import { useMemo, useState } from 'react'
import { useDashboardAccess } from '../../context/DashboardAccessContext'
import { useLocale } from '../../context/LocaleContext'
import { usePreview } from '../../context/PreviewContext'
import { useOpsDeliveries, useOpsDeliveryBoxes, useOpsDeliveryEntities } from '../../hooks/useOpsDeliveries'
import { monthNamesForLocale } from '../../i18n'
import {
  barPct,
  buildMonthlyDeliveryBlocks,
  deliverySeriesStats,
  filterDeliveryEntities,
  type DeliveryBox,
  type DeliveryCompanyBlock,
  type DeliveryEntity,
  type DeliveryEntityKind,
  type DeliveryMonth,
} from '../../lib/opsDeliveries'
import { companyLabel } from '../../lib/salesMetrics'
import type { LogicalCompany } from '../../types/dashboard'

const MONTHS = 12

function fmtQty(n: number): string {
  return Math.round(n).toLocaleString()
}

function YearChart({
  title,
  months,
  pick,
  max,
  total,
  variant,
  monthNames,
  currentYm,
}: {
  title: string
  /** Oldest month first. */
  months: DeliveryMonth[]
  pick: (m: DeliveryMonth) => number
  max: number
  total: number
  variant: 'cartons' | 'pallets'
  monthNames: string[]
  currentYm: string
}) {
  const { t } = useLocale()
  const values = months.map(pick)
  const stats = deliverySeriesStats(months, values)
  const n = months.length
  const trendAt = (i: number) => (stats ? stats.intercept + stats.slope * i : 0)
  const scale = Math.max(
    max,
    stats?.avg ?? 0,
    stats ? trendAt(stats.fromIdx) : 0,
    stats ? trendAt(n - 1) : 0,
  )
  const xAt = (i: number) => ((i + 0.5) / n) * 100
  const yAt = (v: number) => 100 - Math.min(100, Math.max(0, (v / (scale || 1)) * 100))
  const slopeTxt = stats ? `${stats.slope >= 0 ? '▲ +' : '▼ '}${fmtQty(stats.slope)}` : ''

  return (
    <div className="ops-chart">
      <div className="ops-chart-hdr">
        <span>{title}</span>
      </div>
      <div className="ops-chart-stats">
        <span>
          {t('ops.total')}: <strong>{fmtQty(total)}</strong>
        </span>
        {stats && (
          <>
            <span title={t('ops.avgHint')}>
              <i className="ops-legend ops-legend--avg" aria-hidden />
              {t('ops.avgPerMonth')}: <strong>{fmtQty(stats.avg)}</strong>
            </span>
            <span title={t('ops.trendHint')}>
              <i className={`ops-legend ops-legend--trend-${variant}`} aria-hidden />
              {t('ops.trend')}:{' '}
              <strong className={stats.slope >= 0 ? 'ops-up' : 'ops-down'}>
                {slopeTxt} {t('ops.perMonth')}
              </strong>
            </span>
          </>
        )}
      </div>
      <div className="ops-chart-plot" dir="ltr" role="img" aria-label={title}>
        {months.map(m => {
          const v = pick(m)
          const isCurrent = m.ym === currentYm
          const pct = barPct(v, scale)
          return (
            <div
              key={m.ym}
              className={`ops-chart-col${isCurrent ? ' is-current' : ''}`}
              title={`${monthNames[m.month]} ${m.year}: ${fmtQty(v)}${isCurrent ? ` (${t('ops.mtd')})` : ''}`}
            >
              <span className="ops-chart-val" style={{ bottom: `calc(${pct}% + 2px)` }}>
                {fmtQty(v)}
              </span>
              <div className={`ops-chart-bar ops-chart-bar--${variant}`} style={{ height: `${pct}%` }} />
            </div>
          )
        })}
        {stats && (
          <svg className="ops-chart-overlay" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
            <line
              className="ops-avg-line"
              x1={xAt(stats.fromIdx)}
              x2={xAt(n - 1)}
              y1={yAt(stats.avg)}
              y2={yAt(stats.avg)}
              vectorEffect="non-scaling-stroke"
            />
            {stats.toIdx > stats.fromIdx && (
              <line
                className={`ops-trend-line ops-trend-line--${variant}`}
                x1={xAt(stats.fromIdx)}
                x2={xAt(n - 1)}
                y1={yAt(trendAt(stats.fromIdx))}
                y2={yAt(trendAt(n - 1))}
                vectorEffect="non-scaling-stroke"
              />
            )}
          </svg>
        )}
      </div>
      <div className="ops-chart-axis" dir="ltr">
        {months.map((m, i) => (
          <span key={m.ym} className={`ops-chart-x${m.ym === currentYm ? ' is-current' : ''}`}>
            {monthNames[m.month]}
            <span className="ops-chart-yr">{i === 0 || m.month === 0 ? `'${String(m.year).slice(2)}` : '\u00a0'}</span>
          </span>
        ))}
      </div>
    </div>
  )
}

function ChartPair({ block, monthNames }: { block: DeliveryCompanyBlock; monthNames: string[] }) {
  const { t } = useLocale()
  const chronological = [...block.months].reverse()
  const currentYm = block.months[0]?.ym ?? ''
  return (
    <div className="ops-chart-grid">
      <YearChart
        title={t('ops.cartonsPerMonth')}
        months={chronological}
        pick={m => m.cartons}
        max={block.maxCartons}
        total={block.totalCartons}
        variant="cartons"
        monthNames={monthNames}
        currentYm={currentYm}
      />
      <YearChart
        title={t('ops.palletsPerMonth')}
        months={chronological}
        pick={m => m.pallets}
        max={block.maxPallets}
        total={block.totalPallets}
        variant="pallets"
        monthNames={monthNames}
        currentYm={currentYm}
      />
    </div>
  )
}

function EntityBox({
  box,
  name,
  monthNames,
  canEdit,
  onRemove,
}: {
  box: DeliveryBox
  name: string
  monthNames: string[]
  canEdit: boolean
  onRemove: () => void
}) {
  const { t } = useLocale()
  const { data: rows = [], isLoading, error } = useOpsDeliveries(MONTHS, {
    company: box.company,
    kind: box.kind,
    entityId: box.entityId,
  })
  const block = useMemo(() => buildMonthlyDeliveryBlocks(rows, [box.company], MONTHS)[0], [rows, box.company])
  return (
    <div className="ops-entity-box">
      <div className="ops-entity-hdr">
        <h4>
          <span className="ops-entity-kind">{box.kind === 'agent' ? t('ops.agent') : t('ops.client')}</span>
          {name} <span className="ops-entity-id">#{box.entityId}</span>
        </h4>
        {canEdit && (
          <button type="button" className="ops-entity-remove" onClick={onRemove} aria-label={t('ops.removeBox')} title={t('ops.removeBox')}>
            ✕
          </button>
        )}
      </div>
      {isLoading && <p className="status-msg">{t('common.loading')}</p>}
      {error && <p className="status-msg error">{t('ops.loadError')}</p>}
      {!isLoading && !error && !block && <p className="ov-empty">{t('ops.noDataEntity')}</p>}
      {block && <ChartPair block={block} monthNames={monthNames} />}
    </div>
  )
}

function AddBoxControl({
  company,
  entities,
  loading,
  existing,
  onAdd,
  busy,
}: {
  company: LogicalCompany
  entities: DeliveryEntity[]
  loading: boolean
  existing: DeliveryBox[]
  onAdd: (e: DeliveryEntity) => void
  busy: boolean
}) {
  const { t } = useLocale()
  const [open, setOpen] = useState(false)
  const [kind, setKind] = useState<DeliveryEntityKind>('client')
  const [query, setQuery] = useState('')
  const exclude = useMemo(
    () => new Set(existing.filter(b => b.kind === kind).map(b => b.entityId)),
    [existing, kind],
  )
  const matches = useMemo(
    () => filterDeliveryEntities(entities, company, kind, query, exclude),
    [entities, company, kind, query, exclude],
  )

  if (!open) {
    return (
      <button type="button" className="ops-add-btn" onClick={() => setOpen(true)}>
        ＋ {t('ops.addBox')}
      </button>
    )
  }

  return (
    <div className="ops-add-panel">
      <div className="ops-add-row">
        <div className="ops-kind-toggle" role="group" aria-label={t('ops.addBox')}>
          {(['client', 'agent'] as const).map(k => (
            <button
              key={k}
              type="button"
              className={`ops-kind-btn${kind === k ? ' active' : ''}`}
              aria-pressed={kind === k}
              onClick={() => setKind(k)}
            >
              {k === 'agent' ? t('ops.agent') : t('ops.client')}
            </button>
          ))}
        </div>
        <input
          type="search"
          className="ops-add-search"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder={kind === 'agent' ? t('ops.searchAgent') : t('ops.searchClient')}
          autoFocus
        />
        <button type="button" className="ops-add-close" onClick={() => { setOpen(false); setQuery('') }} aria-label={t('ops.closePicker')}>
          ✕
        </button>
      </div>
      {loading ? (
        <p className="status-msg">{t('common.loading')}</p>
      ) : matches.length === 0 ? (
        <p className="ov-empty">{t('ops.noMatches')}</p>
      ) : (
        <>
        <p className="ops-add-count">
          {t(kind === 'agent' ? 'ops.agentCount' : 'ops.clientCount', { count: matches.length.toLocaleString() })}
        </p>
        <ul className="ops-add-list">
          {matches.map(e => (
            <li key={e.entityId}>
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  onAdd(e)
                  setOpen(false)
                  setQuery('')
                }}
              >
                <span className="ops-add-name">
                  {e.name} <span className="ops-entity-id">#{e.entityId}</span>
                </span>
                <span className="ops-add-qty">
                  {fmtQty(e.cartons)} {t('ops.cartons')} · {fmtQty(e.pallets)} {t('ops.pallets')}
                </span>
              </button>
            </li>
          ))}
        </ul>
        </>
      )}
    </div>
  )
}

/** Operations → Deliveries: yearly cartons (ZZ1) and pallets (ZZ2) charts per company, from rep893. */
export function DeliveriesPage() {
  const { access } = useDashboardAccess()
  const { isPreviewing } = usePreview()
  const { t, locale } = useLocale()
  const { data: rows = [], isLoading, error } = useOpsDeliveries(MONTHS)
  const boxes = useOpsDeliveryBoxes()
  const entitiesQuery = useOpsDeliveryEntities(!isLoading && !error)
  const entities = entitiesQuery.data ?? []
  const monthNames = monthNamesForLocale(locale)
  const canEdit = !isPreviewing

  const blocks = useMemo(
    () => buildMonthlyDeliveryBlocks(rows, access?.companies ?? [], MONTHS),
    [rows, access?.companies],
  )
  const entityName = useMemo(() => {
    const m = new Map(entities.map(e => [`${e.company}|${e.kind}|${e.entityId}`, e.name]))
    return (b: DeliveryBox) => m.get(`${b.company}|${b.kind}|${b.entityId}`) || b.label || b.entityId
  }, [entities])

  return (
    <div className="ops-page">
      <div className="ops-page-hdr">
        <h2>🚚 {t('ops.deliveries.title')}</h2>
        <p>{t('ops.deliveries.subtitle', { months: MONTHS })}</p>
      </div>

      {isLoading && <p className="status-msg">{t('common.loading')}</p>}
      {error && <p className="status-msg error">{t('ops.loadError')}</p>}
      {!isLoading && !error && blocks.length === 0 && <p className="ov-empty">{t('ops.noData')}</p>}
      {(boxes.add.isError || boxes.remove.isError) && <p className="status-msg error">{t('ops.saveError')}</p>}

      {blocks.map(b => {
        const coBoxes = (boxes.data ?? []).filter(x => x.company === b.company)
        return (
          <section key={b.company} className="ops-co-block">
            <div className="ops-co-hdr">
              <h3>{companyLabel(b.company)}</h3>
            </div>
            <ChartPair block={b} monthNames={monthNames} />
            {coBoxes.map(box => (
              <EntityBox
                key={box.id}
                box={box}
                name={entityName(box)}
                monthNames={monthNames}
                canEdit={canEdit}
                onRemove={() => boxes.remove.mutate(box.id)}
              />
            ))}
            {canEdit && (
              <AddBoxControl
                company={b.company}
                entities={entities}
                loading={entitiesQuery.isLoading}
                existing={coBoxes}
                busy={boxes.add.isPending}
                onAdd={e =>
                  boxes.add.mutate({ company: b.company, kind: e.kind, entityId: e.entityId, label: e.name })
                }
              />
            )}
          </section>
        )
      })}
    </div>
  )
}
