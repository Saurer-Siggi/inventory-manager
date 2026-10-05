import { json, error } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { createProduct, updateProduct, deleteProduct, isUniqueViolation, isForeignKeyViolation } from '$lib/server/db.js'

function parse(body: any) {
	const sku = String(body.sku ?? '').trim()
	const name = String(body.name ?? '').trim()
	const unit_size = String(body.unit_size ?? '').trim()
	if (!sku || !name || !unit_size) throw error(400, 'SKU, Name und Einheit sind erforderlich')
	return {
		sku,
		name,
		unit_size,
		description: body.description ? String(body.description) : null,
		pack_size: Math.max(1, Number(body.pack_size) || 1),
		active: body.active !== false
	}
}

export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.authed) throw error(401, 'Nicht angemeldet')
	const input = parse(await request.json())
	try {
		return json(createProduct(input))
	} catch (err) {
		if (isUniqueViolation(err)) throw error(409, 'Ein Produkt mit dieser SKU existiert bereits')
		throw error(500, err instanceof Error ? err.message : 'Produkt konnte nicht angelegt werden')
	}
}

export const PUT: RequestHandler = async ({ request, locals }) => {
	if (!locals.authed) throw error(401, 'Nicht angemeldet')
	const body = await request.json()
	const id = String(body.id ?? '')
	if (!id) throw error(400, 'ID fehlt')
	try {
		updateProduct(id, parse(body))
	} catch (err) {
		if (isUniqueViolation(err)) throw error(409, 'Ein Produkt mit dieser SKU existiert bereits')
		throw error(500, err instanceof Error ? err.message : 'Produkt konnte nicht gespeichert werden')
	}
	return json({ ok: true })
}

export const DELETE: RequestHandler = async ({ request, locals }) => {
	if (!locals.authed) throw error(401, 'Nicht angemeldet')
	const id = String((await request.json()).id ?? '')
	if (!id) throw error(400, 'ID fehlt')
	try {
		deleteProduct(id)
	} catch (err) {
		if (isForeignKeyViolation(err)) throw error(409, 'Löschen nicht möglich — für dieses Produkt gibt es Buchungen. Bitte deaktivieren.')
		throw error(500, err instanceof Error ? err.message : 'Produkt konnte nicht gelöscht werden')
	}
	return json({ ok: true })
}
