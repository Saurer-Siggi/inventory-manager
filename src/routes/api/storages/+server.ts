import { json, error } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { createStorage, updateStorage, deleteStorage, isForeignKeyViolation } from '$lib/server/db.js'

function parse(body: any) {
	const name = String(body.name ?? '').trim()
	const type = String(body.type ?? '')
	if (!name) throw error(400, 'Name is required')
	if (!['warehouse', 'home'].includes(type)) throw error(400, 'Type must be warehouse or home')
	return {
		name,
		type,
		location_details: body.location_details ? String(body.location_details) : null,
		active: body.active !== false
	}
}

export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.authed) throw error(401, 'Not authenticated')
	try {
		return json(createStorage(parse(await request.json())))
	} catch (err) {
		throw error(500, err instanceof Error ? err.message : 'Failed to create location')
	}
}

export const PUT: RequestHandler = async ({ request, locals }) => {
	if (!locals.authed) throw error(401, 'Not authenticated')
	const body = await request.json()
	const id = String(body.id ?? '')
	if (!id) throw error(400, 'Missing id')
	try {
		updateStorage(id, parse(body))
	} catch (err) {
		throw error(500, err instanceof Error ? err.message : 'Failed to update location')
	}
	return json({ ok: true })
}

export const DELETE: RequestHandler = async ({ request, locals }) => {
	if (!locals.authed) throw error(401, 'Not authenticated')
	const id = String((await request.json()).id ?? '')
	if (!id) throw error(400, 'Missing id')
	try {
		deleteStorage(id)
	} catch (err) {
		if (isForeignKeyViolation(err))
			throw error(409, 'Cannot delete — another record still references this location. Archive it instead.')
		throw error(500, err instanceof Error ? err.message : 'Failed to delete location')
	}
	return json({ ok: true })
}
