import { json, error } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { undoTransaction } from '$lib/server/db.js'

export const POST: RequestHandler = async ({ params, locals }) => {
	if (!locals.authed) throw error(401, 'Nicht angemeldet')
	try {
		const res = undoTransaction(params.id)
		return json({ ok: true, id: res.id })
	} catch (err) {
		throw error(400, err instanceof Error ? err.message : 'Rückgängig fehlgeschlagen')
	}
}
