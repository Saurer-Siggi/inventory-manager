import { redirect } from '@sveltejs/kit'
import { supabase } from '$lib/supabaseClient.js'

export async function load() {
	try {
		// Load all products
		const { data: products, error: productsError } = await supabase
			.from('products')
			.select('*')
			.order('sku')

		if (productsError) {
			console.error('Products error:', productsError)
			return {
				error: 'Failed to load products: ' + productsError.message,
				products: [],
				storages: [],
				inventory: []
			}
		}

		// Load all storage locations
		const { data: storages, error: storagesError } = await supabase
			.from('storages')
			.select('*')
			.order('name')

		if (storagesError) {
			console.error('Storages error:', storagesError)
			return {
				error: 'Failed to load storages: ' + storagesError.message,
				products: products || [],
				storages: [],
				inventory: []
			}
		}

		// Load current inventory
		const { data: inventory, error: inventoryError } = await supabase
			.from('inventory_report')
			.select('*')
			.order('product_name, storage_name')

		if (inventoryError) {
			console.error('Inventory error:', inventoryError)
			return {
				error: 'Failed to load inventory: ' + inventoryError.message,
				products: products || [],
				storages: storages || [],
				inventory: []
			}
		}

		// Transactions are loaded client-side to avoid relationship issues

		return {
			products: products || [],
			storages: storages || [],
			inventory: inventory || [],
			connectionStatus: 'Connected to Supabase'
		}
		
	} catch (error) {
		console.error('Admin data loading error:', error)
		return {
			error: 'Failed to load admin data: ' + String(error),
			products: [],
			storages: [],
			inventory: []
		}
	}
} 