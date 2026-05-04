import { env } from '$env/dynamic/private'

/** True when user email is listed in ADMIN_EMAILS (comma-separated). If env is empty, no one is admin. */
export function getIsAdmin(email: string | undefined | null): boolean {
	const e = email?.toLowerCase().trim() ?? ''
	const raw = env.ADMIN_EMAILS ?? ''
	const admins = raw
		.split(',')
		.map(x => x.trim().toLowerCase())
		.filter(Boolean)
	return admins.length > 0 && admins.includes(e)
}
