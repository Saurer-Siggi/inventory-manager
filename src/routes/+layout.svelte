<script>
	import '../app.css';
	import { onMount } from 'svelte'
	import { initAuth, user, authLoading } from '$lib/auth.js'
	import { goto } from '$app/navigation'
	import { page } from '$app/stores'
	import { pwaInfo } from 'virtual:pwa-info'
	
	onMount(async () => {
		initAuth()
		
		// Register PWA service worker
		if (pwaInfo) {
			const { registerSW } = await import('virtual:pwa-register')
			registerSW({
				immediate: true,
				onRegistered(r) {
					console.log(`SW Registered: ${r}`)
				},
				onRegisterError(error) {
					console.log('SW registration error', error)
				}
			})
		}
	})
	
	// Global auth guard - redirect to login if not authenticated
	$: if (!$authLoading && $user === null && $page.url.pathname !== '/login') {
		goto('/login')
	}
	
	$: webManifestLink = pwaInfo ? pwaInfo.webManifest.linkTag : ''
</script>

<svelte:head>
	{@html webManifestLink}
</svelte:head>

{#if $authLoading}
	<div class="min-h-screen flex items-center justify-center bg-gray-50">
		<div class="text-center">
			<div class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
			<p class="mt-4 text-gray-600">Loading...</p>
		</div>
	</div>
{:else}
	<slot />
{/if}