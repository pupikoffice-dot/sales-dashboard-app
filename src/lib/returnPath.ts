/**
 * Where to go after login: the in-app page the user was redirected from (e.g. a link in a
 * data-health email), otherwise '/'. Only same-app paths are accepted.
 */
export function returnPathFrom(state: unknown): string {
  const from = (state as { from?: { pathname?: unknown; search?: unknown } } | null)?.from
  const path = typeof from?.pathname === 'string' ? from.pathname : ''
  if (!path.startsWith('/') || path.startsWith('//') || path === '/login') return '/'
  return path + (typeof from?.search === 'string' ? from.search : '')
}
