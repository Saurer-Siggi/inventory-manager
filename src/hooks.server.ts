import { createServerClient } from '@supabase/ssr'
import { redirect, type Handle } from '@sveltejs/kit'
import { env } from '$env/dynamic/public'
// Non-null: validated at startup by supabaseClient.ts
const PUBLIC_SUPABASE_URL = env.PUBLIC_SUPABASE_URL!
const PUBLIC_SUPABASE_ANON_KEY = env.PUBLIC_SUPABASE_ANON_KEY!

const PROTECTED_PATHS = ['/']
const PUBLIC_PATHS = ['/login', '/invite', '/test-invite', '/reset-password']

export const handle: Handle = async ({ event, resolve }) => {
	event.locals.supabase = createServerClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY, {
		cookies: {
			getAll: () => event.cookies.getAll(),
			setAll: (cookiesToSet) => {
				for (const { name, value, options } of cookiesToSet) {
					event.cookies.set(name, value, { ...options, path: '/' })
				}
			}
		}
	})

	const { data: { user } } = await event.locals.supabase.auth.getUser()
	event.locals.user = user

	const isPublicPath = PUBLIC_PATHS.some(p => event.url.pathname.startsWith(p))
	const isProtectedPath = PROTECTED_PATHS.some(p => event.url.pathname.startsWith(p))

	if (!user && isProtectedPath && !isPublicPath) {
		throw redirect(303, '/login')
	}

	return resolve(event, {
		filterSerializedResponseHeaders: (name) => name === 'content-range' || name === 'x-supabase-api-version'
	})
}
