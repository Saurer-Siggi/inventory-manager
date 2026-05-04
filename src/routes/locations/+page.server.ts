import { redirect } from '@sveltejs/kit'
import type { PageServerLoad } from './$types'
import type { Product, Storage, InventoryReport } from '$lib/database.types.js'
import { getIsAdmin } from '$lib/isAdmin.server.js'

export const load: PageServerLoad = async ({ locals }) => {
	if (!getIsAdmin(locals.user?.email)) {
		throw redirect(303, '/')
	}

	const supabase = locals.supabase
	try {
		const { data: products, error: productsError } = await supabase
			.from('products')
			.select('*')
			.order('sku')

		if (productsError) {
			console.error('Products error:', productsError)
			return {
				error: 'Failed to load products: ' + productsError.message,
				products: [] as Product[],
				storages: [] as Storage[],
				inventory: [] as InventoryReport[]
			}
		}

		const { data: storages, error: storagesError } = await supabase
			.from('storages')
			.select('*')
			.order('name')

		if (storagesError) {
			console.error('Storages error:', storagesError)
			return {
				error: 'Failed to load storages: ' + storagesError.message,
				products: products ?? [],
				storages: [] as Storage[],
				inventory: [] as InventoryReport[]
			}
		}

		const { data: inventory, error: inventoryError } = await supabase
			.from('inventory_report')
			.select('*')
			.order('product_name, storage_name')

		if (inventoryError) {
			console.error('Inventory error:', inventoryError)
			return {
				error: 'Failed to load inventory: ' + inventoryError.message,
				products: products ?? [],
				storages: storages ?? [],
				inventory: [] as InventoryReport[]
			}
		}

		return {
			products: products ?? [],
			storages: storages ?? [],
			inventory: inventory ?? []
		}
	} catch (error) {
		console.error('Locations data loading error:', error)
		return {
			error: 'Failed to load data: ' + (error instanceof Error ? error.message : String(error)),
			products: [] as Product[],
			storages: [] as Storage[],
			inventory: [] as InventoryReport[]
		}
	}
}
