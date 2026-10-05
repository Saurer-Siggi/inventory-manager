<script lang="ts">
	import { enhance } from '$app/forms'

	let { form } = $props()
	let loading = $state(false)
	let show = $state(false)
</script>

<svelte:head><title>Anmelden · Siggi Inventar</title></svelte:head>

<div
	class="flex min-h-dvh items-center justify-center bg-gray-50 px-4"
	style="padding-top: max(1rem, env(safe-area-inset-top, 0px)); padding-bottom: max(1rem, env(safe-area-inset-bottom, 0px));"
>
	<div class="w-full max-w-sm rounded-3xl bg-white p-6 shadow-lg ring-1 ring-gray-100">
		<div class="mb-6 text-center">
			<div class="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-600">
				<svg class="h-7 w-7 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
					<path stroke-linecap="round" stroke-linejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
				</svg>
			</div>
			<h1 class="text-xl font-bold text-gray-900">Saurer Siggi Inventar</h1>
			<p class="mt-1 text-sm text-gray-500">Zugangspasswort eingeben</p>
		</div>

		{#if form?.error}
			<div class="mb-4 rounded-xl border border-red-200 bg-red-50 p-3" role="alert">
				<p class="text-sm text-red-700">{form.error}</p>
			</div>
		{/if}

		<form
			method="POST"
			use:enhance={() => {
				loading = true
				return async ({ update }) => {
					await update({ reset: false })
					loading = false
				}
			}}
			class="space-y-4"
		>
			<div class="relative">
				<label for="password" class="sr-only">Passwort</label>
				<!-- svelte-ignore a11y_autofocus -->
				<input
					type={show ? 'text' : 'password'}
					id="password"
					name="password"
					required
					autofocus
					autocomplete="current-password"
					enterkeyhint="go"
					class="h-14 w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 pr-14 text-base focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-200 focus:outline-none"
					placeholder="Passwort"
				/>
				<button
					type="button"
					onclick={() => (show = !show)}
					class="absolute right-2 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-xl text-gray-400 hover:text-gray-700"
					aria-label={show ? 'Passwort verbergen' : 'Passwort anzeigen'}
				>
					<svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
						{#if show}
							<path d="M3 3l18 18M10.6 10.6a2 2 0 002.8 2.8M9.9 5.2A9.8 9.8 0 0112 5c5 0 9 4.5 10 7a11.6 11.6 0 01-2.7 3.8M6.6 6.6C4.4 8 2.9 10.2 2 12c1 2.5 5 7 10 7 1.5 0 2.9-.4 4.1-1" />
						{:else}
							<path d="M2 12c1-2.5 5-7 10-7s9 4.5 10 7c-1 2.5-5 7-10 7S3 14.5 2 12z" /><circle cx="12" cy="12" r="3" />
						{/if}
					</svg>
				</button>
			</div>

			<button
				type="submit"
				disabled={loading}
				class="h-14 w-full rounded-2xl bg-blue-600 text-base font-bold text-white shadow-md transition hover:bg-blue-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
			>
				{loading ? 'Anmelden…' : 'Anmelden'}
			</button>
		</form>
	</div>
</div>
