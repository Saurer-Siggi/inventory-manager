<script lang="ts">
	import { get } from 'svelte/store'
	import { onMount } from 'svelte'
	import { afterNavigate } from '$app/navigation'
	import { page } from '$app/stores'
	import { products, storages, operationsLoading, operationsError, loadOperationsData, getStockForSelection, refreshInventory } from '$lib/stores.js'
	import { toast } from '$lib/components/toast.js'
	import type { Product, Storage } from '$lib/database.types.js'

	let selectedProduct = $state('')
	let selectedStorage = $state('')
	let quantity = $state(1)
	let notes = $state('')
	let loading = $state(false)

	const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

	function resolveProductId(param: string, plist: Product[]): string | null {
		const p = param.trim()
		if (!p) return null
		if (uuidRe.test(p)) {
			return plist.some(x => x.id === p) ? p : null
		}
		const bySku = plist.find(x => x.sku.toLowerCase() === p.toLowerCase())
		return bySku?.id ?? null
	}

	function resolveStorageSelection(
		param: string,
		slist: Storage[]
	): { id: string } | { error: string } {
		const raw = param.trim()
		if (!raw) return { error: 'Empty storage parameter' }
		const decoded = decodeURIComponent(raw)
		if (uuidRe.test(decoded)) {
			return slist.some(s => s.id === decoded) ? { id: decoded } : { error: `Unknown storage id` }
		}
		const lower = decoded.toLowerCase()
		const exact = slist.find(s => s.name.toLowerCase() === lower)
		if (exact) return { id: exact.id }
		const subs = slist.filter(s => s.name.toLowerCase().includes(lower))
		if (subs.length === 1) return { id: subs[0].id }
		if (subs.length > 1) {
			return {
				error: `"${decoded}" matches several locations — use a longer hint or the full name`
			}
		}
		return { error: `Unknown storage: ${decoded} (use id, full name, or a unique substring)` }
	}

	/** Apple Shortcuts / bookmarks: /remove?product=SSL-001&storage=9073&quantity=10 — then one tap to submit */
	function applyRemoveDeepLink() {
		const params = get(page).url.searchParams
		const productParam = params.get('product')?.trim() ?? ''
		const storageParam = params.get('storage')?.trim() ?? ''
		const quantityParam = params.get('quantity')
		const notesParam = params.get('notes')?.trim() ?? ''

		if (!productParam && !storageParam && quantityParam == null && !notesParam) return

		const plist = get(products)
		const slist = get(storages)
		if (!plist.length || !slist.length) return

		let selectionFromLink = false
		if (productParam) {
			const id = resolveProductId(productParam, plist)
			if (id) {
				selectedProduct = id
				selectionFromLink = true
			} else {
				toast.error(`Unknown product: ${productParam} (use SKU or id)`)
			}
		}
		if (storageParam) {
			const res = resolveStorageSelection(storageParam, slist)
			if ('id' in res) {
				selectedStorage = res.id
				selectionFromLink = true
			} else {
				toast.error(res.error)
			}
		}
		if (quantityParam != null && quantityParam !== '') {
			const n = Number.parseInt(quantityParam, 10)
			if (Number.isFinite(n) && n >= 1) {
				quantity = n
			} else {
				toast.error('Invalid quantity in URL')
			}
		}
		if (notesParam) {
			notes = notesParam
		}
		if (selectionFromLink) {
			toast.success('Prefilled from link — review and tap Remove')
		}
	}

	onMount(async () => {
		await loadOperationsData()
		applyRemoveDeepLink()
	})

	afterNavigate(({ to }) => {
		if (to?.url.pathname === '/remove') {
			void loadOperationsData().then(applyRemoveDeepLink)
		}
	})

	const ps = $derived($products.find(p => p.id === selectedProduct)?.pack_size ?? 1)
	const usesPacks = $derived(ps > 1)
	const quantityBottles = $derived(quantity * ps)
	const currentStock = $derived($getStockForSelection(selectedProduct, selectedStorage))
	const currentPacks = $derived(currentStock !== null && usesPacks ? Math.floor(currentStock / ps) : null)
	const newStock = $derived(currentStock !== null ? currentStock - quantityBottles : null)
	const newPacks = $derived(newStock !== null && usesPacks ? Math.floor(newStock / ps) : null)
	const wouldGoNegative = $derived(newStock !== null && newStock < 0)
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
					transaction_type: 'remove',
					quantity: quantityBottles,
					notes: notes || null
				})
			})

			if (!res.ok) {
				toast.error((await res.json().catch(() => ({})))?.message ?? 'Failed to remove stock')
			} else {
				const label = usesPacks ? `${quantity} packs (${quantityBottles} btl)` : `${quantityBottles} btl`
				toast.success(`Removed ${label} of ${selectedProductName} from ${selectedStorageName}`)
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
			<span class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-red-100">
				<svg class="h-5 w-5 text-red-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<circle cx="12" cy="12" r="9" />
					<path stroke-linecap="round" d="M9 12h6" />
				</svg>
			</span>
			<div>
				<h1 class="text-lg font-bold text-gray-900">Remove stock</h1>
				<p class="text-xs text-gray-500">Deliveries & usage</p>
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
						class="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm focus:border-red-400 focus:bg-white focus:ring-2 focus:ring-red-200 focus:outline-none"
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
						class="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm focus:border-red-400 focus:bg-white focus:ring-2 focus:ring-red-200 focus:outline-none"
					>
						<option value="">Select location</option>
						{#each $storages as storage}
							<option value={storage.id}>{storage.name}</option>
						{/each}
					</select>
				</div>

				<!-- Current stock context -->
				{#if selectedProduct && selectedStorage && currentStock !== null}
					<div class="flex items-center gap-2 rounded-lg px-3 py-2 ring-1 {wouldGoNegative ? 'bg-amber-50 ring-amber-300' : 'bg-gray-50 ring-gray-200'}">
						<svg class="h-3.5 w-3.5 shrink-0 {wouldGoNegative ? 'text-amber-600' : 'text-gray-500'}" viewBox="0 0 20 20" fill="currentColor">
							<path fill-rule="evenodd" d="M10 2a8 8 0 100 16A8 8 0 0010 2zm0 3a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5A.75.75 0 0110 5zm0 7a1 1 0 100 2 1 1 0 000-2z" clip-rule="evenodd" />
						</svg>
						<div class="text-xs {wouldGoNegative ? 'text-amber-800' : 'text-gray-700'}">
							{#if wouldGoNegative}
								<span class="font-semibold">Warning — would go below zero.</span>{' '}
							{/if}
							{#if usesPacks}
								Currently <span class="font-bold">{currentPacks} packs</span>
								<span class="opacity-60">({currentStock} btl)</span>
								→ <span class="font-bold {wouldGoNegative ? 'text-red-600' : ''}">{(newPacks ?? 0)} packs</span>
								<span class="opacity-60">({newStock} btl)</span>
							{:else}
								Currently <span class="font-bold">{currentStock}</span> btl
								→ <span class="font-bold {wouldGoNegative ? 'text-red-600' : ''}">{newStock}</span> btl
							{/if}
						</div>
					</div>
				{/if}

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
							class="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-center text-base font-bold focus:border-red-400 focus:bg-white focus:ring-2 focus:ring-red-200 focus:outline-none"
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
						class="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm focus:border-red-400 focus:bg-white focus:ring-2 focus:ring-red-200 focus:outline-none"
						placeholder="Customer, venue, event…"
					></textarea>
				</div>

				<button
					type="submit"
					disabled={loading}
					class="w-full rounded-xl bg-red-500 px-4 py-3 text-sm font-semibold text-white shadow-sm transition-all hover:bg-red-600 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
				>
					{#if loading}
						Removing…
					{:else if usesPacks && selectedProduct}
						Remove {quantity} pack{quantity !== 1 ? 's' : ''} ({quantityBottles} btl)
					{:else}
						Remove stock
					{/if}
				</button>
			</form>
		</div>
	</main>
</div>
