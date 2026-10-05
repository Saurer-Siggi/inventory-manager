import { writable } from 'svelte/store'
import { browser } from '$app/environment'
import { invalidateAll } from '$app/navigation'
import { toast } from '$lib/components/toast.js'

/**
 * Offline outbox: bookings that could not reach the server are kept in localStorage and
 * replayed (with their idempotency key, so a retry can never double-book) as soon as we are online.
 */
export type OutboxItem = {
	client_id: string
	label: string
	payload: Record<string, unknown>
	queued_at: number
}

const KEY = 'siggi:outbox:v1'

function read(): OutboxItem[] {
	if (!browser) return []
	try {
		return JSON.parse(localStorage.getItem(KEY) ?? '[]')
	} catch {
		return []
	}
}

function write(items: OutboxItem[]) {
	try {
		localStorage.setItem(KEY, JSON.stringify(items))
	} catch {}
	outbox.set(items)
}

export const outbox = writable<OutboxItem[]>(read())
export const online = writable(browser ? navigator.onLine : true)
export const syncing = writable(false)

export function enqueue(item: OutboxItem) {
	write([...read(), item])
}

let flushing = false

export async function flushOutbox(): Promise<void> {
	if (!browser || flushing) return
	if (read().length === 0) return
	flushing = true
	syncing.set(true)
	let sent = 0
	try {
		for (const item of read()) {
			let res: Response
			try {
				res = await fetch('/api/transactions', {
					method: 'POST',
					headers: { 'content-type': 'application/json' },
					// Offline bookings already happened physically → never reject for stock reasons.
					body: JSON.stringify({ ...item.payload, client_id: item.client_id, force: true })
				})
			} catch {
				break // still offline — keep the rest queued
			}
			if (res.status === 401) {
				location.href = '/login'
				break
			}
			if (res.ok || (res.status >= 400 && res.status < 500)) {
				// Success, or a permanent client error that would never succeed on retry → drop it.
				if (!res.ok) toast.error(`Buchung verworfen: ${item.label}`)
				else sent++
				write(read().filter(i => i.client_id !== item.client_id))
			} else {
				break // 5xx: retry later
			}
		}
	} finally {
		flushing = false
		syncing.set(false)
	}
	if (sent > 0) {
		toast.success(sent === 1 ? '1 Offline-Buchung synchronisiert' : `${sent} Offline-Buchungen synchronisiert`)
		await invalidateAll()
	}
}

export function initOutbox() {
	if (!browser) return () => {}
	const onOnline = () => {
		online.set(true)
		void flushOutbox()
	}
	const onOffline = () => online.set(false)
	const onVisible = () => {
		if (document.visibilityState === 'visible') void flushOutbox()
	}
	window.addEventListener('online', onOnline)
	window.addEventListener('offline', onOffline)
	document.addEventListener('visibilitychange', onVisible)
	const timer = setInterval(() => void flushOutbox(), 30_000)
	void flushOutbox()
	return () => {
		window.removeEventListener('online', onOnline)
		window.removeEventListener('offline', onOffline)
		document.removeEventListener('visibilitychange', onVisible)
		clearInterval(timer)
	}
}

/** Pending delta per product+storage so offline bookings show up in the UI immediately. */
export function pendingDelta(items: OutboxItem[], productId: string, storageId: string): number {
	let d = 0
	for (const i of items) {
		const p = i.payload as any
		if (p.product_id !== productId) continue
		if (p.transaction_type === 'add' && p.storage_id === storageId) d += p.quantity
		if (p.transaction_type === 'remove' && p.storage_id === storageId) d -= p.quantity
		if (p.transaction_type === 'transfer') {
			if (p.from_storage_id === storageId) d -= p.quantity
			if (p.to_storage_id === storageId) d += p.quantity
		}
	}
	return d
}

