import { supabase } from '$lib/supabaseClient.js'
import { redirect } from '@sveltejs/kit'

export async function load({ url, cookies }) {
	// For now, skip server-side authentication check
	// The client-side authentication in the layout will handle redirects
	// This is a temporary solution - in production you'd want proper server-side auth

	try {
		// Test connection by fetching products
		const { data: products, error: productsError } = await supabase
			.from('products')
			.select('*')
			.order('sku');

		if (productsError) {
			console.error('Products error:', productsError);
			return {
				products: [],
				storages: [],
				inventory: [],
				error: `Database error: ${productsError.message}`
			};
		}

		// Fetch storage locations
		const { data: storages, error: storagesError } = await supabase
			.from('storages')
			.select('*')
			.order('name');

		if (storagesError) {
			console.error('Storages error:', storagesError);
			return {
				products: products || [],
				storages: [],
				inventory: [],
				error: `Storage error: ${storagesError.message}`
			};
		}

		// Fetch inventory with product and storage details
		const { data: inventory, error: inventoryError } = await supabase
			.from('inventory_report')
			.select('*')
			.order('product_name, storage_name');

		if (inventoryError) {
			console.error('Inventory error:', inventoryError);
			return {
				products: products || [],
				storages: storages || [],
				inventory: [],
				error: `Inventory error: ${inventoryError.message}`
			};
		}

		// Calculate totals
		const totalLiköer = inventory
			.filter(item => item.sku === 'SSL-001')
			.reduce((sum, item) => sum + item.quantity, 0);

		const totalKlopfer = inventory
			.filter(item => item.sku === 'SSK-001')
			.reduce((sum, item) => sum + item.quantity, 0);

		return {
			products: products || [],
			storages: storages || [],
			inventory: inventory || [],
			totals: {
				liköer: totalLiköer,
				klopfer: totalKlopfer,
				total: totalLiköer + totalKlopfer
			},
			connectionStatus: 'Connected to Supabase ✅'
		};
	} catch (error) {
		console.error('Connection error:', error);
		return {
			products: [],
			storages: [],
			inventory: [],
			error: `Connection failed: ${error.message}`,
			connectionStatus: 'Connection failed ❌'
		};
	}
}