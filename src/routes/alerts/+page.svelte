<script lang="ts">
	import { supabase } from '$lib/supabaseClient.js'
	import { page } from '$app/stores'
	import { onMount } from 'svelte'
	import { toast } from '$lib/components/toast.js'
	import Drawer from '$lib/components/Drawer.svelte'
	import type { InventoryReport, StockAlertWithJoins, TriggeredAlert } from '$lib/database.types.js'

	const isAdmin = $derived($page.data.isAdmin === true)

	let loading = $state(true)
	let products = $state<{ id: string; name: string; sku: string; active: boolean }[]>([])
	let storages = $state<{ id: string; name: string; active: boolean }[]>([])
	let inventoryData = $state<InventoryReport[]>([])
	let stockAlerts = $state<StockAlertWithJoins[]>([])
	let saveLoading = $state(false)

	const triggered = $derived.by(() => {
		if (!stockAlerts.length || !inventoryData.length) return [] as TriggeredAlert[]
		const out: TriggeredAlert[] = []
		stockAlerts.forEach(alert => {
			if (!alert.active) return
			const row = inventoryData.find(
				item => item.sku === alert.products.sku && item.storage_name === alert.storages.name
			)
			if (row && row.quantity <= alert.threshold) {
				out.push({
					...alert,
					current_quantity: row.quantity,
					product_name: alert.products.name,
					storage_name: alert.storages.name
				})
			}
		})
		return out
	})

	const loadAll = async () => {
		const [{ data: p }, { data: s }, { data: inv }, { data: al }] = await Promise.all([
			supabase.from('products').select('id, name, sku, active').order('sku'),
			supabase.from('storages').select('id, name, active').order('name'),
			supabase.from('inventory_report').select('*').order('product_name, storage_name'),
			supabase.from('stock_alerts').select(`*, products (name, sku), storages (name, type)`).order('created_at', { ascending: false })
		])
		if (p) products = p as typeof products
		if (s) storages = s as typeof storages
		if (inv) inventoryData = inv as InventoryReport[]
		if (al) stockAlerts = al as StockAlertWithJoins[]
	}

	onMount(async () => {
		try {
			await loadAll()
		} catch (e) {
			console.error(e)
			toast.error('Could not load alerts')
		} finally {
			loading = false
		}
	})

	let alertDrawerOpen = $state(false)
	let alertForm = $state({ id: null as string | null, product_id: '', storage_id: '', threshold: 5, active: true })

	const openNewAlert = () => {
		alertForm = { id: null, product_id: '', storage_id: '', threshold: 5, active: true }
		alertDrawerOpen = true
	}

	const openEditAlert = (alert: StockAlertWithJoins) => {
		alertForm = {
			id: alert.id,
			product_id: alert.product_id,
			storage_id: alert.storage_id,
			threshold: alert.threshold,
			active: alert.active
		}
		alertDrawerOpen = true
	}

	const saveAlert = async () => {
		if (!alertForm.product_id || !alertForm.storage_id || alertForm.threshold < 0) {
			toast.error('Product, location, and threshold are required')
			return
		}
		saveLoading = true
		try {
			const payload = {
				product_id: alertForm.product_id,
				storage_id: alertForm.storage_id,
				threshold: alertForm.threshold,
				active: alertForm.active
			}
			if (alertForm.id) {
				const { error } = await supabase.from('stock_alerts').update(payload).eq('id', alertForm.id)
				if (error) throw error
				toast.success('Alert updated')
			} else {
				const { error } = await supabase.from('stock_alerts').insert(payload)
				if (error) {
					if (error.code === '23505') {
						toast.error('An alert already exists for this product + location')
						return
					}
					throw error
				}
				toast.success('Alert created')
			}
			alertDrawerOpen = false
			await loadAll()
		} catch (e: any) {
			toast.error(e.message)
		} finally {
			saveLoading = false
		}
	}

	const deleteAlert = async (alertId: string) => {
		if (!confirm('Delete this alert?')) return
		saveLoading = true
		try {
			const { error } = await supabase.from('stock_alerts').delete().eq('id', alertId)
			if (error) throw error
			toast.success('Alert deleted')
			await loadAll()
		} catch (e: any) {
			toast.error(e.message)
		} finally {
			saveLoading = false
		}
	}
</script>

