import { redirect } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { SESSION_COOKIE, destroySession } from '$lib/server/auth.js'

export const POST: RequestHandler = async ({ cookies }) => {
	destroySession(cookies.get(SESSION_COOKIE))
	cookies.delete(SESSION_COOKIE, { path: '/' })
	throw redirect(303, '/login')
}
