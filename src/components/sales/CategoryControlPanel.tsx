import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { SortTh, useSortedRows } from '../rnd/sortRows'
import { TableWithExport } from './TableWithExport'
import { fmt0 } from '../../lib/format'
import { companyLabel as rawCompanyLabel } from '../../lib/salesMetrics'
import type { LogicalCompany } from '../../types/dashboard'
import { useLocale } from '../../context/LocaleContext'
import { useDashboardAccess } from '../../context/DashboardAccessContext'
import { usePreview } from '../../context/PreviewContext'
import {
  approveHeldBatch,
  controlCounts,
  decideCategory,
  fetchCategoryControl,
  filterControlRows,
  formatCcDate,
  groupSelection,
  maskCategoryControlForPreview,
  selKey,
  toggleAllVisible,
  toggleKey,
  undoCategory,
  type CcAction,
  type CcDecision,
  type CcHistory,
  type CcMark,
  type CcRestore,
  type CcToDecide,
} from '../../lib/categoryControl'

const companyLabel = (c: string) => rawCompanyLabel(c as LogicalCompany)

export const CATEGORY_CONTROL_QUERY_KEY = ['category-control']

type Section = 'decide' | 'restore' | 'pending' | 'marks'

interface Props {
  /** 'all' or a company key. */
  company: string
  searchQuery: string
}

/** Query shared with the Items index button, so the tab label can show the number waiting for a decision. */
export function useCategoryControl() {
  const { access } = useDashboardAccess()
  const { isPreviewing, effectiveIsSuperAdmin } = usePreview()
  const q = useQuery({ queryKey: CATEGORY_CONTROL_QUERY_KEY, queryFn: fetchCategoryControl, staleTime: 5 * 60 * 1000 })
  const data = useMemo(
    () => (q.data && isPreviewing && !effectiveIsSuperAdmin && access ? maskCategoryControlForPreview(q.data, access.companies) : q.data),
    [q.data, isPreviewing, effectiveIsSuperAdmin, access],
  )
  return { ...q, data }
}

const wrapStyle = { overflowX: 'auto' as const }
const chipBtn = { marginInlineEnd: 6, marginBottom: 6 }

