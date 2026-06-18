import type { PageServerLoad } from './$types'
import { getProducts, getStorages, getInventoryReport, getAlerts } from '$lib/server/db.js'

export const load: PageServerLoad = async () => {
	return {
		products: getProducts(),
		storages: getStorages(),
		inventory: getInventoryReport(),
		alerts: getAlerts(false)
	}
}
