import { json, error } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { createAlert, updateAlert, deleteAlert, isUniqueViolation } from '$lib/server/db.js'

function parse(body: any) {
	const product_id = String(body.product_id ?? '')
	const storage_id = String(body.storage_id ?? '')
	const threshold = Number(body.threshold)
	if (!product_id || !storage_id) throw error(400, 'Product and location are required')
	if (!Number.isInteger(threshold) || threshold < 0) throw error(400, 'Threshold must be zero or more')
	return { product_id, storage_id, threshold, active: body.active !== false }
}

export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.authed) throw error(401, 'Not authenticated')
	try {
		createAlert(parse(await request.json()))
	} catch (err) {
		if (isUniqueViolation(err)) throw error(409, 'An alert already exists for this product + location')
		throw error(500, err instanceof Error ? err.message : 'Failed to create alert')
	}
	return json({ ok: true })
}

export const PUT: RequestHandler = async ({ request, locals }) => {
	if (!locals.authed) throw error(401, 'Not authenticated')
	const body = await request.json()
	const id = String(body.id ?? '')
	if (!id) throw error(400, 'Missing id')
	try {
		updateAlert(id, parse(body))
	} catch (err) {
		if (isUniqueViolation(err)) throw error(409, 'An alert already exists for this product + location')
		throw error(500, err instanceof Error ? err.message : 'Failed to update alert')
	}
	return json({ ok: true })
}

export const DELETE: RequestHandler = async ({ request, locals }) => {
	if (!locals.authed) throw error(401, 'Not authenticated')
	const id = String((await request.json()).id ?? '')
	if (!id) throw error(400, 'Missing id')
	deleteAlert(id)
	return json({ ok: true })
}
