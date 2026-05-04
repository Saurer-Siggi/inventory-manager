import type { LayoutServerLoad } from './$types'
import { getIsAdmin } from '$lib/isAdmin.server.js'

export const load: LayoutServerLoad = async ({ locals }) => {
	return {
		isAdmin: getIsAdmin(locals.user?.email)
	}
}
