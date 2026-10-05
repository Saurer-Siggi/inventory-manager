import type { LayoutServerLoad } from './$types'
import { getProducts, getStorages, getInventoryReport, getAlerts, getRecentCombos, getRecentNotes } from '$lib/server/db.js'

export const load: LayoutServerLoad = async ({ locals }) => {
	if (!locals.authed) {
		// Public pages (login) — no data needed.
		return { isAdmin: false, products: [], storages: [], inventory: [], alerts: [], recent: [], recentNotes: [] }
	}

	return {
		// No per-user identity with shared-password auth: anyone logged in can manage everything.
		isAdmin: true,
		products: getProducts(),
		storages: getStorages(),
		inventory: getInventoryReport(),
		alerts: getAlerts(true),
		recent: getRecentCombos(),
		recentNotes: getRecentNotes()
	}
}
