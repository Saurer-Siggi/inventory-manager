import { createClient } from '@supabase/supabase-js'

// Get environment variables
const supabaseUrl = process.env.PUBLIC_SUPABASE_URL
const supabaseKey = process.env.PUBLIC_SUPABASE_ANON_KEY

// Validate environment variables
if (!supabaseUrl) {
	throw new Error('PUBLIC_SUPABASE_URL is required. Please check your .env file.')
}
if (!supabaseKey) {
	throw new Error('PUBLIC_SUPABASE_ANON_KEY is required. Please check your .env file.')
}

export const supabase = createClient(supabaseUrl, supabaseKey)