export function CategoryControlPanel({ company, searchQuery }: Props) {
  const { t } = useLocale()
  const qc = useQueryClient()
  const { isPreviewing, effectiveIsSuperAdmin } = usePreview()
  const q = useCategoryControl()
  const [section, setSection] = useState<Section>('decide')
  const [sel, setSel] = useState<Set<string>>(new Set())
  const [msg, setMsg] = useState<string | null>(null)
  const data = q.data
  // A previewed user never gets write buttons here (the data was fetched with the admin's own session).
  const canWrite = !!data?.canWrite && !(isPreviewing && !effectiveIsSuperAdmin)

  const refresh = () => qc.invalidateQueries({ queryKey: CATEGORY_CONTROL_QUERY_KEY })
  const run = useMutation({
    mutationFn: async (job: () => Promise<string>) => job(),
    onSuccess: m => {
      setMsg(m)
      refresh()
    },
    onError: e => setMsg(t('cc.error', { msg: (e as Error).message })),
  })

  const toDecide = useMemo(
    () => filterControlRows(data?.toDecide ?? [], company, searchQuery, r => [r.cat, r.lastCategory]),
    [data, company, searchQuery],
  )
  const restore = useMemo(() => filterControlRows(data?.restore ?? [], company, searchQuery, r => [r.to]), [data, company, searchQuery])
  const pending = useMemo(() => filterControlRows(data?.pending ?? [], company, searchQuery, r => [r.from, r.to]), [data, company, searchQuery])
  const history = useMemo(() => filterControlRows(data?.history ?? [], company, searchQuery, r => [r.from, r.to]), [data, company, searchQuery])
  const presale = useMemo(() => filterControlRows(data?.presale ?? [], company, searchQuery), [data, company, searchQuery])
  const exempt = useMemo(() => filterControlRows(data?.exempt ?? [], company, searchQuery), [data, company, searchQuery])
  const held = (data?.held ?? []).filter(h => company === 'all' || h.co === company)
  const counts = data ? controlCounts(data, company) : { toDecide: 0, restore: 0, pending: 0, held: 0 }

  const decideSelected = (decision: CcDecision) => {
    const groups = groupSelection(sel, toDecide)
    const total = [...groups.values()].reduce((a, l) => a + l.length, 0)
    if (!total) return
    const key = decision === 'remove' ? 'cc.confirm.remove' : decision === 'leave' ? 'cc.confirm.leave' : 'cc.confirm.exempt'
    if (!window.confirm(t(key, { n: String(total) }))) return
    run.mutate(async () => {
      let done = 0
      let skipped = 0
      for (const [co, skus] of groups) {
        const r = await decideCategory(co, skus, decision)
        done += r.done
        skipped += r.skipped
      }
      setSel(new Set())
      return t('cc.decided', { done: String(done), skipped: String(skipped) })
    })
  }

  const decideOne = (r: CcToDecide, decision: CcDecision) => {
    run.mutate(async () => {
      const x = await decideCategory(r.co, [r.sku], decision)
      setSel(s => {
        const n = new Set(s)
        n.delete(selKey(r.co, r.sku))
        return n
      })
      return t('cc.decided', { done: String(x.done), skipped: String(x.skipped) })
    })
  }

  if (q.isLoading) {
    return (
      <div className="welcome">
        <div className="spin-wrap">
          <div className="spin" />
        </div>
      </div>
    )
  }
  if (q.error) return <div className="err">{t('cc.loadError', { msg: (q.error as Error).message })}</div>
  if (!data) return null

  const tabs: [Section, string, number][] = [
    ['decide', t('cc.tab.decide'), counts.toDecide],
    ['restore', t('cc.tab.restore'), counts.restore],
    ['pending', t('cc.tab.pending'), counts.pending],
    ['marks', t('cc.tab.marks'), presale.length + exempt.length],
  ]

  return (
    <div>
      <p style={{ margin: '10px 0', opacity: 0.8, maxWidth: 900 }}>{t('cc.intro')}</p>

      {held.map(h => (
        <div key={h.id} className="err" role="alert" style={{ margin: '8px 0' }}>
          <b>{companyLabel(h.co)}</b>: {t('cc.held', { flags: String(h.newFlags), restores: String(h.newRestores), limit: String(h.threshold) })}{' '}
          {h.status === 'approved' ? (
            <b>{t('cc.heldApproved')}</b>
          ) : data.canApprove && !isPreviewing ? (
            <button
              type="button"
              className="dl-btn"
              disabled={run.isPending}
              onClick={() => {
                if (window.confirm(t('cc.confirm.approve', { co: companyLabel(h.co) })))
                  run.mutate(async () => {
                    await approveHeldBatch(h.id)
                    return t('cc.approved')
                  })
              }}
            >
              {t('cc.approve')}
            </button>
          ) : (
            <span>{t('cc.heldWait')}</span>
          )}
        </div>
      ))}

      <div role="tablist" style={{ display: 'flex', flexWrap: 'wrap', gap: 6, margin: '10px 0' }}>
        {tabs.map(([k, label, n]) => (
          <button
            key={k}
            type="button"
            role="tab"
            aria-selected={section === k}
            className="sbar-search"
            style={section === k ? { fontWeight: 700, outline: '2px solid currentColor' } : undefined}
            onClick={() => setSection(k)}
          >
            {label} ({fmt0(n)})
          </button>
        ))}
      </div>
      {msg && (
        <div role="status" style={{ margin: '6px 0', fontWeight: 600 }}>
          {msg}
        </div>
      )}
      {!canWrite && <div style={{ margin: '6px 0', opacity: 0.7 }}>{t('cc.readOnly')}</div>}

      {section === 'decide' && (
        <DecideSection
          rows={toDecide}
          sel={sel}
          canWrite={canWrite}
          busy={run.isPending}
          onToggle={k => setSel(s => toggleKey(s, k))}
          onToggleAll={() => setSel(s => toggleAllVisible(s, toDecide.map(r => selKey(r.co, r.sku))))}
          onBulk={decideSelected}
          onOne={decideOne}
        />
      )}
      {section === 'restore' && <RestoreSection rows={restore} />}
      {section === 'pending' && (
        <PendingSection
          pending={pending}
          history={history}
          canWrite={canWrite}
          busy={run.isPending}
          onUndo={(co, sku, id) =>
            run.mutate(async () => {
              const n = await undoCategory(co, sku, 'action', id)
              return n ? t('cc.undone') : t('cc.undoNone')
            })
          }
        />
      )}
      {section === 'marks' && (
        <MarksSection
          presale={presale}
          exempt={exempt}
          canWrite={canWrite}
          busy={run.isPending}
          onUndo={(m, kind) =>
            run.mutate(async () => {
              const n = await undoCategory(m.co, m.sku, kind)
              return n ? t('cc.undone') : t('cc.undoNone')
            })
          }
        />
      )}
    </div>
  )
}

