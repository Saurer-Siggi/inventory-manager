import { json, error } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { applyTransaction, getStock, InsufficientStockError } from '$lib/server/db.js'
import type { TransactionType } from '$lib/database.types.js'

export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.authed) throw error(401, 'Nicht angemeldet')

	const body = await request.json()
	const type = body.transaction_type as TransactionType
	const product_id = String(body.product_id ?? '')
	const storage_id = String(body.storage_id ?? '')
	const quantity = Number(body.quantity)
	const notes = body.notes ? String(body.notes).trim().slice(0, 500) || null : null
	const client_id = body.client_id ? String(body.client_id).slice(0, 64) : null
	const force = body.force === true

	if (!['add', 'remove', 'transfer'].includes(type)) throw error(400, 'Ungültiger Buchungstyp')
	if (!product_id || !storage_id) throw error(400, 'Produkt und Lagerort sind erforderlich')
	if (!Number.isInteger(quantity) || quantity <= 0) throw error(400, 'Menge muss eine positive ganze Zahl sein')

	let from_storage_id: string | null = null
	let to_storage_id: string | null = null
	if (type === 'transfer') {
		from_storage_id = String(body.from_storage_id ?? '')
		to_storage_id = String(body.to_storage_id ?? '')
		if (!from_storage_id || !to_storage_id) throw error(400, 'Umlagerung braucht Quelle und Ziel')
		if (from_storage_id === to_storage_id) throw error(400, 'Quelle und Ziel müssen verschieden sein')
	}

	try {
		const res = applyTransaction({
			product_id,
			storage_id,
			transaction_type: type,
			quantity,
			from_storage_id,
			to_storage_id,
			notes,
			client_id,
			force
		})
		return json({ ok: true, id: res.id, duplicate: res.duplicate })
	} catch (err) {
		if (err instanceof InsufficientStockError) {
			return json(
				{ ok: false, code: 'insufficient_stock', message: err.message, available: err.available },
				{ status: 409 }
			)
		}
		throw error(500, err instanceof Error ? err.message : 'Buchung fehlgeschlagen')
	}
}
