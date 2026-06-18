import type { PageServerLoad } from './$types'
import { getTransactions } from '$lib/server/db.js'

export const load: PageServerLoad = async () => {
	return { transactions: getTransactions(80) }
}
