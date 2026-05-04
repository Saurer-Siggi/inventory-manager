import type { PageServerLoad } from './$types'
import type { Product, Storage, InventoryReport } from '$lib/database.types.js'

export const load: PageServerLoad = async ({ locals }) => {
	const supabase = locals.supabase
	try {
		const { data: products, error: productsError } = await supabase
			.from('products')
			.select('*')
			.order('sku')

		if (productsError) {
			console.error('Products error:', productsError)
			return {
				products: [] as Product[],
				storages: [] as Storage[],
				inventory: [] as InventoryReport[],
				error: `Database error: ${productsError.message}`
			}
		}

		const { data: storages, error: storagesError } = await supabase
			.from('storages')
			.select('*')
			.order('name')

		if (storagesError) {
			console.error('Storages error:', storagesError)
			return {
				products: products ?? [],
				storages: [] as Storage[],
				inventory: [] as InventoryReport[],
				error: `Storage error: ${storagesError.message}`
			}
		}

		const { data: inventory, error: inventoryError } = await supabase
			.from('inventory_report')
			.select('*')
			.order('product_name, storage_name')

		if (inventoryError) {
			console.error('Inventory error:', inventoryError)
			return {
				products: products ?? [],
				storages: storages ?? [],
				inventory: [] as InventoryReport[],
				error: `Inventory error: ${inventoryError.message}`
			}
		}

		const inventoryList = inventory ?? []

		return {
			products: products ?? [],
			storages: storages ?? [],
			inventory: inventoryList
		}
	} catch (error) {
		console.error('Connection error:', error)
		return {
			products: [] as Product[],
			storages: [] as Storage[],
			inventory: [] as InventoryReport[],
			error: `Connection failed: ${error instanceof Error ? error.message : String(error)}`
		}
	}
}