<Drawer open={alertDrawerOpen} title={alertForm.id ? 'Edit alert' : 'New alert'} onclose={() => (alertDrawerOpen = false)}>
	<form class="space-y-4" onsubmit={e => { e.preventDefault(); saveAlert() }}>
		<div>
			<label for="al-product" class="mb-1 block text-sm font-medium text-gray-700">Product *</label>
			<select
				id="al-product"
				bind:value={alertForm.product_id}
				class="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm focus:border-orange-400 focus:bg-white focus:ring-2 focus:ring-orange-100 focus:outline-none"
			>
				<option value="">Select</option>
				{#each products.filter(p => p.active) as product}
					<option value={product.id}>{product.name} ({product.sku})</option>
				{/each}
			</select>
		</div>
		<div>
			<label for="al-storage" class="mb-1 block text-sm font-medium text-gray-700">Location *</label>
			<select
				id="al-storage"
				bind:value={alertForm.storage_id}
				class="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm focus:border-orange-400 focus:bg-white focus:ring-2 focus:ring-orange-100 focus:outline-none"
			>
				<option value="">Select</option>
				{#each storages.filter(s => s.active) as storage}
					<option value={storage.id}>{storage.name}</option>
				{/each}
			</select>
		</div>
		<div>
			<label for="al-thresh" class="mb-1 block text-sm font-medium text-gray-700">Threshold *</label>
			<input
				id="al-thresh"
				type="number"
				bind:value={alertForm.threshold}
				min="0"
				class="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm focus:border-orange-400 focus:bg-white focus:ring-2 focus:ring-orange-100 focus:outline-none"
			/>
			<p class="mt-1 text-xs text-gray-400">Fires when stock is at or below this number</p>
		</div>
		<label class="flex cursor-pointer items-center gap-2.5">
			<input type="checkbox" bind:checked={alertForm.active} class="h-4 w-4 rounded border-gray-300 text-orange-500" />
			<span class="text-sm text-gray-700">Active</span>
		</label>
		<div class="flex gap-2 pt-2">
			<button
				type="button"
				onclick={() => (alertDrawerOpen = false)}
				class="flex-1 rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
			>
				Cancel
			</button>
			<button
				type="submit"
				disabled={saveLoading}
				class="flex-1 rounded-xl bg-orange-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-orange-600 disabled:opacity-50"
			>
				{saveLoading ? 'Saving…' : alertForm.id ? 'Update' : 'Create'}
			</button>
		</div>
	</form>
</Drawer>

<div class="mx-auto max-w-md pb-6 pt-3">
	<h1 class="mb-1 text-lg font-bold text-gray-900">Alerts</h1>
	<p class="mb-4 text-xs text-gray-500">
		Low-stock warnings. {#if !isAdmin}Ask an admin to add or change rules.{/if}
	</p>

	{#if loading}
		<div class="flex justify-center py-12">
			<div class="h-8 w-8 animate-spin rounded-full border-2 border-orange-400 border-t-transparent"></div>
		</div>
	{:else}
		{#if triggered.length > 0}
			<div class="mb-4 rounded-xl border border-red-200 bg-red-50 p-3">
				<div class="flex items-center gap-2">
					<div class="h-2 w-2 animate-pulse rounded-full bg-red-500"></div>
					<h2 class="text-sm font-semibold text-red-900">Triggered now ({triggered.length})</h2>
				</div>
				<ul class="mt-2 space-y-1">
					{#each triggered as a}
						<li class="text-xs text-red-800">
							<span class="font-medium">{a.product_name}</span>
							<span class="opacity-70"> · {a.storage_name} · </span>
							<span class="font-medium">{a.current_quantity}</span>
							≤ {a.threshold}
						</li>
					{/each}
				</ul>
			</div>
		{:else}
			<div class="mb-4 rounded-xl bg-green-50 px-3 py-2.5 text-xs text-green-800 ring-1 ring-green-100">
				No active alerts below threshold.
			</div>
		{/if}

		<div class="mb-2 flex items-center justify-between">
			<h2 class="text-xs font-semibold uppercase tracking-wide text-gray-400">Rules</h2>
			{#if isAdmin}
				<button
					type="button"
					onclick={openNewAlert}
					class="rounded-lg bg-orange-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-orange-600"
				>
					Add
				</button>
			{/if}
		</div>

		{#if stockAlerts.length === 0}
			<p class="rounded-xl bg-white py-10 text-center text-sm text-gray-500 shadow-sm ring-1 ring-gray-100">
				No rules configured.
			</p>
		{:else}
			<div class="overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-gray-100">
				{#each stockAlerts as alert, i}
					<div class="flex items-center gap-3 px-4 py-3.5 {i < stockAlerts.length - 1 ? 'border-b border-gray-100' : ''}">
						<div class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-orange-50">
							<svg class="h-4 w-4 text-orange-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
								<path stroke-linecap="round" stroke-linejoin="round" d="M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0" />
							</svg>
						</div>
						<div class="min-w-0 flex-1">
							<p class="truncate text-sm font-semibold text-gray-900">{alert.products.name}</p>
							<p class="text-xs text-gray-400">
								{alert.storages.name} · ≤ {alert.threshold}
								<span class="ml-1 rounded px-1 py-0.5 text-[10px] font-semibold {alert.active ? 'bg-orange-100 text-orange-700' : 'bg-gray-100 text-gray-500'}">
									{alert.active ? 'on' : 'off'}
								</span>
							</p>
						</div>
						{#if isAdmin}
							<div class="flex shrink-0 gap-1">
								<button
									type="button"
									onclick={() => openEditAlert(alert)}
									class="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-blue-600"
									aria-label="Edit"
								>
									<svg class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
										<path d="M5.433 13.917l1.262-3.155A4 4 0 017.58 9.42l6.92-6.918a2.121 2.121 0 013 3l-6.92 6.918c-.383.383-.84.685-1.343.886l-3.154 1.262a.5.5 0 01-.65-.65z" />
										<path d="M3.5 5.75c0-.69.56-1.25 1.25-1.25H10A.75.75 0 0010 3H4.75A2.75 2.75 0 002 5.75v9.5A2.75 2.75 0 004.75 18h9.5A2.75 2.75 0 0017 15.25V10a.75.75 0 00-1.5 0v5.25c0 .69-.56 1.25-1.25 1.25h-9.5c-.69 0-1.25-.56-1.25-1.25v-9.5z" />
									</svg>
								</button>
								<button
									type="button"
									onclick={() => deleteAlert(alert.id)}
									class="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-red-600"
									aria-label="Delete"
								>
									<svg class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
										<path fill-rule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.52.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z" clip-rule="evenodd" />
									</svg>
								</button>
							</div>
						{/if}
					</div>
				{/each}
			</div>
		{/if}
	{/if}
</div>
