import { writable, derived } from 'svelte/store'
import { supabase } from './supabaseClient.js'
import type { Product, Storage, InventoryReport } from './database.types.js'

export const products = writable<Product[]>([])
export const storages = writable<Storage[]>([])
export const inventory = writable<InventoryReport[]>([])
export const operationsLoading = writable(false)
export const operationsError = writable('')

let initialized = false
let loadOperationsPromise: Promise<void> | null = null

export async function loadOperationsData() {
	if (initialized) return
	if (loadOperationsPromise) return loadOperationsPromise

	loadOperationsPromise = (async () => {
		operationsLoading.set(true)
		operationsError.set('')

		try {
			const [productsResult, storagesResult, inventoryResult] = await Promise.all([
				supabase.from('products').select('*').eq('active', true).order('sku'),
				supabase.from('storages').select('*').eq('active', true).order('name'),
				supabase.from('inventory_report').select('*').order('product_name, storage_name')
			])

			if (productsResult.error) throw new Error('Failed to load products: ' + productsResult.error.message)
			if (storagesResult.error) throw new Error('Failed to load storages: ' + storagesResult.error.message)

			products.set(productsResult.data ?? [])
			storages.set(storagesResult.data ?? [])
			if (!inventoryResult.error) inventory.set(inventoryResult.data ?? [])
			initialized = true
		} catch (err) {
			operationsError.set(err instanceof Error ? err.message : String(err))
		} finally {
			operationsLoading.set(false)
			loadOperationsPromise = null
		}
	})()

	await loadOperationsPromise
}

export async function refreshInventory() {
	const { data, error } = await supabase
		.from('inventory_report')
		.select('*')
		.order('product_name, storage_name')
	if (!error && data) inventory.set(data)
}

/** Derive current stock for a product+storage combination */
export const getStockForSelection = derived(inventory, $inventory => {
	return (productId: string, storageId: string): number | null => {
		const item = $inventory.find(i => i.product_id === productId && i.storage_id === storageId)
		return item ? item.quantity : null
	}
})
