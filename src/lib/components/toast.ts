import { writable } from 'svelte/store'

export type ToastType = 'success' | 'error' | 'info'

export interface Toast {
	id: string
	type: ToastType
	message: string
	action?: { label: string; run: () => void | Promise<void> }
}

function createToastStore() {
	const { subscribe, update } = writable<Toast[]>([])

	const add = (type: ToastType, message: string, opts: { action?: Toast['action']; duration?: number } = {}) => {
		const id = crypto.randomUUID()
		update(toasts => [...toasts.slice(-2), { id, type, message, action: opts.action }])
		setTimeout(() => {
			update(toasts => toasts.filter(t => t.id !== id))
		}, opts.duration ?? (type === 'error' ? 5000 : 3500))
		return id
	}

	return {
		subscribe,
		success: (message: string, opts?: { action?: Toast['action']; duration?: number }) => add('success', message, opts),
		error: (message: string, opts?: { action?: Toast['action']; duration?: number }) => add('error', message, opts),
		info: (message: string, opts?: { action?: Toast['action']; duration?: number }) => add('info', message, opts),
		dismiss: (id: string) => update(toasts => toasts.filter(t => t.id !== id))
	}
}

export const toast = createToastStore()
