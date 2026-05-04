<script lang="ts">
	import { supabase } from '$lib/supabaseClient.js'
	import { user } from '$lib/auth.js'
	import { onMount } from 'svelte'
	import { toast } from '$lib/components/toast.js'
	import Drawer from '$lib/components/Drawer.svelte'

	let { data } = $props()

	let loading = $state(false)
	let products = $state<any[]>([])
	let dataLoading = $state(false)

	$effect.pre(() => {
		products = [...(data.products ?? [])]
	})

	onMount(async () => {
		try {
			dataLoading = true
			if (!data.products || data.products.length === 0) {
				const { data: d } = await supabase.from('products').select('*').order('sku')
				if (d) products = d
			}
		} catch (err) {
			toast.error('Failed to load: ' + String(err))
		} finally {
			dataLoading = false
		}
	})

	let productDrawerOpen = $state(false)
	let productForm = $state({
		id: null as string | null,
		sku: '',
		name: '',
		description: '',
		unit_size: '',
		pack_size: 1,
		active: true
	})

	const openNewProduct = () => {
		productForm = { id: null, sku: '', name: '', description: '', unit_size: '', pack_size: 1, active: true }
		productDrawerOpen = true
	}

	const openEditProduct = (product: any) => {
		productForm = {
			id: product.id,
			sku: product.sku,
			name: product.name,
			description: product.description ?? '',
			unit_size: product.unit_size,
			pack_size: product.pack_size,
			active: product.active
		}
		productDrawerOpen = true
	}

	const saveProduct = async () => {
		if (!productForm.sku || !productForm.name || !productForm.unit_size) {
			toast.error('SKU, name, and unit size are required')
			return
		}
		loading = true
		try {
			const payload = {
				sku: productForm.sku,
				name: productForm.name,
				description: productForm.description,
				unit_size: productForm.unit_size,
				pack_size: productForm.pack_size,
				active: productForm.active
			}
			if (productForm.id) {
				const { error } = await supabase.from('products').update(payload).eq('id', productForm.id)
				if (error) throw error
				toast.success('Product updated')
			} else {
				const { error } = await supabase.from('products').insert(payload)
				if (error) throw error
				toast.success('Product created')
			}
			productDrawerOpen = false
			const { data: d } = await supabase.from('products').select('*').order('sku')
			if (d) products = d
		} catch (e: any) {
			toast.error(e.message)
		} finally {
			loading = false
		}
	}

	const toggleProductActive = async (product: any) => {
		const { error } = await supabase.from('products').update({ active: !product.active }).eq('id', product.id)
		if (error) {
			toast.error(error.message)
			return
		}
		products = products.map(p => (p.id === product.id ? { ...p, active: !p.active } : p))
		toast.success(product.active ? 'Product deactivated' : 'Product activated')
	}

	const deleteProduct = async () => {
		if (!productForm.id) return
		if (!confirm(`Permanently delete "${productForm.name}"? This cannot be undone.`)) return
		loading = true
		try {
			const { error } = await supabase.from('products').delete().eq('id', productForm.id)
			if (error) {
				if (error.code === '23503') {
					toast.error('Cannot delete — this product has history. Deactivate it instead.')
				} else throw error
			} else {
				toast.success(`Deleted "${productForm.name}"`)
				productDrawerOpen = false
				const { data: d } = await supabase.from('products').select('*').order('sku')
				if (d) products = d
			}
		} catch (e: any) {
			toast.error(e.message)
		} finally {
			loading = false
		}
	}
</script>

