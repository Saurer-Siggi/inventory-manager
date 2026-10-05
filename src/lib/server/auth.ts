import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'
import { building } from '$app/environment'
import { db } from './db.js'

const APP_PASSWORD = process.env.APP_PASSWORD ?? ''

export const SESSION_COOKIE = 'session'
export const SESSION_MAX_AGE = 60 * 60 * 24 * 30 // 30 days (seconds)

// A fixed default secret would let anyone forge sessions — refuse to run without real config in production.
if (!building && process.env.NODE_ENV === 'production' && (!APP_PASSWORD || APP_PASSWORD === 'change-me')) {
	throw new Error('APP_PASSWORD must be set to a real password in production')
}

const hash = (token: string) => createHash('sha256').update(token).digest('hex')

/** Creates a random, server-side revocable session. Only the hash is stored. */
export function createSession(): string {
	const token = randomBytes(32).toString('hex')
	const now = Date.now()
	db.prepare('DELETE FROM sessions WHERE expires_at < ?').run(new Date(now).toISOString())
	db.prepare('INSERT INTO sessions (token_hash, created_at, expires_at) VALUES (?, ?, ?)').run(
		hash(token),
		new Date(now).toISOString(),
		new Date(now + SESSION_MAX_AGE * 1000).toISOString()
	)
	return token
}

export function verifyToken(token: string | undefined): boolean {
	if (!token) return false
	const row = db.prepare('SELECT expires_at FROM sessions WHERE token_hash = ?').get(hash(token)) as
		| { expires_at: string }
		| undefined
	return !!row && row.expires_at > new Date().toISOString()
}

export function destroySession(token: string | undefined) {
	if (token) db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(hash(token))
}

export function checkPassword(password: string): boolean {
	if (!APP_PASSWORD) return false
	const a = createHash('sha256').update(password).digest()
	const b = createHash('sha256').update(APP_PASSWORD).digest()
	return timingSafeEqual(a, b)
}

// ─── Login rate limit (in-memory, per client address) ──────────────────────────────
const MAX_FAILS = 5
const WINDOW_MS = 15 * 60 * 1000
const fails = new Map<string, { count: number; first: number }>()

export function loginBlockedFor(key: string): number {
	const f = fails.get(key)
	if (!f) return 0
	if (Date.now() - f.first > WINDOW_MS) {
		fails.delete(key)
		return 0
	}
	return f.count >= MAX_FAILS ? Math.ceil((f.first + WINDOW_MS - Date.now()) / 60000) : 0
}

export function recordLoginFailure(key: string) {
	const f = fails.get(key)
	if (!f || Date.now() - f.first > WINDOW_MS) fails.set(key, { count: 1, first: Date.now() })
	else f.count++
}

export function clearLoginFailures(key: string) {
	fails.delete(key)
}
