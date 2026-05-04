import { createBrowserClient } from '@supabase/ssr'
import { env } from '$env/dynamic/public'

const supabaseUrl = env.PUBLIC_SUPABASE_URL
const supabaseKey = env.PUBLIC_SUPABASE_ANON_KEY

if ((!supabaseUrl || supabaseUrl === 'undefined') && typeof window !== 'undefined') {
	throw new Error('PUBLIC_SUPABASE_URL is required. Please check your .env file.')
}
if ((!supabaseKey || supabaseKey === 'undefined') && typeof window !== 'undefined') {
	throw new Error('PUBLIC_SUPABASE_ANON_KEY is required. Please check your .env file.')
}

/** Browser client: persists session to cookies so `hooks.server.ts` can read the same session. */
export const supabase = createBrowserClient(
	supabaseUrl || 'https://placeholder.supabase.co',
	supabaseKey || 'placeholder-key'
)
