import { supabase } from './supabaseClient.js'
import { writable } from 'svelte/store'
import type { User } from '@supabase/supabase-js'

export const user = writable<User | null>(null)
export const authLoading = writable(true)

export const initAuth = async () => {
	try {
		const { data: { session } } = await supabase.auth.getSession()
		user.set(session?.user ?? null)

		supabase.auth.onAuthStateChange((_event, session) => {
			user.set(session?.user ?? null)
		})
	} catch (error) {
		console.error('Auth initialization error:', error)
	} finally {
		authLoading.set(false)
	}
}

export const signIn = async (email: string, password: string) => {
	const { data, error } = await supabase.auth.signInWithPassword({ email, password })
	if (!error && data.user) {
		user.set(data.user)
	}
	return { data, error }
}

export const signUp = async (email: string, password: string) => {
	const { data, error } = await supabase.auth.signUp({ email, password })
	return { data, error }
}

export const signOut = async () => {
	const { error } = await supabase.auth.signOut()
	user.set(null)
	return { error }
}

export const isAuthenticated = (): boolean => {
	let currentUser: User | null = null
	user.subscribe(value => { currentUser = value })()
	return currentUser !== null
}
