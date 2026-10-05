import { json, error } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { createAlert, updateAlert, deleteAlert, isUniqueViolation } from '$lib/server/db.js'

function parse(body: any) {
	const product_id = String(body.product_id ?? '')
	const storage_id = String(body.storage_id ?? '')
	const threshold = Number(body.threshold)
	if (!product_id || !storage_id) throw error(400, 'Produkt und Lagerort sind erforderlich')
	if (!Number.isInteger(threshold) || threshold < 0) throw error(400, 'Schwellenwert muss 0 oder größer sein')
	return { product_id, storage_id, threshold, active: body.active !== false }
}

export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.authed) throw error(401, 'Nicht angemeldet')
	try {
		createAlert(parse(await request.json()))
	} catch (err) {
		if (isUniqueViolation(err)) throw error(409, 'Für dieses Produkt und diesen Lagerort gibt es bereits eine Warnung')
		throw error(500, err instanceof Error ? err.message : 'Warnung konnte nicht angelegt werden')
	}
	return json({ ok: true })
}

export const PUT: RequestHandler = async ({ request, locals }) => {
	if (!locals.authed) throw error(401, 'Nicht angemeldet')
	const body = await request.json()
	const id = String(body.id ?? '')
	if (!id) throw error(400, 'ID fehlt')
	try {
		updateAlert(id, parse(body))
	} catch (err) {
		if (isUniqueViolation(err)) throw error(409, 'Für dieses Produkt und diesen Lagerort gibt es bereits eine Warnung')
		throw error(500, err instanceof Error ? err.message : 'Warnung konnte nicht gespeichert werden')
	}
	return json({ ok: true })
}

export const DELETE: RequestHandler = async ({ request, locals }) => {
	if (!locals.authed) throw error(401, 'Nicht angemeldet')
	const id = String((await request.json()).id ?? '')
	if (!id) throw error(400, 'ID fehlt')
	deleteAlert(id)
	return json({ ok: true })
}
