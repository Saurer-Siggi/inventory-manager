<script lang="ts">
	import { enhance } from '$app/forms'

	let { form } = $props()
	let loading = $state(false)
</script>

<div
	class="flex min-h-dvh items-center justify-center bg-gray-50 px-4"
	style="padding-top: max(1rem, env(safe-area-inset-top, 0px)); padding-bottom: max(1rem, env(safe-area-inset-bottom, 0px));"
>
	<div class="w-full max-w-md rounded-lg bg-white p-6 shadow-md">
		<div class="text-center mb-6">
			<h1 class="text-2xl font-bold text-gray-900">Saurer Siggi Inventory</h1>
			<p class="text-gray-600 mt-2">Enter the access password</p>
		</div>

		{#if form?.error}
			<div class="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
				<p class="text-red-700 text-sm">{form.error}</p>
			</div>
		{/if}

		<form
			method="POST"
			use:enhance={() => {
				loading = true
				return async ({ update }) => {
					await update()
					loading = false
				}
			}}
			class="space-y-4"
		>
			<div>
				<label for="password" class="block text-sm font-medium text-gray-700 mb-1">Password</label>
				<input
					type="password"
					id="password"
					name="password"
					required
					autocomplete="current-password"
					class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
					placeholder="Enter the access password"
				/>
			</div>

			<button
				type="submit"
				disabled={loading}
				class="w-full bg-blue-500 text-white py-2 px-4 rounded-lg font-medium hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
			>
				{loading ? 'Signing in…' : 'Sign In'}
			</button>
		</form>
	</div>
</div>
