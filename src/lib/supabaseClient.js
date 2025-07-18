import { createClient } from '@supabase/supabase-js'
import { env } from '$env/dynamic/public'

// Get environment variables
const supabaseUrl = env.PUBLIC_SUPABASE_URL
const supabaseKey = env.PUBLIC_SUPABASE_ANON_KEY

// Validate environment variables (allow dummy values during build)
if (!supabaseUrl || supabaseUrl === 'undefined') {
	throw new Error('PUBLIC_SUPABASE_URL is required. Please check your .env file.')
}
if (!supabaseKey || supabaseKey === 'undefined') {
	throw new Error('PUBLIC_SUPABASE_ANON_KEY is required. Please check your .env file.')
}

export const supabase = createClient(supabaseUrl, supabaseKey)
