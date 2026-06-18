import { fail, redirect } from '@sveltejs/kit'
import type { Actions, PageServerLoad } from './$types'
import { SESSION_COOKIE, makeToken, checkPassword } from '$lib/server/auth.js'

export const load: PageServerLoad = async ({ locals }) => {
	if (locals.authed) throw redirect(303, '/')
	return {}
}

export const actions: Actions = {
	default: async ({ request, cookies }) => {
		const data = await request.formData()
		const password = String(data.get('password') ?? '')

		if (!checkPassword(password)) {
			return fail(401, { error: 'Incorrect password' })
		}

		cookies.set(SESSION_COOKIE, makeToken(), {
			path: '/',
			httpOnly: true,
			sameSite: 'lax',
			secure: process.env.NODE_ENV === 'production',
			maxAge: 60 * 60 * 24 * 30 // 30 days
		})

		throw redirect(303, '/')
	}
}
