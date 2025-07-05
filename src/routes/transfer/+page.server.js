import { supabase } from '$lib/supabaseClient.js'
import { redirect } from '@sveltejs/kit'

export async function load({ cookies }) {
	// Check if user is authenticated
	const { data: { session } } = await supabase.auth.getSession()
	
	if (!session) {
		throw redirect(303, '/login')
	}

	try {
		// Fetch products
		const { data: products, error: productsError } = await supabase
			.from('products')
			.select('*')
			.eq('active', true)
			.order('sku')

		if (productsError) {
			throw new Error(`Products error: ${productsError.message}`)
		}

		// Fetch storage locations
		const { data: storages, error: storagesError } = await supabase
			.from('storages')
			.select('*')
			.eq('active', true)
			.order('name')

		if (storagesError) {
			throw new Error(`Storages error: ${storagesError.message}`)
		}

		return {
			products: products || [],
			storages: storages || [],
			userEmail: session.user.email
		}
	} catch (error) {
		console.error('Load error:', error)
		throw redirect(303, '/')
	}
}