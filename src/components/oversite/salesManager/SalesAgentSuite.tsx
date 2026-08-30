import { SalesManagerSuite } from './SalesManagerSuite'

/** Single-agent Oversight suite — same KPI cubes as Sales Manager, one agent only. */
export function SalesAgentSuite() {
  return <SalesManagerSuite variant="agent" />
}