function Empty({ text }: { text: string }) {
  return <div className="err">{text}</div>
}

function DecideSection(p: {
  rows: CcToDecide[]
  sel: Set<string>
  canWrite: boolean
  busy: boolean
  onToggle: (k: string) => void
  onToggleAll: () => void
  onBulk: (d: CcDecision) => void
  onOne: (r: CcToDecide, d: CcDecision) => void
}) {
  const { t } = useLocale()
  const { sorted, sort, onSort } = useSortedRows<CcToDecide>(
    p.rows,
    {
      co: r => companyLabel(r.co),
      sku: r => r.sku,
      name: r => r.name,
      cat: r => r.cat,
      lastStock: r => r.lastStockAt,
      flagged: r => r.flaggedAt,
      wms: r => r.wms,
    },
    null,
    ['co', 'sku', 'name', 'cat'],
  )
  if (!p.rows.length) return <Empty text={t('cc.decide.empty')} />
  const visibleKeys = sorted.map(r => selKey(r.co, r.sku))
  const nSel = visibleKeys.filter(k => p.sel.has(k)).length
  return (
    <div>
      <p style={{ margin: '6px 0' }}>{t('cc.decide.hint')}</p>
      {p.canWrite && (
        <div style={{ margin: '8px 0' }}>
          <span style={{ marginInlineEnd: 10 }}>{t('cc.selected', { n: String(nSel) })}</span>
          <button type="button" className="dl-btn" style={chipBtn} disabled={!nSel || p.busy} onClick={() => p.onBulk('remove')}>
            {t('cc.btn.remove')}
          </button>
          <button type="button" className="dl-btn" style={chipBtn} disabled={!nSel || p.busy} onClick={() => p.onBulk('leave')}>
            {t('cc.btn.leave')}
          </button>
          <button type="button" className="dl-btn" style={chipBtn} disabled={!nSel || p.busy} onClick={() => p.onBulk('exempt')}>
            {t('cc.btn.exempt')}
          </button>
        </div>
      )}
      <div className="tw tw-sticky" style={wrapStyle}>
        <table>
          <thead>
            <tr>
              {p.canWrite && (
                <th>
                  <input
                    type="checkbox"
                    aria-label={t('cc.selectAll')}
                    checked={nSel > 0 && nSel === visibleKeys.length}
                    onChange={p.onToggleAll}
                  />
                </th>
              )}
              <SortTh label={t('cc.col.company')} k="co" left sort={sort} onSort={onSort} />
              <SortTh label="SKU" k="sku" left sort={sort} onSort={onSort} />
              <SortTh label={t('cc.col.name')} k="name" left sort={sort} onSort={onSort} />
              <SortTh label={t('cc.col.category')} k="cat" left sort={sort} onSort={onSort} />
              <SortTh label={t('cc.col.lastStock')} k="lastStock" sort={sort} onSort={onSort} />
              <SortTh label={t('cc.col.flagged')} k="flagged" sort={sort} onSort={onSort} />
              <SortTh label={t('cc.col.wms')} k="wms" sort={sort} onSort={onSort} />
              {p.canWrite && <th>{t('cc.col.actions')}</th>}
            </tr>
          </thead>
          <tbody>
            {sorted.map(r => {
              const k = selKey(r.co, r.sku)
              return (
                <tr key={k}>
                  {p.canWrite && (
                    <td>
                      <input type="checkbox" aria-label={r.sku} checked={p.sel.has(k)} onChange={() => p.onToggle(k)} />
                    </td>
                  )}
                  <td>{companyLabel(r.co)}</td>
                  <td>{r.sku}</td>
                  <td title={r.name}>{r.name}</td>
                  <td>{r.cat ?? ''}</td>
                  <td>{formatCcDate(r.lastStockAt) || '—'}</td>
                  <td>{formatCcDate(r.flaggedAt) || '—'}</td>
                  <td>{fmt0(r.wms)}</td>
                  {p.canWrite && (
                    <td style={{ whiteSpace: 'nowrap' }}>
                      <button type="button" className="dl-btn" disabled={p.busy} onClick={() => p.onOne(r, 'remove')}>
                        {t('cc.btn.remove')}
                      </button>{' '}
                      <button type="button" className="dl-btn" disabled={p.busy} onClick={() => p.onOne(r, 'leave')}>
                        {t('cc.btn.leave')}
                      </button>{' '}
                      <button type="button" className="dl-btn" disabled={p.busy} onClick={() => p.onOne(r, 'exempt')}>
                        {t('cc.btn.exempt')}
                      </button>
                    </td>
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function RestoreSection({ rows }: { rows: CcRestore[] }) {
  const { t } = useLocale()
  const { sorted, sort, onSort } = useSortedRows<CcRestore>(
    rows,
    { co: r => companyLabel(r.co), sku: r => r.sku, name: r => r.name, to: r => r.to, wms: r => r.wms, created: r => r.createdAt },
    null,
    ['co', 'sku', 'name', 'to'],
  )
  if (!rows.length) return <Empty text={t('cc.restore.empty')} />
  return (
    <div>
      <p style={{ margin: '6px 0' }}>{t('cc.restore.hint')}</p>
      <TableWithExport exportName="Category restore list">
        <div className="tw tw-sticky" style={wrapStyle}>
          <table>
            <thead>
              <tr>
                <SortTh label={t('cc.col.company')} k="co" left sort={sort} onSort={onSort} />
                <SortTh label="SKU" k="sku" left sort={sort} onSort={onSort} />
                <SortTh label={t('cc.col.name')} k="name" left sort={sort} onSort={onSort} />
                <SortTh label={t('cc.col.restoreTo')} k="to" left sort={sort} onSort={onSort} />
                <SortTh label={t('cc.col.wms')} k="wms" sort={sort} onSort={onSort} />
                <SortTh label={t('cc.col.queued')} k="created" sort={sort} onSort={onSort} />
              </tr>
            </thead>
            <tbody>
              {sorted.map(r => (
                <tr key={r.id}>
                  <td>{companyLabel(r.co)}</td>
                  <td>{r.sku}</td>
                  <td title={r.name}>{r.name}</td>
                  <td>{r.to}</td>
                  <td data-sv={r.wms ?? ''}>{r.wms != null ? fmt0(r.wms) : '—'}</td>
                  <td data-sv={r.createdAt ?? ''}>{formatCcDate(r.createdAt) || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </TableWithExport>
    </div>
  )
}

function PendingSection(p: {
  pending: CcAction[]
  history: CcHistory[]
  canWrite: boolean
  busy: boolean
  onUndo: (co: string, sku: string, id: number) => void
}) {
  const { t } = useLocale()
  const pend = useSortedRows<CcAction>(
    p.pending,
    { co: r => companyLabel(r.co), sku: r => r.sku, name: r => r.name, action: r => r.action, from: r => r.from, to: r => r.to, created: r => r.createdAt, by: r => r.decidedBy },
    null,
    ['co', 'sku', 'name', 'action', 'from', 'to', 'by'],
  )
  const hist = useSortedRows<CcHistory>(
    p.history,
    { co: r => companyLabel(r.co), sku: r => r.sku, name: r => r.name, action: r => r.action, status: r => r.status, at: r => r.at, error: r => r.error },
    null,
    ['co', 'sku', 'name', 'action', 'status', 'error'],
  )
  const actionLabel = (a: string) => (a === 'CLEAR' ? t('cc.action.clear') : t('cc.action.restore'))
  return (
    <div>
      <h3 style={{ margin: '12px 0 6px' }}>{t('cc.pending.title', { n: fmt0(p.pending.length) })}</h3>
      {!p.pending.length ? (
        <Empty text={t('cc.pending.empty')} />
      ) : (
        <div className="tw tw-sticky" style={wrapStyle}>
          <table>
            <thead>
              <tr>
                <SortTh label={t('cc.col.company')} k="co" left sort={pend.sort} onSort={pend.onSort} />
                <SortTh label="SKU" k="sku" left sort={pend.sort} onSort={pend.onSort} />
                <SortTh label={t('cc.col.name')} k="name" left sort={pend.sort} onSort={pend.onSort} />
                <SortTh label={t('cc.col.action')} k="action" left sort={pend.sort} onSort={pend.onSort} />
                <SortTh label={t('cc.col.from')} k="from" left sort={pend.sort} onSort={pend.onSort} />
                <SortTh label={t('cc.col.to')} k="to" left sort={pend.sort} onSort={pend.onSort} />
                <SortTh label={t('cc.col.queued')} k="created" sort={pend.sort} onSort={pend.onSort} />
                <SortTh label={t('cc.col.by')} k="by" left sort={pend.sort} onSort={pend.onSort} />
                {p.canWrite && <th>{t('cc.col.actions')}</th>}
              </tr>
            </thead>
            <tbody>
              {pend.sorted.map(r => (
                <tr key={r.id}>
                  <td>{companyLabel(r.co)}</td>
                  <td>{r.sku}</td>
                  <td title={r.name}>{r.name}</td>
                  <td>{actionLabel(r.action)}</td>
                  <td>{r.from ?? ''}</td>
                  <td>{r.to || t('cc.empty')}</td>
                  <td data-sv={r.createdAt ?? ''}>{formatCcDate(r.createdAt) || '—'}</td>
                  <td>{r.decidedBy ?? t('cc.auto')}</td>
                  {p.canWrite && (
                    <td>
                      <button type="button" className="dl-btn" disabled={p.busy} onClick={() => p.onUndo(r.co, r.sku, r.id)}>
                        {t('cc.btn.cancel')}
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <h3 style={{ margin: '18px 0 6px' }}>{t('cc.history.title', { n: fmt0(p.history.length) })}</h3>
      {!p.history.length ? (
        <Empty text={t('cc.history.empty')} />
      ) : (
        <div className="tw tw-sticky" style={wrapStyle}>
          <table>
            <thead>
              <tr>
                <SortTh label={t('cc.col.company')} k="co" left sort={hist.sort} onSort={hist.onSort} />
                <SortTh label="SKU" k="sku" left sort={hist.sort} onSort={hist.onSort} />
                <SortTh label={t('cc.col.name')} k="name" left sort={hist.sort} onSort={hist.onSort} />
                <SortTh label={t('cc.col.action')} k="action" left sort={hist.sort} onSort={hist.onSort} />
                <SortTh label={t('cc.col.status')} k="status" left sort={hist.sort} onSort={hist.onSort} />
                <SortTh label={t('cc.col.date')} k="at" sort={hist.sort} onSort={hist.onSort} />
                <SortTh label={t('cc.col.reason')} k="error" left sort={hist.sort} onSort={hist.onSort} />
              </tr>
            </thead>
            <tbody>
              {hist.sorted.map(r => (
                <tr key={r.id}>
                  <td>{companyLabel(r.co)}</td>
                  <td>{r.sku}</td>
                  <td title={r.name}>{r.name}</td>
                  <td>{actionLabel(r.action)}</td>
                  <td>{t(r.status === 'done' ? 'cc.status.done' : r.status === 'failed' ? 'cc.status.failed' : 'cc.status.cancelled')}</td>
                  <td data-sv={r.at ?? ''}>{formatCcDate(r.at) || '—'}</td>
                  <td>{r.error ?? ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function MarkTable(p: {
  rows: CcMark[]
  kind: 'presale' | 'exempt'
  canWrite: boolean
  busy: boolean
  onUndo: (m: CcMark, kind: 'presale' | 'exempt') => void
}) {
  const { t } = useLocale()
  const { sorted, sort, onSort } = useSortedRows<CcMark>(
    p.rows,
    { co: r => companyLabel(r.co), sku: r => r.sku, name: r => r.name, created: r => r.createdAt, by: r => r.by, note: r => r.note },
    null,
    ['co', 'sku', 'name', 'by', 'note'],
  )
  if (!p.rows.length) return <Empty text={t(p.kind === 'presale' ? 'cc.presale.empty' : 'cc.exempt.empty')} />
  return (
    <div className="tw tw-sticky" style={wrapStyle}>
      <table>
        <thead>
          <tr>
            <SortTh label={t('cc.col.company')} k="co" left sort={sort} onSort={onSort} />
            <SortTh label="SKU" k="sku" left sort={sort} onSort={onSort} />
            <SortTh label={t('cc.col.name')} k="name" left sort={sort} onSort={onSort} />
            <SortTh label={t('cc.col.since')} k="created" sort={sort} onSort={onSort} />
            <SortTh label={t('cc.col.by')} k="by" left sort={sort} onSort={onSort} />
            <SortTh label={t('cc.col.note')} k="note" left sort={sort} onSort={onSort} />
            {p.canWrite && <th>{t('cc.col.actions')}</th>}
          </tr>
        </thead>
        <tbody>
          {sorted.map(r => (
            <tr key={r.id}>
              <td>{companyLabel(r.co)}</td>
              <td>{r.sku}</td>
              <td title={r.name}>{r.name}</td>
              <td data-sv={r.createdAt ?? ''}>{formatCcDate(r.createdAt) || '—'}</td>
              <td>{r.by ?? ''}</td>
              <td>{r.note ?? ''}</td>
              {p.canWrite && (
                <td>
                  <button type="button" className="dl-btn" disabled={p.busy} onClick={() => p.onUndo(r, p.kind)}>
                    {t('cc.btn.undo')}
                  </button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function MarksSection(p: {
  presale: CcMark[]
  exempt: CcMark[]
  canWrite: boolean
  busy: boolean
  onUndo: (m: CcMark, kind: 'presale' | 'exempt') => void
}) {
  const { t } = useLocale()
  return (
    <div>
      <h3 style={{ margin: '12px 0 6px' }}>{t('cc.presale.title', { n: fmt0(p.presale.length) })}</h3>
      <p style={{ margin: '4px 0' }}>{t('cc.presale.hint')}</p>
      <MarkTable rows={p.presale} kind="presale" canWrite={p.canWrite} busy={p.busy} onUndo={p.onUndo} />
      <h3 style={{ margin: '18px 0 6px' }}>{t('cc.exempt.title', { n: fmt0(p.exempt.length) })}</h3>
      <p style={{ margin: '4px 0' }}>{t('cc.exempt.hint')}</p>
      <MarkTable rows={p.exempt} kind="exempt" canWrite={p.canWrite} busy={p.busy} onUndo={p.onUndo} />
    </div>
  )
}
