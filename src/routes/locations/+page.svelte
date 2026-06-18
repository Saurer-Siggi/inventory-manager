<script lang="ts">
	import { invalidateAll } from '$app/navigation'
	import { toast } from '$lib/components/toast.js'
	import Drawer from '$lib/components/Drawer.svelte'

	let { data } = $props()

	let loading = $state(false)
	const dataLoading = false
	const products = $derived(data.products ?? [])
	const storages = $derived(data.storages ?? [])
	const inventoryData = $derived(data.inventory ?? [])

	const refreshInventory = async () => {
		await invalidateAll()
	}

	const sortedStorages = $derived(
		[...storages].sort((a, b) => {
			if (a.type !== b.type) return a.type === 'warehouse' ? -1 : 1
			return a.name.localeCompare(b.name)
		})
	)

	const activeSortedStorages = $derived(sortedStorages.filter((s: any) => s.active))
	const archivedSortedStorages = $derived(sortedStorages.filter((s: any) => !s.active))

	const rowsForStorage = (name: string) => inventoryData.filter(i => i.storage_name === name)

	const totalForStorage = (name: string) =>
		rowsForStorage(name).reduce((s, i) => s + i.quantity, 0)

	// ─── Storages ────────────────────────────────────────────────────────────────
	let storageDrawerOpen = $state(false)
	let storageForm = $state({ id: null as string | null, name: '', type: 'warehouse', location_details: '', active: true })

	const openNewStorage = () => {
		storageForm = { id: null, name: '', type: 'warehouse', location_details: '', active: true }
		storageDrawerOpen = true
	}

	const openEditStorage = (storage: any) => {
		storageForm = {
			id: storage.id,
			name: storage.name,
			type: storage.type,
			location_details: storage.location_details ?? '',
			active: storage.active
		}
		storageDrawerOpen = true
	}

	const saveStorage = async () => {
		if (!storageForm.name || !storageForm.type) {
			toast.error('Name and type are required')
			return
		}
		loading = true
		try {
			const res = await fetch('/api/storages', {
				method: storageForm.id ? 'PUT' : 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({
					id: storageForm.id,
					name: storageForm.name,
					type: storageForm.type,
					location_details: storageForm.location_details,
					active: storageForm.active
				})
			})
			if (!res.ok) {
				toast.error((await res.json().catch(() => ({})))?.message ?? 'Failed to save location')
				return
			}
			toast.success(storageForm.id ? 'Location updated' : 'Location created')
			storageDrawerOpen = false
			await invalidateAll()
		} catch (e: any) {
			toast.error(e.message)
		} finally {
			loading = false
		}
	}

	const deleteStorage = async () => {
		if (!storageForm.id) return
		if (!confirm(`Permanently delete "${storageForm.name}"? This cannot be undone.`)) return
		loading = true
		try {
			const res = await fetch('/api/storages', {
				method: 'DELETE',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ id: storageForm.id })
			})
			if (!res.ok) {
				toast.error((await res.json().catch(() => ({})))?.message ?? 'Failed to delete location')
				return
			}
			toast.success(`Deleted "${storageForm.name}"`)
			storageDrawerOpen = false
			await invalidateAll()
		} catch (e: any) {
			toast.error(e.message ?? String(e))
		} finally {
			loading = false
		}
	}

	// ─── Stock count ─────────────────────────────────────────────────────────────
	let correctionDrawerOpen = $state(false)
	let correctionItem = $state<any>(null)
	let correctionTargetPacks = $state(0)
	let correctionNotes = $state('Stock count')

	const correctionPackSize = $derived(
		correctionItem ? (products.find((p: any) => p.name === correctionItem.product_name)?.pack_size ?? 1) : 1
	)
	const correctionUsesPacks = $derived(correctionPackSize > 1)
	const correctionCurrentPacks = $derived(
		correctionItem && correctionUsesPacks
			? Math.floor(correctionItem.quantity / correctionPackSize)
			: (correctionItem?.quantity ?? 0)
	)
	const correctionTargetBottles = $derived(correctionTargetPacks * correctionPackSize)
	const correctionDiffBottles = $derived(correctionItem ? correctionTargetBottles - correctionItem.quantity : 0)
	const correctionDiffPacks = $derived(
		correctionUsesPacks ? Math.round(correctionDiffBottles / correctionPackSize) : correctionDiffBottles
	)

	const openCorrection = (item: any) => {
		correctionItem = item
		const ps = products.find((p: any) => p.name === item.product_name)?.pack_size ?? 1
		correctionTargetPacks = ps > 1 ? Math.floor(item.quantity / ps) : item.quantity
		correctionNotes = 'Stock count'
		correctionDrawerOpen = true
	}

	const applyCorrection = async () => {
		if (!correctionItem) return
		if (correctionDiffBottles === 0) {
			toast.info('Already matches')
			correctionDrawerOpen = false
			return
		}
		loading = true
		try {
			const product = products.find((p: any) => p.name === correctionItem.product_name)
			const storage = storages.find((s: any) => s.name === correctionItem.storage_name)
			if (!product || !storage) throw new Error('Could not find product or storage')

			const res = await fetch('/api/transactions', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({
					product_id: product.id,
					storage_id: storage.id,
					transaction_type: correctionDiffBottles > 0 ? 'add' : 'remove',
					quantity: Math.abs(correctionDiffBottles),
					notes:
						correctionNotes +
						` (${correctionCurrentPacks}→${correctionTargetPacks}${correctionUsesPacks ? ' packs' : ' btl'})`
				})
			})
			if (!res.ok) {
				toast.error((await res.json().catch(() => ({})))?.message ?? 'Failed to update count')
				return
			}

			toast.success(`Updated ${correctionItem.product_name} @ ${correctionItem.storage_name}`)
			correctionDrawerOpen = false
			await invalidateAll()
		} catch (e: any) {
			toast.error(e.message)
		} finally {
			loading = false
		}
	}

	const corrItemPackSize = (itemProductName: string) =>
		products.find((p: any) => p.name === itemProductName)?.pack_size ?? 1

	const fmtPacksAdmin = (bottles: number, ps: number) => {
		if (ps <= 1) return null
		const packs = Math.floor(bottles / ps)
		const rem = bottles % ps
		return rem > 0 ? `${packs} packs +${rem}` : `${packs} packs`
	}
