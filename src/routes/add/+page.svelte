<script lang="ts">
	import { onMount } from 'svelte'
	import { products, storages, operationsLoading, operationsError, loadOperationsData, getStockForSelection, refreshInventory } from '$lib/stores.js'
	import { toast } from '$lib/components/toast.js'

	let selectedProduct = $state('')
	let selectedStorage = $state('')
	let quantity = $state(1)
	let notes = $state('')
	let loading = $state(false)

	onMount(loadOperationsData)

	const ps = $derived($products.find(p => p.id === selectedProduct)?.pack_size ?? 1)
	const usesPacks = $derived(ps > 1)
	const quantityBottles = $derived(quantity * ps)
	const currentStock = $derived($getStockForSelection(selectedProduct, selectedStorage))
	const currentPacks = $derived(currentStock !== null && usesPacks ? Math.floor(currentStock / ps) : null)
	const selectedProductName = $derived($products.find(p => p.id === selectedProduct)?.name ?? '')
	const selectedStorageName = $derived($storages.find(s => s.id === selectedStorage)?.name ?? '')

	const handleSubmit = async (e: SubmitEvent) => {
		e.preventDefault()
		if (!selectedProduct || !selectedStorage || quantity <= 0) {
			toast.error('Please fill in all required fields')
			return
		}

		loading = true
		try {
			const res = await fetch('/api/transactions', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({
					product_id: selectedProduct,
					storage_id: selectedStorage,
					transaction_type: 'add',
					quantity: quantityBottles,
					notes: notes || null
				})
			})

			if (!res.ok) {
				toast.error((await res.json().catch(() => ({})))?.message ?? 'Failed to add stock')
			} else {
				const label = usesPacks ? `${quantity} packs (${quantityBottles} btl)` : `${quantityBottles} btl`
				toast.success(`Added ${label} of ${selectedProductName} to ${selectedStorageName}`)
				selectedProduct = ''
				selectedStorage = ''
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
			<span class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-green-100">
				<svg class="h-5 w-5 text-green-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<circle cx="12" cy="12" r="9" />
					<path stroke-linecap="round" d="M12 9v6M9 12h6" />
				</svg>
			</span>
			<div>
				<h1 class="text-lg font-bold text-gray-900">Add stock</h1>
				<p class="text-xs text-gray-500">New deliveries & restocking</p>
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
						class="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm focus:border-green-400 focus:bg-white focus:ring-2 focus:ring-green-200 focus:outline-none"
					>
						<option value="">Select a product</option>
						{#each $products as product}
							<option value={product.id}>{product.name} ({product.sku})</option>
						{/each}
					</select>
				</div>

				<div>
					<label for="storage" class="mb-1.5 block text-sm font-medium text-gray-700">Storage location</label>
					<select
						id="storage"
						bind:value={selectedStorage}
						required
						class="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm focus:border-green-400 focus:bg-white focus:ring-2 focus:ring-green-200 focus:outline-none"
					>
						<option value="">Select location</option>
						{#each $storages as storage}
							<option value={storage.id}>{storage.name}</option>
						{/each}
					</select>
				</div>

				<!-- Current stock context -->
				{#if selectedProduct && selectedStorage && currentStock !== null}
					<div class="flex items-center gap-2 rounded-lg bg-green-50 px-3 py-2 ring-1 ring-green-200">
						<svg class="h-3.5 w-3.5 shrink-0 text-green-600" viewBox="0 0 20 20" fill="currentColor">
							<path d="M10.75 10.818v2.614A3.13 3.13 0 0011.888 13c.482-.315.612-.648.612-.875 0-.227-.13-.56-.612-.875a3.13 3.13 0 00-1.138-.432zM8.33 8.62c.053.055.115.11.184.164.208.16.46.284.736.363V6.603a2.45 2.45 0 00-.35.13c-.14.065-.27.143-.386.233-.377.292-.514.627-.514.909 0 .184.058.39.33.576z" />
							<path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm.75-13a.75.75 0 00-1.5 0v.316a3.851 3.851 0 00-1.354.53 2.91 2.91 0 00-1.147 2.28c0 1.033.647 1.776 1.354 2.26a5.3 5.3 0 001.147.536v2.85a2.5 2.5 0 00.87-.324c.362-.22.63-.534.63-1.062V10.8a5.3 5.3 0 001.147-.536c.707-.484 1.354-1.227 1.354-2.26 0-.943-.46-1.72-1.147-2.28a3.851 3.851 0 00-1.354-.53V5z" clip-rule="evenodd" />
						</svg>
						<div class="text-xs text-green-800">
							{#if usesPacks}
								Currently <span class="font-bold">{currentPacks} packs</span>
								<span class="text-green-600">({currentStock} btl)</span>
								→ will become <span class="font-bold">{currentPacks! + quantity} packs</span>
								<span class="text-green-600">({currentStock + quantityBottles} btl)</span>
							{:else}
								Currently <span class="font-bold">{currentStock}</span> bottles
								→ will become <span class="font-bold">{currentStock + quantityBottles}</span>
							{/if}
						</div>
					</div>
				{/if}

				<div>
					<div class="mb-1.5 flex items-baseline gap-2">
						<label for="quantity" class="text-sm font-medium text-gray-700">
							{usesPacks ? `Packages` : 'Quantity'}
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
							class="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-center text-base font-bold focus:border-green-400 focus:bg-white focus:ring-2 focus:ring-green-200 focus:outline-none"
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
						class="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm focus:border-green-400 focus:bg-white focus:ring-2 focus:ring-green-200 focus:outline-none"
						placeholder="Delivery reference, batch…"
					></textarea>
				</div>

				<button
					type="submit"
					disabled={loading}
					class="w-full rounded-xl bg-green-500 px-4 py-3 text-sm font-semibold text-white shadow-sm transition-all hover:bg-green-600 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
				>
					{#if loading}
						Adding…
					{:else if usesPacks && selectedProduct}
						Add {quantity} pack{quantity !== 1 ? 's' : ''} ({quantityBottles} btl)
					{:else}
						Add stock
					{/if}
				</button>
			</form>
		</div>
	</main>
</div>
