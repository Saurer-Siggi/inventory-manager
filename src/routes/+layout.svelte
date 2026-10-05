<script lang="ts">
	import '../app.css';
	import { onMount } from 'svelte'
	import { page } from '$app/stores'
	import { pwaInfo } from 'virtual:pwa-info'
	import AppShell from '$lib/components/AppShell.svelte'
	import Toast from '$lib/components/Toast.svelte'
	import { products, storages, inventory } from '$lib/stores.js'
	import { initOutbox } from '$lib/outbox.js'

	let { data, children } = $props()

	// Keep the shared stores in sync with the latest server data.
	$effect(() => {
		products.set(data.products ?? [])
		storages.set(data.storages ?? [])
		inventory.set(data.inventory ?? [])
	})

	// Active alerts whose product/location stock is at or below its threshold.
	const alertCount = $derived(
		(data.alerts ?? []).filter(a => {
			if (!a.active) return false
			const item = (data.inventory ?? []).find(i => i.product_id === a.product_id && i.storage_id === a.storage_id)
			return !!item && item.quantity <= a.threshold
		}).length
	)

	onMount(() => {
		if (pwaInfo) {
			import('virtual:pwa-register').then(({ registerSW }) => registerSW({ immediate: true }))
		}
		const stop = initOutbox()
		// Warm the service worker's page cache so the booking screens open even without signal.
		if (data.isAdmin) {
			setTimeout(() => {
				for (const url of ['/remove', '/add', '/transfer', '/history']) fetch(url).catch(() => {})
			}, 2500)
		}
		return stop
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
	<AppShell isAdmin={data.isAdmin} {alertCount}>{@render children()}</AppShell>
{:else}
	{@render children()}
{/if}
