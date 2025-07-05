<script>
	import { signIn, signUp, user, authLoading } from '$lib/auth.js'
	import { goto } from '$app/navigation'
	
	let email = '';
	let password = '';
	let isSignUp = false;
	let loading = false;
	let error = '';
	
	// Redirect to home if already logged in
	$: if (!$authLoading && $user) {
		goto('/')
	}
	
	const handleSubmit = async (e) => {
		e.preventDefault()
		loading = true
		error = ''
		
		try {
			const { data, error: authError } = isSignUp 
				? await signUp(email, password)
				: await signIn(email, password)
			
			if (authError) {
				error = authError.message
			} else if (data?.user) {
				setTimeout(() => {
					goto('/')
				}, 100)
			}
		} catch (e) {
			error = e.message
		} finally {
			loading = false
		}
	}
</script>

<div class="min-h-screen bg-gray-50 flex items-center justify-center">
	<div class="max-w-md w-full bg-white rounded-lg shadow-md p-6">
		<div class="text-center mb-6">
			<h1 class="text-2xl font-bold text-gray-900">Saurer Siggi Inventory</h1>
			<p class="text-gray-600 mt-2">
				{isSignUp ? 'Create your account' : 'Sign in to your account'}
			</p>
		</div>
		
		{#if error}
			<div class="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
				<p class="text-red-700 text-sm">{error}</p>
			</div>
		{/if}
		
		<form on:submit|preventDefault={handleSubmit} class="space-y-4">
			<div>
				<label for="email" class="block text-sm font-medium text-gray-700 mb-1">
					Email
				</label>
				<input
					type="email"
					id="email"
					bind:value={email}
					required
					class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
					placeholder="Enter your email"
				/>
			</div>
			
			<div>
				<label for="password" class="block text-sm font-medium text-gray-700 mb-1">
					Password
				</label>
				<input
					type="password"
					id="password"
					bind:value={password}
					required
					class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
					placeholder="Enter your password"
				/>
			</div>
			
			<button
				type="submit"
				disabled={loading}
				class="w-full bg-blue-500 text-white py-2 px-4 rounded-lg font-medium hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
			>
				{loading ? 'Loading...' : isSignUp ? 'Sign Up' : 'Sign In'}
			</button>
		</form>
		
		<div class="mt-4 text-center">
			<button
				type="button"
				on:click={() => isSignUp = !isSignUp}
				class="text-blue-500 hover:text-blue-600 text-sm"
			>
				{isSignUp ? 'Already have an account? Sign In' : 'Need an account? Sign Up'}
			</button>
		</div>
	</div>
</div>