</script>

<!-- Storage drawer -->
<Drawer open={storageDrawerOpen} title={storageForm.id ? 'Edit location' : 'New location'} onclose={() => (storageDrawerOpen = false)}>
	<form class="space-y-4" onsubmit={e => { e.preventDefault(); saveStorage() }}>
		<div>
			<label for="loc-name" class="mb-1 block text-sm font-medium text-gray-700">Name *</label>
			<input
				id="loc-name"
				type="text"
				bind:value={storageForm.name}
				placeholder="Location name"
				class="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100 focus:outline-none"
			/>
		</div>
		<div>
			<p class="mb-1 block text-sm font-medium text-gray-700">Type *</p>
			<div class="grid grid-cols-2 gap-2">
				<button
					type="button"
					onclick={() => (storageForm.type = 'warehouse')}
					class="rounded-xl border-2 px-3 py-2.5 text-sm font-medium transition-colors {storageForm.type === 'warehouse'
						? 'border-blue-500 bg-blue-50 text-blue-700'
						: 'border-gray-200 text-gray-600 hover:border-gray-300'}"
				>
					Warehouse
				</button>
				<button
					type="button"
					onclick={() => (storageForm.type = 'home')}
					class="rounded-xl border-2 px-3 py-2.5 text-sm font-medium transition-colors {storageForm.type === 'home'
						? 'border-green-500 bg-green-50 text-green-700'
						: 'border-gray-200 text-gray-600 hover:border-gray-300'}"
				>
					Home
				</button>
			</div>
		</div>
		<div>
			<label for="loc-details" class="mb-1 block text-sm font-medium text-gray-700">Details</label>
			<textarea
				id="loc-details"
				bind:value={storageForm.location_details}
				rows="2"
				placeholder="Optional"
				class="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100 focus:outline-none"
			></textarea>
		</div>
		<label class="flex cursor-pointer items-center gap-2.5">
			<input type="checkbox" bind:checked={storageForm.active} class="h-4 w-4 rounded border-gray-300 text-blue-600" />
			<span class="text-sm text-gray-700">Active (uncheck to archive)</span>
		</label>
		<div class="flex gap-2 pt-2">
			<button
				type="button"
				onclick={() => (storageDrawerOpen = false)}
				class="flex-1 rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
			>
				Cancel
			</button>
			<button
				type="submit"
				disabled={loading}
				class="flex-1 rounded-xl bg-blue-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-600 disabled:opacity-50"
			>
				{loading ? 'Saving…' : storageForm.id ? 'Update' : 'Create'}
			</button>
		</div>
		{#if storageForm.id}
			<div class="border-t border-gray-100 pt-3">
				<button
					type="button"
					onclick={deleteStorage}
					disabled={loading}
					class="w-full rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-medium text-red-600 hover:bg-red-100 disabled:opacity-50"
				>
					Delete location permanently
				</button>
				<p class="mt-1.5 text-center text-xs text-gray-400">Only if no transaction history exists.</p>
			</div>
		{/if}
	</form>
</Drawer>

<!-- Stock count drawer -->
<Drawer open={correctionDrawerOpen} title="Set stock count" onclose={() => (correctionDrawerOpen = false)}>
	{#if correctionItem}
		<div class="space-y-5">
			<div class="rounded-xl bg-gray-50 p-4 ring-1 ring-gray-200">
				<p class="text-xs font-semibold uppercase tracking-wide text-gray-400">{correctionItem.storage_name}</p>
				<p class="mt-0.5 text-base font-semibold text-gray-900">{correctionItem.product_name}</p>
				<p class="mt-2 text-xs text-gray-500">Currently recorded:</p>
				<div class="mt-0.5 flex items-baseline gap-2">
					{#if correctionUsesPacks}
						<span class="text-3xl font-bold text-gray-900">{correctionCurrentPacks}</span>
						<span class="text-sm font-medium text-gray-500">packs</span>
						<span class="text-sm text-gray-400">({correctionItem.quantity} btl)</span>
					{:else}
						<span class="text-3xl font-bold text-gray-900">{correctionItem.quantity}</span>
						<span class="text-sm font-medium text-gray-500">bottles</span>
					{/if}
				</div>
			</div>

			<div>
				<label for="corr-qty" class="mb-1 block text-sm font-medium text-gray-700">I counted:</label>
				{#if correctionUsesPacks}
					<p class="mb-2 text-xs text-gray-400">Packages you physically have</p>
				{/if}
				<div class="flex items-center gap-2">
					<button
						type="button"
						class="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-gray-200 bg-gray-50 text-gray-600 hover:bg-gray-100 active:scale-95"
						onclick={() => (correctionTargetPacks = Math.max(0, correctionTargetPacks - 1))}
						aria-label="Decrease"
					>
						<svg class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path d="M3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" /></svg>
					</button>
					<input
						id="corr-qty"
						type="number"
						bind:value={correctionTargetPacks}
						min="0"
						class="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-center text-2xl font-bold focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100 focus:outline-none"
					/>
					<button
						type="button"
						class="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-gray-200 bg-gray-50 text-gray-600 hover:bg-gray-100 active:scale-95"
						onclick={() => (correctionTargetPacks = correctionTargetPacks + 1)}
						aria-label="Increase"
					>
						<svg class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" /></svg>
					</button>
				</div>
				{#if correctionUsesPacks}
					<p class="mt-1.5 text-center text-xs text-gray-400">= {correctionTargetBottles} bottles</p>
				{/if}
			</div>

			{#if correctionDiffBottles !== 0}
				<div
					class="flex items-center gap-3 rounded-xl px-4 py-3 ring-1 {correctionDiffBottles > 0
						? 'bg-green-50 ring-green-200'
						: 'bg-red-50 ring-red-200'}"
				>
					<div>
						<p class="text-sm font-semibold {correctionDiffBottles > 0 ? 'text-green-800' : 'text-red-800'}">
							{correctionDiffBottles > 0 ? '+' : ''}{correctionDiffBottles} bottles
						</p>
					</div>
				</div>
			{/if}

			<div>
				<label for="corr-notes" class="mb-1.5 block text-sm font-medium text-gray-700">Notes</label>
				<textarea
					id="corr-notes"
					bind:value={correctionNotes}
					rows="2"
					class="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100 focus:outline-none"
				></textarea>
			</div>

			<div class="flex gap-2">
				<button
					type="button"
					onclick={() => (correctionDrawerOpen = false)}
					class="flex-1 rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
				>
					Cancel
				</button>
				<button
					type="button"
					onclick={applyCorrection}
					disabled={loading || correctionDiffBottles === 0}
					class="flex-1 rounded-xl bg-blue-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-600 disabled:opacity-50"
				>
					{loading ? 'Saving…' : 'Apply'}
				</button>
			</div>
		</div>
	{/if}
</Drawer>

<div class="mx-auto max-w-md pb-6 pt-3">
	<div class="mb-4 flex items-center gap-2">
		<a href="/" class="flex h-8 w-8 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100" aria-label="Back">
			<svg class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
				<path fill-rule="evenodd" d="M17 10a.75.75 0 01-.75.75H5.612l4.158 3.96a.75.75 0 11-1.04 1.08l-5.5-5.25a.75.75 0 010-1.08l5.5-5.25a.75.75 0 111.04 1.08L5.612 9.25H16.25A.75.75 0 0117 10z" clip-rule="evenodd" />
			</svg>
		</a>
		<div class="min-w-0 flex-1">
			<h1 class="text-base font-bold text-gray-900">Locations & stock</h1>
			<p class="text-xs text-gray-500">Edit places, then tap a line to correct counts.</p>
		</div>
		{#if dataLoading}
			<div class="h-4 w-4 animate-spin rounded-full border-2 border-blue-400 border-t-transparent"></div>
		{/if}
	</div>

	<button
		type="button"
		onclick={openNewStorage}
		class="mb-3 flex w-full items-center justify-center gap-2 rounded-xl bg-blue-500 py-3 text-sm font-semibold text-white hover:bg-blue-600 active:scale-[0.99]"
	>
		<svg class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" /></svg>
		Add location
	</button>

	<div class="space-y-3">
		{#each activeSortedStorages as storage}
			{@const items = rowsForStorage(storage.name)}
			{@const tot = totalForStorage(storage.name)}
			<div class="overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-gray-100">
				<div class="flex items-center gap-3 border-b border-gray-100 px-4 py-3">
					<div
						class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg {storage.type === 'warehouse'
							? 'bg-blue-50'
							: 'bg-green-50'}"
					>
						<svg
							class="h-4 w-4 {storage.type === 'warehouse' ? 'text-blue-500' : 'text-green-500'}"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
						>
							{#if storage.type === 'warehouse'}
								<path stroke-linecap="round" stroke-linejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
							{:else}
								<path stroke-linecap="round" stroke-linejoin="round" d="M3 10.5 12 4l9 6.5V20a1 1 0 01-1 1h-5v-6H9v6H4a1 1 0 01-1-1v-9.5Z" />
							{/if}
						</svg>
					</div>
					<div class="min-w-0 flex-1">
						<p class="truncate text-sm font-semibold text-gray-900">{storage.name}</p>
						<p class="text-[11px] text-gray-400 capitalize">
							{storage.type}
							{#if !storage.active}
								· archived
							{/if}
						</p>
					</div>
					<div class="shrink-0 text-right">
						<p class="text-base font-bold text-gray-900">{tot}</p>
						<p class="text-[10px] text-gray-400">btl</p>
					</div>
					<button
						type="button"
						onclick={() => openEditStorage(storage)}
						class="shrink-0 rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-blue-600"
						aria-label="Edit location"
					>
						<svg class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
							<path d="M5.433 13.917l1.262-3.155A4 4 0 017.58 9.42l6.92-6.918a2.121 2.121 0 013 3l-6.92 6.918c-.383.383-.84.685-1.343.886l-3.154 1.262a.5.5 0 01-.65-.65z" />
							<path d="M3.5 5.75c0-.69.56-1.25 1.25-1.25H10A.75.75 0 0010 3H4.75A2.75 2.75 0 002 5.75v9.5A2.75 2.75 0 004.75 18h9.5A2.75 2.75 0 0017 15.25V10a.75.75 0 00-1.5 0v5.25c0 .69-.56 1.25-1.25 1.25h-9.5c-.69 0-1.25-.56-1.25-1.25v-9.5z" />
						</svg>
					</button>
				</div>
				{#if items.length === 0}
					<p class="px-4 py-3 text-center text-xs text-gray-400">No stock rows yet — use Add / Transfer from the app.</p>
				{:else}
					{#each items as item, i}
						{@const ps = corrItemPackSize(item.product_name)}
						{@const packs = fmtPacksAdmin(item.quantity, ps)}
						<button
							type="button"
							class="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-gray-50 {i < items.length - 1
								? 'border-b border-gray-50'
								: ''}"
							onclick={() => openCorrection(item)}
						>
							<div class="min-w-0 flex-1">
								<p class="text-sm font-semibold text-gray-900">{item.product_name}</p>
								<p class="text-xs text-gray-400">{item.sku}</p>
							</div>
							<div class="flex shrink-0 items-center gap-2 text-right">
								{#if packs}
									<div>
										<p class="text-base font-bold text-gray-900">{packs}</p>
										<p class="text-[10px] text-gray-400">{item.quantity} btl</p>
									</div>
								{:else}
									<p class="text-base font-bold text-gray-900">{item.quantity}</p>
								{/if}
								<svg class="h-4 w-4 text-gray-300" viewBox="0 0 20 20" fill="currentColor">
									<path fill-rule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clip-rule="evenodd" />
								</svg>
							</div>
						</button>
					{/each}
				{/if}
			</div>
		{/each}
	</div>

	{#if archivedSortedStorages.length > 0}
		<details class="mt-4 rounded-xl bg-gray-100/80 px-3 py-2 ring-1 ring-gray-200">
			<summary class="cursor-pointer text-xs font-semibold text-gray-600">
				Archived locations ({archivedSortedStorages.length})
			</summary>
			<p class="mt-2 text-[11px] leading-relaxed text-gray-500">
				Archived places stay in the database but disappear from the home dashboard. Reactivate to see stock lines here, or delete permanently if allowed.
			</p>
			<div class="mt-3 space-y-2 pb-1">
				{#each archivedSortedStorages as storage}
					<div class="flex items-center gap-3 rounded-lg bg-white px-3 py-2.5 shadow-sm ring-1 ring-gray-200">
						<div class="min-w-0 flex-1">
							<p class="truncate text-sm font-semibold text-gray-900">{storage.name}</p>
							<p class="text-[11px] text-gray-400 capitalize">{storage.type}</p>
						</div>
						<button
							type="button"
							onclick={() => openEditStorage(storage)}
							class="shrink-0 rounded-lg px-2 py-1.5 text-xs font-medium text-blue-600 hover:bg-blue-50"
						>
							Edit / delete
						</button>
					</div>
				{/each}
			</div>
		</details>
	{/if}

	{#if storages.length === 0 && !dataLoading}
		<p class="mt-4 text-center text-sm text-gray-500">No locations yet. Add one above.</p>
	{:else if activeSortedStorages.length === 0 && archivedSortedStorages.length > 0 && !dataLoading}
		<p class="mt-4 text-center text-sm text-gray-500">All locations are archived. Open “Archived locations” below to restore or delete.</p>
	{/if}
</div>
