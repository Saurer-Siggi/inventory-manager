<script>
	import { signIn, signUp, user, authLoading } from '$lib/auth.js'
	import { supabase } from '$lib/supabaseClient.js'
	import { goto } from '$app/navigation'
	
	let email = '';
	let password = '';
	let isSignUp = false;
	let loading = false;
	let error = '';
	let showForgotPassword = false;
	let resetEmail = '';
	let resetLoading = false;
	let resetSuccess = false;
	
	// Redirect to home if already logged in
	$: if (!$authLoading && $user) {
		goto('/')
	}
	
	const handleSubmit = async (e) => {
		e.preventDefault()
		loading = true
		error = ''
		
		try {
			const { data, error: authError } = await signIn(email, password)
			
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
	
	const handleForgotPassword = async (e) => {
		e.preventDefault()
		resetLoading = true
		error = ''
		
		try {
			const { error: resetError } = await supabase.auth.resetPasswordForEmail(resetEmail, {
				redirectTo: `${window.location.origin}/reset-password`
			})
			
			if (resetError) {
				error = resetError.message
			} else {
				resetSuccess = true
			}
		} catch (e) {
			error = e.message
		} finally {
			resetLoading = false
		}
	}
</script>

<div class="min-h-screen bg-gray-50 flex items-center justify-center">
	<div class="max-w-md w-full bg-white rounded-lg shadow-md p-6">
		<div class="text-center mb-6">
			<h1 class="text-2xl font-bold text-gray-900">Saurer Siggi Inventory</h1>
			<p class="text-gray-600 mt-2">
				Sign in to your account
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
				{loading ? 'Loading...' : 'Sign In'}
			</button>
		</form>
		
		<!-- Password reset and invitation info -->
		<div class="mt-4 text-center space-y-2">
			<button
				type="button"
				on:click={() => showForgotPassword = !showForgotPassword}
				class="text-blue-600 hover:text-blue-500 text-sm"
			>
				Forgot your password?
			</button>
			
			<p class="text-gray-500 text-sm">
				Need access? Contact admin for invitation
			</p>
		</div>
		
		<!-- Forgot Password Form -->
		{#if showForgotPassword}
			<div class="mt-6 border-t pt-6">
				<h3 class="text-lg font-medium text-gray-900 mb-4">Reset Password</h3>
				
				{#if resetSuccess}
					<div class="bg-green-50 border border-green-200 rounded-lg p-3 mb-4">
						<p class="text-green-700 text-sm">
							Password reset email sent! Check your inbox and follow the link to reset your password.
						</p>
					</div>
					<button
						type="button"
						on:click={() => { showForgotPassword = false; resetSuccess = false; resetEmail = ''; }}
						class="w-full text-blue-600 hover:text-blue-500 text-sm"
					>
						Back to login
					</button>
				{:else}
					<form on:submit|preventDefault={handleForgotPassword} class="space-y-4">
						<div>
							<label for="resetEmail" class="block text-sm font-medium text-gray-700 mb-1">
								Email Address
							</label>
							<input
								type="email"
								id="resetEmail"
								bind:value={resetEmail}
								required
								class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
								placeholder="Enter your email address"
							/>
						</div>
						
						<div class="flex gap-3">
							<button
								type="button"
								on:click={() => { showForgotPassword = false; resetEmail = ''; error = ''; }}
								class="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
							>
								Cancel
							</button>
							<button
								type="submit"
								disabled={resetLoading}
								class="flex-1 bg-blue-500 text-white py-2 px-4 rounded-lg font-medium hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
							>
								{resetLoading ? 'Sending...' : 'Send Reset Email'}
							</button>
						</div>
					</form>
				{/if}
			</div>
		{/if}
	</div>
</div>