import { createHmac, timingSafeEqual } from 'node:crypto'

const APP_PASSWORD = process.env.APP_PASSWORD ?? ''
const SESSION_SECRET = process.env.SESSION_SECRET ?? 'dev-insecure-secret-change-me'

export const SESSION_COOKIE = 'session'

/** Opaque session token. There are no users — a valid token just means "knew the password". */
export function makeToken(): string {
	return createHmac('sha256', SESSION_SECRET).update('authenticated').digest('hex')
}

export function verifyToken(token: string | undefined): boolean {
	if (!token) return false
	const expected = makeToken()
	if (token.length !== expected.length) return false
	return timingSafeEqual(Buffer.from(token), Buffer.from(expected))
}

export function checkPassword(password: string): boolean {
	if (!APP_PASSWORD) return false
	const a = Buffer.from(password)
	const b = Buffer.from(APP_PASSWORD)
	if (a.length !== b.length) return false
	return timingSafeEqual(a, b)
}
