import type { User, SupabaseClient } from '@supabase/supabase-js'

declare global {
	namespace App {
		interface Error {
			message: string
		}
		interface Locals {
			user: User | null
			supabase: SupabaseClient
		}
		interface LayoutData {
			isAdmin: boolean
		}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}
}

export {}
