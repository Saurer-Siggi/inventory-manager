import { json, redirect, type Handle } from '@sveltejs/kit'
import { SESSION_COOKIE, verifyToken } from '$lib/server/auth.js'

const PUBLIC_PATHS = ['/login']

export const handle: Handle = async ({ event, resolve }) => {
	event.locals.authed = verifyToken(event.cookies.get(SESSION_COOKIE))

	const isPublicPath = PUBLIC_PATHS.some(p => event.url.pathname.startsWith(p))

	if (!event.locals.authed && !isPublicPath) {
		// API clients (fetch, offline sync) need a real 401, not a redirect to the login HTML.
		if (event.url.pathname.startsWith('/api/')) return json({ message: 'Nicht angemeldet' }, { status: 401 })
		throw redirect(303, '/login')
	}

	return resolve(event)
}
