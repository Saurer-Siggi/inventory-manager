import { createClient } from '@supabase/supabase-js'
import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY } from '$env/static/public'

// Get environment variables
const supabaseUrl = PUBLIC_SUPABASE_URL
const supabaseKey = PUBLIC_SUPABASE_ANON_KEY

// Validate environment variables
if (!supabaseUrl) {
	throw new Error('PUBLIC_SUPABASE_URL is required. Please check your .env file.')
}
if (!supabaseKey) {
	throw new Error('PUBLIC_SUPABASE_ANON_KEY is required. Please check your .env file.')
}

export const supabase = createClient(supabaseUrl, supabaseKey)