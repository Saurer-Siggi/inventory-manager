import { writable, derived } from 'svelte/store'
import { invalidateAll } from '$app/navigation'
import type { Product, Storage, InventoryReport } from './database.types.js'

// Populated from the root layout's server `load` (see +layout.svelte).
export const products = writable<Product[]>([])
export const storages = writable<Storage[]>([])
export const inventory = writable<InventoryReport[]>([])

// Kept for backwards compatibility with the operation pages' templates.
// Data now arrives synchronously via the layout load, so there's no async loading state.
export const operationsLoading = writable(false)
export const operationsError = writable('')

/** No-op: data is provided by the layout load. Pages may still call this on mount. */
export async function loadOperationsData() {}

/** Re-run server loads so the stores pick up fresh inventory after a mutation. */
export async function refreshInventory() {
	await invalidateAll()
}

/** Derive current stock for a product+storage combination */
export const getStockForSelection = derived(inventory, $inventory => {
	return (productId: string, storageId: string): number | null => {
		const item = $inventory.find(i => i.product_id === productId && i.storage_id === storageId)
		return item ? item.quantity : null
	}
})
