import { writable } from 'svelte/store'

export type ToastType = 'success' | 'error' | 'info'

export interface Toast {
	id: string
	type: ToastType
	message: string
}

function createToastStore() {
	const { subscribe, update } = writable<Toast[]>([])

	const add = (type: ToastType, message: string) => {
		const id = crypto.randomUUID()
		update(toasts => [...toasts, { id, type, message }])
		setTimeout(() => {
			update(toasts => toasts.filter(t => t.id !== id))
		}, 3500)
	}

	return {
		subscribe,
		success: (message: string) => add('success', message),
		error: (message: string) => add('error', message),
		info: (message: string) => add('info', message),
		dismiss: (id: string) => update(toasts => toasts.filter(t => t.id !== id))
	}
}

export const toast = createToastStore()
