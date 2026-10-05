import { json, error } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { createStorage, updateStorage, deleteStorage, isForeignKeyViolation } from '$lib/server/db.js'

function parse(body: any) {
	const name = String(body.name ?? '').trim()
	const type = String(body.type ?? '')
	if (!name) throw error(400, 'Name ist erforderlich')
	if (!['warehouse', 'home'].includes(type)) throw error(400, 'Typ muss warehouse oder home sein')
	return {
		name,
		type,
		location_details: body.location_details ? String(body.location_details) : null,
		active: body.active !== false
	}
}

export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.authed) throw error(401, 'Nicht angemeldet')
	try {
		return json(createStorage(parse(await request.json())))
	} catch (err) {
		throw error(500, err instanceof Error ? err.message : 'Lagerort konnte nicht angelegt werden')
	}
}

export const PUT: RequestHandler = async ({ request, locals }) => {
	if (!locals.authed) throw error(401, 'Nicht angemeldet')
	const body = await request.json()
	const id = String(body.id ?? '')
	if (!id) throw error(400, 'ID fehlt')
	try {
		updateStorage(id, parse(body))
	} catch (err) {
		throw error(500, err instanceof Error ? err.message : 'Lagerort konnte nicht gespeichert werden')
	}
	return json({ ok: true })
}

export const DELETE: RequestHandler = async ({ request, locals }) => {
	if (!locals.authed) throw error(401, 'Nicht angemeldet')
	const id = String((await request.json()).id ?? '')
	if (!id) throw error(400, 'ID fehlt')
	try {
		deleteStorage(id)
	} catch (err) {
		if (isForeignKeyViolation(err))
			throw error(409, 'Löschen nicht möglich — der Lagerort wird noch verwendet. Bitte archivieren.')
		throw error(500, err instanceof Error ? err.message : 'Lagerort konnte nicht gelöscht werden')
	}
	return json({ ok: true })
}
