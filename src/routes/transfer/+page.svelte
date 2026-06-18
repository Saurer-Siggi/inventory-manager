<script lang="ts">
	import { onMount } from 'svelte'
	import { products, storages, operationsLoading, operationsError, loadOperationsData, getStockForSelection, refreshInventory } from '$lib/stores.js'
	import { toast } from '$lib/components/toast.js'

	let selectedProduct = $state('')
	let selectedFromStorage = $state('')
	let selectedToStorage = $state('')
	let quantity = $state(1)
	let notes = $state('')
	let loading = $state(false)

	onMount(loadOperationsData)

	const ps = $derived($products.find(p => p.id === selectedProduct)?.pack_size ?? 1)
	const usesPacks = $derived(ps > 1)
	const quantityBottles = $derived(quantity * ps)
	const fromStock = $derived($getStockForSelection(selectedProduct, selectedFromStorage))
	const toStock = $derived($getStockForSelection(selectedProduct, selectedToStorage))
	const fromPacks = $derived(fromStock !== null && usesPacks ? Math.floor(fromStock / ps) : null)
	const toPacks = $derived(toStock !== null && usesPacks ? Math.floor(toStock / ps) : null)
	const wouldGoNegative = $derived(fromStock !== null && quantityBottles > fromStock)
	const selectedProductName = $derived($products.find(p => p.id === selectedProduct)?.name ?? '')
	const fromStorageName = $derived($storages.find(s => s.id === selectedFromStorage)?.name ?? '')
	const toStorageName = $derived($storages.find(s => s.id === selectedToStorage)?.name ?? '')

	const handleSubmit = async (e: SubmitEvent) => {
		e.preventDefault()
		if (!selectedProduct || !selectedFromStorage || !selectedToStorage || quantity <= 0) {
			toast.error('Please fill in all required fields')
			return
		}
		if (selectedFromStorage === selectedToStorage) {
			toast.error('Source and destination must be different')
			return
		}

		loading = true
		try {
			const res = await fetch('/api/transactions', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({
					product_id: selectedProduct,
					storage_id: selectedFromStorage,
					transaction_type: 'transfer',
					quantity: quantityBottles,
					from_storage_id: selectedFromStorage,
					to_storage_id: selectedToStorage,
					notes: notes || null
				})
			})

			if (!res.ok) {
				toast.error((await res.json().catch(() => ({})))?.message ?? 'Failed to transfer stock')
			} else {
				const label = usesPacks ? `${quantity} packs (${quantityBottles} btl)` : `${quantityBottles} btl`
				toast.success(`Moved ${label} of ${selectedProductName}: ${fromStorageName} → ${toStorageName}`)
				selectedProduct = ''
				selectedFromStorage = ''
				selectedToStorage = ''
				quantity = 1
				notes = ''
				await refreshInventory()
			}
		} catch (e) {
			toast.error(e instanceof Error ? e.message : String(e))
		} finally {
			loading = false
		}
	}
</script>

