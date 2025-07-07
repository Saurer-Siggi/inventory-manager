import { supabase } from './supabaseClient.js'
import { writable } from 'svelte/store'

// Auth stores
export const user = writable(null)
export const authLoading = writable(true)

// Initialize auth state
export const initAuth = async () => {
	try {
		// Get initial session
		const { data: { session } } = await supabase.auth.getSession()
		user.set(session?.user ?? null)
		
		// Listen for auth changes
		supabase.auth.onAuthStateChange((event, session) => {
			user.set(session?.user ?? null)
		})
	} catch (error) {
		console.error('Auth initialization error:', error)
	} finally {
		// Auth is now fully initialized
		authLoading.set(false)
	}
}

// Sign in with email
export const signIn = async (email, password) => {
	const { data, error } = await supabase.auth.signInWithPassword({
		email,
		password
	})
	return { data, error }
}

// Sign up with email
export const signUp = async (email, password) => {
	const { data, error } = await supabase.auth.signUp({
		email,
		password
	})
	return { data, error }
}

// Sign out
export const signOut = async () => {
	const { error } = await supabase.auth.signOut()
	return { error }
}

// Invite user (admin only)
export const inviteUser = async (email, redirectTo = null) => {
	const { data, error } = await supabase.auth.signUp({
		email,
		password: Math.random().toString(36).slice(-8), // Random temp password
		options: {
			emailRedirectTo: redirectTo
		}
	})
	return { data, error }
}

// Check if user is authenticated
export const isAuthenticated = () => {
	let currentUser = null
	user.subscribe(value => currentUser = value)()
	return currentUser !== null
}