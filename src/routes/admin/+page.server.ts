import { redirect } from '@sveltejs/kit'
import type { PageServerLoad } from './$types'
import type { Product } from '$lib/database.types.js'
import { getIsAdmin } from '$lib/isAdmin.server.js'

export const load: PageServerLoad = async ({ locals }) => {
	if (!getIsAdmin(locals.user?.email)) {
		throw redirect(303, '/')
	}

	const supabase = locals.supabase
	try {
		const { data: products, error: productsError } = await supabase.from('products').select('*').order('sku')

		if (productsError) {
			console.error('Products error:', productsError)
			return {
				error: 'Failed to load products: ' + productsError.message,
				products: [] as Product[]
			}
		}

		return { products: products ?? [] }
	} catch (error) {
		console.error('Admin data loading error:', error)
		return {
			error: 'Failed to load admin data: ' + (error instanceof Error ? error.message : String(error)),
			products: [] as Product[]
		}
	}
}
