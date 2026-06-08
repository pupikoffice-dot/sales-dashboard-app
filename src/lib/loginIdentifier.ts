/** Internal auth email domain for username-only accounts (not a real mailbox). */
export const USERNAME_AUTH_DOMAIN = 'dashboard.local'

const USERNAME_RE = /^[a-z0-9][a-z0-9._-]{1,31}$/i

export function isEmailLogin(value: string): boolean {
  return value.includes('@')
}

export function normalizeUsername(value: string): string {
  return value.trim().toLowerCase()
}

export function isValidUsername(value: string): boolean {
  return USERNAME_RE.test(normalizeUsername(value))
}

export function usernameToAuthEmail(username: string): string {
  return `${normalizeUsername(username)}@${USERNAME_AUTH_DOMAIN}`
}

export function isInternalAuthEmail(email: string): boolean {
  return email.toLowerCase().endsWith(`@${USERNAME_AUTH_DOMAIN}`)
}

/** What to show in admin UI as the user's login identifier. */
export function displayLoginId(user: { email: string; username?: string | null }): string {
  if (user.username) return user.username
  return user.email
}
