import { json, error } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { createProduct, updateProduct, deleteProduct, isUniqueViolation, isForeignKeyViolation } from '$lib/server/db.js'

function parse(body: any) {
	const sku = String(body.sku ?? '').trim()
	const name = String(body.name ?? '').trim()
	const unit_size = String(body.unit_size ?? '').trim()
	if (!sku || !name || !unit_size) throw error(400, 'SKU, name, and unit size are required')
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
	if (!locals.authed) throw error(401, 'Not authenticated')
	const input = parse(await request.json())
	try {
		return json(createProduct(input))
	} catch (err) {
		if (isUniqueViolation(err)) throw error(409, 'A product with this SKU already exists')
		throw error(500, err instanceof Error ? err.message : 'Failed to create product')
	}
}

export const PUT: RequestHandler = async ({ request, locals }) => {
	if (!locals.authed) throw error(401, 'Not authenticated')
	const body = await request.json()
	const id = String(body.id ?? '')
	if (!id) throw error(400, 'Missing id')
	try {
		updateProduct(id, parse(body))
	} catch (err) {
		if (isUniqueViolation(err)) throw error(409, 'A product with this SKU already exists')
		throw error(500, err instanceof Error ? err.message : 'Failed to update product')
	}
	return json({ ok: true })
}

export const DELETE: RequestHandler = async ({ request, locals }) => {
	if (!locals.authed) throw error(401, 'Not authenticated')
	const id = String((await request.json()).id ?? '')
	if (!id) throw error(400, 'Missing id')
	try {
		deleteProduct(id)
	} catch (err) {
		if (isForeignKeyViolation(err)) throw error(409, 'Cannot delete — this product has history. Deactivate it instead.')
		throw error(500, err instanceof Error ? err.message : 'Failed to delete product')
	}
	return json({ ok: true })
}
