// Per-device convenience state (last used location etc.). Everything is try/catch-wrapped:
// storage can be blocked or empty (private mode) and the app must work without it.
const KEY = 'siggi:prefs:v1'

export type Prefs = {
	lastStorage?: Record<string, string> // per mode: remove | add | transfer(from)
	lastToStorage?: string
	lastProduct?: string
	unit?: 'packs' | 'bottles'
}

export function loadPrefs(): Prefs {
	try {
		return JSON.parse(localStorage.getItem(KEY) ?? '{}') as Prefs
	} catch {
		return {}
	}
}

export function savePrefs(patch: Partial<Prefs>) {
	try {
		localStorage.setItem(KEY, JSON.stringify({ ...loadPrefs(), ...patch }))
	} catch {}
}

export function uuid(): string {
	if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
	return 'id-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10)
}

export function haptic(ms = 12) {
	try {
		navigator.vibrate?.(ms)
	} catch {}
}
