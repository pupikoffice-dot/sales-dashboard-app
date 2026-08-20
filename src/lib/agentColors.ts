/** Shared palette for stacked agent segments (Orders 7d, Receipts). */

export const AGENT_COLOR_COUNT = 8

/**
 * Stable color slot for an agent ERP id so the same agent keeps one color
 * across charts (Orders vs Receipts) and windows.
 */
export function agentColorIndex(agentId: string): number {
  const n = Number(String(agentId).trim())
  if (Number.isFinite(n) && n >= 0) return Math.floor(Math.abs(n)) % AGENT_COLOR_COUNT
  const s = String(agentId)
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
  return h % AGENT_COLOR_COUNT
}

export function agentColorClass(agentId: string): string {
  return `agent-c${agentColorIndex(agentId)}`
}

export function agentTextClass(agentId: string): string {
  return `agent-t${agentColorIndex(agentId)}`
}