<Drawer open={productDrawerOpen} title={productForm.id ? 'Edit Product' : 'New Product'} onclose={() => (productDrawerOpen = false)}>
	<form class="space-y-4" onsubmit={e => { e.preventDefault(); saveProduct() }}>
		<div>
			<label for="p-sku" class="mb-1 block text-sm font-medium text-gray-700">SKU *</label>
			<input
				id="p-sku"
				type="text"
				bind:value={productForm.sku}
				placeholder="e.g. SSL-001"
				class="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100 focus:outline-none"
			/>
		</div>
		<div>
			<label for="p-name" class="mb-1 block text-sm font-medium text-gray-700">Name *</label>
			<input
				id="p-name"
				type="text"
				bind:value={productForm.name}
				placeholder="Product name"
				class="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100 focus:outline-none"
			/>
		</div>
		<div>
			<label for="p-desc" class="mb-1 block text-sm font-medium text-gray-700">Description</label>
			<textarea
				id="p-desc"
				bind:value={productForm.description}
				rows="2"
				class="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100 focus:outline-none"
			></textarea>
		</div>
		<div class="grid grid-cols-2 gap-3">
			<div>
				<label for="p-unit" class="mb-1 block text-sm font-medium text-gray-700">Unit size *</label>
				<input
					id="p-unit"
					type="text"
					bind:value={productForm.unit_size}
					placeholder="e.g. 500ml"
					class="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100 focus:outline-none"
				/>
			</div>
			<div>
				<label for="p-pack" class="mb-1 block text-sm font-medium text-gray-700">Pack size</label>
				<input
					id="p-pack"
					type="number"
					bind:value={productForm.pack_size}
					min="1"
					class="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100 focus:outline-none"
				/>
			</div>
		</div>
		<label class="flex cursor-pointer items-center gap-2.5">
			<input type="checkbox" bind:checked={productForm.active} class="h-4 w-4 rounded border-gray-300 text-blue-600" />
			<span class="text-sm text-gray-700">Active</span>
		</label>
		<div class="flex gap-2 pt-2">
			<button
				type="button"
				onclick={() => (productDrawerOpen = false)}
				class="flex-1 rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
			>
				Cancel
			</button>
			<button
				type="submit"
				disabled={loading}
				class="flex-1 rounded-xl bg-blue-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-600 disabled:opacity-50"
			>
				{loading ? 'Saving…' : productForm.id ? 'Update' : 'Create'}
			</button>
		</div>
		{#if productForm.id}
			<div class="border-t border-gray-100 pt-3">
				<button
					type="button"
					onclick={deleteProduct}
					disabled={loading}
					class="w-full rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-medium text-red-600 hover:bg-red-100 disabled:opacity-50"
				>
					Delete product permanently
				</button>
				<p class="mt-1.5 text-center text-xs text-gray-400">Only works if no transaction history exists.</p>
			</div>
		{/if}
	</form>
</Drawer>

<div class="mx-auto min-h-dvh max-w-2xl bg-gray-50 pb-8">
	<header
		class="sticky top-0 z-10 border-b border-gray-200 bg-white px-4 py-2.5 shadow-sm"
		style="padding-top: max(0.625rem, env(safe-area-inset-top, 0px)); padding-left: max(1rem, env(safe-area-inset-left, 0px)); padding-right: max(1rem, env(safe-area-inset-right, 0px));"
	>
		<div class="flex items-center gap-3">
			<a href="/" class="flex h-8 w-8 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100 hover:text-gray-700" aria-label="Back">
				<svg class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
					<path fill-rule="evenodd" d="M17 10a.75.75 0 01-.75.75H5.612l4.158 3.96a.75.75 0 11-1.04 1.08l-5.5-5.25a.75.75 0 010-1.08l5.5-5.25a.75.75 0 111.04 1.08L5.612 9.25H16.25A.75.75 0 0117 10z" clip-rule="evenodd" />
				</svg>
			</a>
			<div class="min-w-0 flex-1">
				<h1 class="text-base font-bold text-gray-900">Products</h1>
				<p class="truncate text-xs text-gray-400">Catalog · {$user?.email ?? ''}</p>
			</div>
			{#if dataLoading}
				<div class="h-4 w-4 animate-spin rounded-full border-2 border-blue-400 border-t-transparent"></div>
			{/if}
		</div>
	</header>

	<main class="px-4 py-4">
		{#if data.error}
			<div class="mb-4 rounded-xl border border-red-200 bg-red-50 p-4">
				<h2 class="mb-1 text-sm font-semibold text-red-900">Data error</h2>
				<p class="text-xs text-red-700">{data.error}</p>
			</div>
		{/if}

		<div class="mb-3 flex items-center justify-between">
			<h2 class="text-sm font-semibold text-gray-500 uppercase tracking-wide">Catalog</h2>
			<button
				type="button"
				onclick={openNewProduct}
				class="flex items-center gap-1.5 rounded-xl bg-blue-500 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-600 active:scale-95"
			>
				<svg class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" /></svg>
				Add product
			</button>
		</div>

		{#if products.length === 0}
			<div class="rounded-xl bg-white py-12 text-center shadow-sm ring-1 ring-gray-100">
				<p class="text-sm text-gray-500">No products yet</p>
				<button type="button" onclick={openNewProduct} class="mt-2 text-sm font-medium text-blue-600 hover:underline">
					Create your first product
				</button>
			</div>
		{:else}
			<div class="overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-gray-100">
				{#each products as product, i}
					<div class="flex items-center gap-3 px-4 py-3.5 {i < products.length - 1 ? 'border-b border-gray-100' : ''}">
						<div class="min-w-0 flex-1">
							<div class="flex items-center gap-2">
								<p class="truncate text-sm font-semibold text-gray-900">{product.name}</p>
								<span
									class="shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold {product.active
										? 'bg-green-100 text-green-700'
										: 'bg-gray-100 text-gray-500'}"
								>
									{product.active ? 'Active' : 'Inactive'}
								</span>
							</div>
							<p class="mt-0.5 text-xs text-gray-400">{product.sku} · {product.unit_size} · Pack of {product.pack_size}</p>
							{#if product.description}
								<p class="mt-0.5 truncate text-xs text-gray-400">{product.description}</p>
							{/if}
						</div>
						<div class="flex shrink-0 items-center gap-1">
							<button
								type="button"
								onclick={() => toggleProductActive(product)}
								class="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
								title={product.active ? 'Deactivate' : 'Activate'}
							>
								<svg class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
									{#if product.active}
										<path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clip-rule="evenodd" />
									{:else}
										<path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clip-rule="evenodd" />
									{/if}
								</svg>
							</button>
							<button
								type="button"
								onclick={() => openEditProduct(product)}
								class="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-blue-600"
								title="Edit"
							>
								<svg class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
									<path d="M5.433 13.917l1.262-3.155A4 4 0 017.58 9.42l6.92-6.918a2.121 2.121 0 013 3l-6.92 6.918c-.383.383-.84.685-1.343.886l-3.154 1.262a.5.5 0 01-.65-.65z" />
									<path d="M3.5 5.75c0-.69.56-1.25 1.25-1.25H10A.75.75 0 0010 3H4.75A2.75 2.75 0 002 5.75v9.5A2.75 2.75 0 004.75 18h9.5A2.75 2.75 0 0017 15.25V10a.75.75 0 00-1.5 0v5.25c0 .69-.56 1.25-1.25 1.25h-9.5c-.69 0-1.25-.56-1.25-1.25v-9.5z" />
								</svg>
							</button>
						</div>
					</div>
				{/each}
			</div>
		{/if}

		<p class="mt-6 text-center text-[11px] text-gray-400">
			Locations & stock: header warehouse icon. History & alerts: bottom tabs. Add / remove / move: Home.
		</p>
	</main>
</div>
