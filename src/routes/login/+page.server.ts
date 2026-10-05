import { fail, redirect } from '@sveltejs/kit'
import type { Actions, PageServerLoad } from './$types'
import {
	SESSION_COOKIE,
	SESSION_MAX_AGE,
	createSession,
	checkPassword,
	loginBlockedFor,
	recordLoginFailure,
	clearLoginFailures
} from '$lib/server/auth.js'

export const load: PageServerLoad = async ({ locals }) => {
	if (locals.authed) throw redirect(303, '/')
	return {}
}

export const actions: Actions = {
	default: async ({ request, cookies, getClientAddress }) => {
		let key = 'unknown'
		try {
			key = getClientAddress()
		} catch {}

		const blocked = loginBlockedFor(key)
		if (blocked) return fail(429, { error: `Zu viele Versuche. Bitte in ${blocked} Min. erneut probieren.` })

		const data = await request.formData()
		const password = String(data.get('password') ?? '')

		if (!checkPassword(password)) {
			recordLoginFailure(key)
			return fail(401, { error: 'Falsches Passwort' })
		}
		clearLoginFailures(key)

		cookies.set(SESSION_COOKIE, createSession(), {
			path: '/',
			httpOnly: true,
			sameSite: 'lax',
			secure: process.env.NODE_ENV === 'production',
			maxAge: SESSION_MAX_AGE
		})

		throw redirect(303, '/')
	}
}
