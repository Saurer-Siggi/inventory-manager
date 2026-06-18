<script lang="ts">
	import '../app.css';
	import { onMount } from 'svelte'
	import { page } from '$app/stores'
	import { pwaInfo } from 'virtual:pwa-info'
	import AppShell from '$lib/components/AppShell.svelte'
	import Toast from '$lib/components/Toast.svelte'
	import { products, storages, inventory } from '$lib/stores.js'

	let { data, children } = $props()

	// Keep the shared stores in sync with the latest server data.
	$effect(() => {
		products.set(data.products ?? [])
		storages.set(data.storages ?? [])
		inventory.set(data.inventory ?? [])
	})

	onMount(async () => {
		if (pwaInfo) {
			const { registerSW } = await import('virtual:pwa-register')
			registerSW({ immediate: true })
		}
	})

	const allowedUnauthenticatedPaths = ['/login']

	const useAppShell = $derived(
		!allowedUnauthenticatedPaths.includes($page.url.pathname) &&
			!$page.url.pathname.startsWith('/admin')
	)

	const webManifestLink = $derived(pwaInfo ? pwaInfo.webManifest.linkTag : '')
</script>

<svelte:head>
	{@html webManifestLink}
</svelte:head>

<Toast />

{#if useAppShell}
	<AppShell isAdmin={data.isAdmin}>{@render children()}</AppShell>
{:else}
	{@render children()}
{/if}