<div class="mx-auto max-w-md pb-4 pt-3">
	<header class="mb-5">
		<div class="flex items-center gap-2.5">
			<span class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-100">
				<svg class="h-5 w-5 text-blue-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<path stroke-linecap="round" stroke-linejoin="round" d="M7.5 21 3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5M16.5 3 21 7.5m0 0L16.5 12" />
				</svg>
			</span>
			<div>
				<h1 class="text-lg font-bold text-gray-900">Transfer</h1>
				<p class="text-xs text-gray-500">Move between locations</p>
			</div>
		</div>
	</header>

	<main class="min-w-0">
		{#if $operationsLoading}
			<div class="mb-3 flex items-center gap-2 rounded-xl border border-blue-100 bg-blue-50 px-3 py-2.5">
				<div class="h-3 w-3 animate-spin rounded-full border-2 border-blue-400 border-t-transparent"></div>
				<p class="text-xs text-blue-700">Loading…</p>
			</div>
		{/if}
		{#if $operationsError}
			<div class="mb-3 rounded-xl border border-red-200 bg-red-50 p-3">
				<p class="text-xs text-red-700">{$operationsError}</p>
			</div>
		{/if}

		<div class="rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-100">
			<form onsubmit={handleSubmit} class="space-y-4">
				<div>
					<label for="product" class="mb-1.5 block text-sm font-medium text-gray-700">Product</label>
					<select
						id="product"
						bind:value={selectedProduct}
						required
						class="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-200 focus:outline-none"
					>
						<option value="">Select a product</option>
						{#each $products as product}
							<option value={product.id}>{product.name} ({product.sku})</option>
						{/each}
					</select>
				</div>

				<!-- From → To block -->
				<div>
					<p class="mb-1.5 text-sm font-medium text-gray-700">From → To</p>
					<div class="overflow-hidden rounded-xl border border-gray-200 bg-gray-50">
						<div class="px-3 pt-3 pb-2">
							<p class="mb-1 text-[11px] font-semibold uppercase tracking-wide text-gray-400">From</p>
							<select
								id="from_storage"
								bind:value={selectedFromStorage}
								required
								class="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm focus:border-blue-400 focus:ring-2 focus:ring-blue-200 focus:outline-none"
							>
								<option value="">Source location</option>
								{#each $storages as storage}
									<option value={storage.id} disabled={storage.id === selectedToStorage}>{storage.name}</option>
								{/each}
							</select>
							{#if selectedProduct && selectedFromStorage && fromStock !== null}
								<p class="mt-1.5 text-xs text-gray-500">
									{#if usesPacks}
										<span class="font-semibold {wouldGoNegative ? 'text-red-600' : ''}">{fromPacks} packs</span>
										<span class="text-gray-400">({fromStock} btl)</span>
										→ <span class="font-semibold {(fromPacks! - quantity) < 0 ? 'text-red-600' : ''}">{fromPacks! - quantity} packs</span>
									{:else}
										<span class="font-semibold {wouldGoNegative ? 'text-red-600' : ''}">{fromStock}</span> btl
										→ <span class="font-semibold {(fromStock - quantityBottles) < 0 ? 'text-red-600' : ''}">{fromStock - quantityBottles}</span> btl
									{/if}
								</p>
							{/if}
						</div>

						<div class="flex items-center gap-2 px-3 py-1">
							<div class="h-px flex-1 bg-gray-200"></div>
							<svg class="h-4 w-4 shrink-0 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
								<path fill-rule="evenodd" d="M10 3a.75.75 0 01.75.75v10.638l3.96-4.158a.75.75 0 111.08 1.04l-5.25 5.5a.75.75 0 01-1.08 0l-5.25-5.5a.75.75 0 111.08-1.04l3.96 4.158V3.75A.75.75 0 0110 3z" clip-rule="evenodd" />
							</svg>
							<div class="h-px flex-1 bg-gray-200"></div>
						</div>

						<div class="px-3 pb-3 pt-1">
							<p class="mb-1 text-[11px] font-semibold uppercase tracking-wide text-gray-400">To</p>
							<select
								id="to_storage"
								bind:value={selectedToStorage}
								required
								class="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm focus:border-blue-400 focus:ring-2 focus:ring-blue-200 focus:outline-none"
							>
								<option value="">Destination location</option>
								{#each $storages as storage}
									<option value={storage.id} disabled={storage.id === selectedFromStorage}>{storage.name}</option>
								{/each}
							</select>
							{#if selectedProduct && selectedToStorage && toStock !== null}
								<p class="mt-1.5 text-xs text-gray-500">
									{#if usesPacks}
										<span class="font-semibold">{toPacks} packs</span>
										<span class="text-gray-400">({toStock} btl)</span>
										→ <span class="font-semibold">{toPacks! + quantity} packs</span>
									{:else}
										<span class="font-semibold">{toStock}</span> btl
										→ <span class="font-semibold">{toStock + quantityBottles}</span> btl
									{/if}
								</p>
							{/if}
						</div>
					</div>
					{#if wouldGoNegative}
						<p class="mt-1.5 text-xs font-medium text-amber-700">
							Warning: source would go below zero.
						</p>
					{/if}
				</div>

				<div>
					<div class="mb-1.5 flex items-baseline gap-2">
						<label for="quantity" class="text-sm font-medium text-gray-700">
							{usesPacks ? 'Packages' : 'Quantity'}
						</label>
						{#if usesPacks && selectedProduct}
							<span class="text-xs text-gray-400">pack of {ps} btl each</span>
						{/if}
					</div>
					<div class="flex items-center gap-2">
						<button
							type="button"
							class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-gray-200 bg-gray-50 text-gray-600 hover:bg-gray-100 active:scale-95"
							onclick={() => (quantity = Math.max(1, quantity - 1))}
							aria-label="Decrease"
						>
							<svg class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path d="M3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z"/></svg>
						</button>
						<input
							type="number"
							id="quantity"
							bind:value={quantity}
							min="1"
							required
							class="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-center text-base font-bold focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-200 focus:outline-none"
						/>
						<button
							type="button"
							class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-gray-200 bg-gray-50 text-gray-600 hover:bg-gray-100 active:scale-95"
							onclick={() => (quantity = quantity + 1)}
							aria-label="Increase"
						>
							<svg class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z"/></svg>
						</button>
					</div>
					{#if usesPacks && selectedProduct}
						<p class="mt-1.5 text-center text-xs text-gray-400">= {quantityBottles} bottles total</p>
					{/if}
				</div>

				<div>
					<label for="notes" class="mb-1.5 block text-sm font-medium text-gray-700">
						Notes <span class="font-normal text-gray-400">(optional)</span>
					</label>
					<textarea
						id="notes"
						bind:value={notes}
						rows="2"
						class="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-200 focus:outline-none"
						placeholder="Reason for transfer…"
					></textarea>
				</div>

				<button
					type="submit"
					disabled={loading}
					class="w-full rounded-xl bg-blue-500 px-4 py-3 text-sm font-semibold text-white shadow-sm transition-all hover:bg-blue-600 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
				>
					{#if loading}
						Transferring…
					{:else if usesPacks && selectedProduct}
						Move {quantity} pack{quantity !== 1 ? 's' : ''} ({quantityBottles} btl)
					{:else}
						Transfer stock
					{/if}
				</button>
			</form>
		</div>
	</main>
</div>
