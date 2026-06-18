import { json, error } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { applyTransaction } from '$lib/server/db.js'
import type { TransactionType } from '$lib/database.types.js'

export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.authed) throw error(401, 'Not authenticated')

	const body = await request.json()
	const type = body.transaction_type as TransactionType
	const product_id = String(body.product_id ?? '')
	const storage_id = String(body.storage_id ?? '')
	const quantity = Number(body.quantity)
	const notes = body.notes ? String(body.notes) : null

	if (!['add', 'remove', 'transfer'].includes(type)) throw error(400, 'Invalid transaction type')
	if (!product_id || !storage_id) throw error(400, 'Product and storage are required')
	if (!Number.isInteger(quantity) || quantity <= 0) throw error(400, 'Quantity must be a positive integer')

	let from_storage_id: string | null = null
	let to_storage_id: string | null = null
	if (type === 'transfer') {
		from_storage_id = String(body.from_storage_id ?? '')
		to_storage_id = String(body.to_storage_id ?? '')
		if (!from_storage_id || !to_storage_id) throw error(400, 'Transfer needs source and destination')
		if (from_storage_id === to_storage_id) throw error(400, 'Source and destination must differ')
	}

	try {
		applyTransaction({ product_id, storage_id, transaction_type: type, quantity, from_storage_id, to_storage_id, notes })
	} catch (err) {
		throw error(500, err instanceof Error ? err.message : 'Failed to record transaction')
	}

	return json({ ok: true })
}
