<script lang="ts">
	import '../app.css';
	import { onMount } from 'svelte'
	import { initAuth, user, authLoading } from '$lib/auth.js'
	import { goto } from '$app/navigation'
	import { page } from '$app/stores'
	import { pwaInfo } from 'virtual:pwa-info'
	import AppShell from '$lib/components/AppShell.svelte'
	import Toast from '$lib/components/Toast.svelte'

	let { data, children } = $props()

	onMount(async () => {
		initAuth()

		if (pwaInfo) {
			const { registerSW } = await import('virtual:pwa-register')
			registerSW({ immediate: true })
		}
	})

	const allowedUnauthenticatedPaths = ['/login', '/invite', '/test-invite', '/reset-password']

	const useAppShell = $derived(
		$user !== null &&
			!allowedUnauthenticatedPaths.includes($page.url.pathname) &&
			!$page.url.pathname.startsWith('/admin')
	)

	$effect(() => {
		if (!$authLoading && $user === null && !allowedUnauthenticatedPaths.includes($page.url.pathname)) {
			goto('/login')
		}
	})

	const webManifestLink = $derived(pwaInfo ? pwaInfo.webManifest.linkTag : '')
</script>

<svelte:head>
	{@html webManifestLink}
</svelte:head>

<Toast />

{#if $authLoading}
	<div
		class="flex min-h-dvh items-center justify-center bg-gray-50"
		style="padding-top: env(safe-area-inset-top, 0px); padding-bottom: env(safe-area-inset-bottom, 0px);"
	>
		<div class="text-center">
			<div class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
			<p class="mt-4 text-gray-600">Loading...</p>
		</div>
	</div>
{:else if useAppShell}
	<AppShell isAdmin={data.isAdmin}>{@render children()}</AppShell>
{:else}
	{@render children()}
{/if}
