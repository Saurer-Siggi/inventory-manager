<script lang="ts">
	import { user, signOut } from '$lib/auth.js'
	import { goto } from '$app/navigation'
	import { supabase } from '$lib/supabaseClient.js'
	import { onMount } from 'svelte'
	import type { InventoryReport, StockAlertWithJoins, TriggeredAlert } from '$lib/database.types.js'
	import { products as productsStore, loadOperationsData } from '$lib/stores.js'

	let { data } = $props()
	let inventoryData = $state<InventoryReport[]>([])
	$effect.pre(() => {
		inventoryData = [...(data.inventory ?? [])]
	})
	let stockAlerts = $state<StockAlertWithJoins[]>([])
	let triggeredAlerts = $state<TriggeredAlert[]>([])
	/** `locations` = group by warehouse/home; `products` = each product with per-location breakdown */
	let inventoryView = $state<'locations' | 'products'>('locations')
	// Expanded by default
	let collapsedSections = $state<Record<string, boolean>>({})
	let collapsedProducts = $state<Record<string, boolean>>({})

	const handleSignOut = async () => {
		await signOut()
		goto('/login')
	}

	// Load products for pack_size lookups
	const packSizeForSku = (sku: string) => $productsStore.find(p => p.sku === sku)?.pack_size ?? 1

	const fmtPacks = (bottles: number, ps: number) => {
		if (ps <= 1) return null
		const packs = Math.floor(bottles / ps)
		const rem = bottles % ps
		return rem > 0 ? `${packs} packs +${rem} btl` : `${packs} packs`
	}

	onMount(() => {
		loadOperationsData()
		loadStockAlerts()

		const inventoryChannel = supabase
			.channel('inventory_changes')
			.on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'inventory' }, () => {
				refreshInventory()
			})
			.on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'transactions' }, () => {
				refreshInventory()
			})
			.on('postgres_changes', { event: '*', schema: 'public', table: 'stock_alerts' }, () => {
				loadStockAlerts()
			})
			.subscribe()

		return () => {
			supabase.removeChannel(inventoryChannel)
		}
	})

	const refreshInventory = async () => {
		try {
			const { data: inventory, error } = await supabase
				.from('inventory_report')
				.select('*')
				.order('product_name, storage_name')

			if (!error && inventory) {
				inventoryData = inventory
				checkTriggeredAlerts()
			}
		} catch (error) {
			console.error('Error refreshing inventory:', error)
		}
	}

	const loadStockAlerts = async () => {
		try {
			const { data: alerts, error } = await supabase
				.from('stock_alerts')
				.select(`*, products (name, sku), storages (name, type)`)
				.eq('active', true)

			if (!error && alerts) {
				stockAlerts = alerts
				checkTriggeredAlerts()
			}
		} catch (error) {
			console.error('Error loading stock alerts:', error)
		}
	}

	const checkTriggeredAlerts = () => {
		if (!stockAlerts || !inventoryData) return

		const triggered: TriggeredAlert[] = []
		stockAlerts.forEach(alert => {
			const inventoryItem = inventoryData.find(
				item => item.sku === alert.products.sku && item.storage_name === alert.storages.name
			)
			if (inventoryItem && inventoryItem.quantity <= alert.threshold) {
				triggered.push({
					...alert,
					current_quantity: inventoryItem.quantity,
					product_name: alert.products.name,
					storage_name: alert.storages.name
				})
			}
		})

		triggeredAlerts = triggered
	}

	const totals = $derived.by(() => {
		const byProduct: Record<string, { name: string; quantity: number }> = {}
		let total = 0
		inventoryData.forEach(item => {
			if (!byProduct[item.sku]) byProduct[item.sku] = { name: item.product_name, quantity: 0 }
			byProduct[item.sku].quantity += item.quantity
			total += item.quantity
		})
		return { byProduct, total }
	})

	const groupedInventory = $derived.by(() => {
		const grouped: Record<
			string,
			{ storage_name: string; storage_type: string; items: typeof inventoryData; total_quantity: number }
		> = {}
		inventoryData.forEach(item => {
			if (!grouped[item.storage_name]) {
				grouped[item.storage_name] = {
					storage_name: item.storage_name,
					storage_type: item.storage_type,
					items: [],
					total_quantity: 0
				}
			}
			grouped[item.storage_name].items.push(item)
			grouped[item.storage_name].total_quantity += item.quantity
		})
		return grouped
	})

	// Default expanded (false = not collapsed)
	const isLocationCollapsed = (storageName: string) => collapsedSections[storageName] ?? false

	const toggleLocation = (storageName: string) => {
		const cur = collapsedSections[storageName] ?? false
		collapsedSections = { ...collapsedSections, [storageName]: !cur }
	}

	const getStockLevel = (item: (typeof inventoryData)[number]) => {
		const quantity = item.quantity
		const customAlert = stockAlerts.find(
			alert => alert.products.sku === item.sku && alert.storages.name === item.storage_name
		)
		if (customAlert && quantity <= customAlert.threshold) {
			return { label: 'Alert', color: 'bg-red-500', textColor: 'text-red-700', barWidth: 'w-1/4', isAlert: true }
		}
		if (quantity === 0) return { label: 'Empty', color: 'bg-red-400', textColor: 'text-red-600', barWidth: 'w-0', isAlert: false }
		if (quantity <= 5) return { label: 'Low', color: 'bg-amber-400', textColor: 'text-amber-700', barWidth: 'w-1/4', isAlert: false }
		if (quantity <= 20) return { label: 'Medium', color: 'bg-blue-400', textColor: 'text-blue-700', barWidth: 'w-1/2', isAlert: false }
		return { label: 'Good', color: 'bg-green-400', textColor: 'text-green-700', barWidth: 'w-full', isAlert: false }
	}

	const sortedLocations = $derived(
		Object.values(groupedInventory)
			.sort((a, b) => {
				if (a.storage_type !== b.storage_type) return a.storage_type === 'warehouse' ? -1 : 1
				return a.storage_name.localeCompare(b.storage_name)
			})
	)

	const groupedByProduct = $derived.by(() => {
		const m: Record<
			string,
			{ sku: string; product_name: string; total: number; byStorage: { storage_name: string; quantity: number; storage_type: string }[] }
		> = {}
		inventoryData.forEach(item => {
			if (!m[item.sku]) {
				m[item.sku] = { sku: item.sku, product_name: item.product_name, total: 0, byStorage: [] }
			}
			m[item.sku].total += item.quantity
			m[item.sku].byStorage.push({
				storage_name: item.storage_name,
				quantity: item.quantity,
				storage_type: item.storage_type
			})
		})
		return Object.values(m).sort((a, b) => a.product_name.localeCompare(b.product_name))
	})

	const isProductCollapsed = (sku: string) => collapsedProducts[sku] ?? false
	const toggleProduct = (sku: string) => {
		const cur = collapsedProducts[sku] ?? false
		collapsedProducts = { ...collapsedProducts, [sku]: !cur }
	}
</script>

<div class="mx-auto flex max-w-md flex-col pb-4 pt-3">
	{#if data.error}
		<div class="mb-4 rounded-xl border border-red-200 bg-red-50 p-4">
			<h3 class="mb-1 text-sm font-semibold text-red-900">Connection error</h3>
			<p class="text-xs text-red-700">{data.error}</p>
			<p class="mt-2 text-[11px] text-red-600">
				Check your Supabase URL and key in <code class="rounded bg-red-100 px-0.5">.env</code>.
			</p>
		</div>
	{:else}
		<!-- Alerts banner -->
		{#if triggeredAlerts.length > 0}
			<div class="mb-3 rounded-xl border border-red-200 bg-red-50 p-3">
				<div class="flex items-center gap-2">
					<div class="h-2 w-2 animate-pulse rounded-full bg-red-500"></div>
					<h3 class="text-sm font-semibold text-red-900">
						{triggeredAlerts.length} low-stock alert{triggeredAlerts.length > 1 ? 's' : ''}
					</h3>
				</div>
				<div class="mt-2 space-y-0.5">
					{#each triggeredAlerts as alert}
						<p class="text-xs text-red-700">
							<span class="font-medium">{alert.product_name}</span>
							<span class="opacity-60"> · </span>
							<span>{alert.storage_name}</span>
							<span class="opacity-60"> · </span>
							<span class="font-medium">{alert.current_quantity}</span> (≤{alert.threshold})
						</p>
					{/each}
				</div>
			</div>
		{/if}

		<!-- Totals + view mode -->
		<div class="mb-3 rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-100">
			<div class="mb-3 flex flex-wrap items-end justify-between gap-2">
				<div>
					<p class="text-xs font-semibold uppercase tracking-wide text-gray-400">All bottles</p>
					<p class="text-2xl font-bold text-gray-900">{totals.total}</p>
				</div>
				<div class="flex rounded-lg bg-gray-100 p-0.5 text-xs font-semibold">
					<button
						type="button"
						onclick={() => (inventoryView = 'locations')}
						class="rounded-md px-3 py-1.5 transition-colors {inventoryView === 'locations' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}"
					>
						By location
					</button>
					<button
						type="button"
						onclick={() => (inventoryView = 'products')}
						class="rounded-md px-3 py-1.5 transition-colors {inventoryView === 'products' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}"
					>
						By product
					</button>
				</div>
			</div>
			<p class="text-[11px] text-gray-400">
				{inventoryView === 'locations'
					? 'Each place shows how many bottles are there.'
					: 'Each product shows the total, then a breakdown by place.'}
			</p>
		</div>

		<!-- Quick actions -->
		<div class="mb-4 grid grid-cols-3 gap-2">
			<a
				href="/remove"
				class="flex flex-col items-center gap-1.5 rounded-xl bg-white p-3 text-center shadow-sm ring-1 ring-gray-100 transition-all hover:ring-red-300 hover:shadow-md active:scale-95"
			>
				<span class="flex h-9 w-9 items-center justify-center rounded-full bg-red-50">
					<svg class="h-5 w-5 text-red-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<circle cx="12" cy="12" r="9" />
						<path stroke-linecap="round" d="M9 12h6" />
					</svg>
				</span>
				<span class="text-xs font-semibold text-gray-700">Remove</span>
				<span class="text-[10px] text-gray-400">Delivery / use</span>
			</a>
			<a
				href="/add"
				class="flex flex-col items-center gap-1.5 rounded-xl bg-white p-3 text-center shadow-sm ring-1 ring-gray-100 transition-all hover:ring-green-300 hover:shadow-md active:scale-95"
			>
				<span class="flex h-9 w-9 items-center justify-center rounded-full bg-green-50">
					<svg class="h-5 w-5 text-green-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<circle cx="12" cy="12" r="9" />
						<path stroke-linecap="round" d="M12 9v6M9 12h6" />
					</svg>
				</span>
				<span class="text-xs font-semibold text-gray-700">Add</span>
				<span class="text-[10px] text-gray-400">Restock</span>
			</a>
			<a
				href="/transfer"
				class="flex flex-col items-center gap-1.5 rounded-xl bg-white p-3 text-center shadow-sm ring-1 ring-gray-100 transition-all hover:ring-blue-300 hover:shadow-md active:scale-95"
			>
				<span class="flex h-9 w-9 items-center justify-center rounded-full bg-blue-50">
					<svg class="h-5 w-5 text-blue-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<path stroke-linecap="round" stroke-linejoin="round" d="M7.5 21 3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5M16.5 3 21 7.5m0 0L16.5 12" />
					</svg>
				</span>
				<span class="text-xs font-semibold text-gray-700">Move</span>
				<span class="text-[10px] text-gray-400">Transfer</span>
			</a>
		</div>

		<!-- Inventory: by location or by product -->
		{#if inventoryView === 'locations' && sortedLocations.length > 0}
			<div>
				<div class="space-y-2">
					{#each sortedLocations as location}
						{@const locationAlerts = triggeredAlerts.filter(a => a.storage_name === location.storage_name)}
						<div
							class="overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-gray-100"
						>
							<button
								type="button"
								class="w-full px-4 py-3 text-left transition-colors hover:bg-gray-50/80"
								onclick={() => toggleLocation(location.storage_name)}
							>
								<div class="flex items-center justify-between gap-3">
									<div class="flex min-w-0 items-center gap-2.5">
										<!-- Type dot -->
										<div
											class="h-2.5 w-2.5 shrink-0 rounded-full {location.storage_type === 'warehouse'
												? 'bg-blue-400'
												: 'bg-green-400'}"
										></div>
										<div class="min-w-0">
											<div class="flex items-center gap-1.5">
												<h4 class="truncate text-sm font-semibold text-gray-900">{location.storage_name}</h4>
												{#if locationAlerts.length > 0}
													<span class="shrink-0 rounded-full bg-red-500 px-1.5 py-0.5 text-[9px] font-bold text-white">
														{locationAlerts.length}
													</span>
												{/if}
											</div>
											<p class="text-[11px] text-gray-400">
												{location.storage_type === 'warehouse' ? 'Warehouse' : 'Home storage'}
											</p>
										</div>
									</div>
									<div class="flex shrink-0 items-center gap-2.5">
										<div class="text-right">
											<p class="text-base font-bold text-gray-900">{location.total_quantity}</p>
											<p class="text-[10px] text-gray-400">bottles</p>
										</div>
										<svg
											class="h-4 w-4 shrink-0 text-gray-400 transition-transform {isLocationCollapsed(location.storage_name) ? 'rotate-180' : ''}"
											fill="none"
											stroke="currentColor"
											viewBox="0 0 24 24"
										>
											<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
										</svg>
									</div>
								</div>
							</button>

							{#if !isLocationCollapsed(location.storage_name)}
								<div class="border-t border-gray-100">
									{#each location.items as item}
										{@const level = getStockLevel(item)}
										{@const ps = packSizeForSku(item.sku)}
										{@const packs = fmtPacks(item.quantity, ps)}
										<div class="flex items-center gap-3 px-4 py-3 {location.items.indexOf(item) < location.items.length - 1 ? 'border-b border-gray-50' : ''}">
											<div class="min-w-0 flex-1">
												<div class="flex items-center gap-1.5">
													<p class="text-sm font-medium text-gray-900 truncate">{item.product_name}</p>
													{#if level.isAlert}
														<span class="shrink-0 rounded-full bg-red-100 px-1.5 py-0.5 text-[9px] font-semibold text-red-700">ALERT</span>
													{/if}
												</div>
												<p class="text-[11px] text-gray-400">{item.sku}</p>
												<!-- Stock level bar -->
												<div class="mt-1.5 h-1 w-full rounded-full bg-gray-100">
													<div class="h-1 rounded-full transition-all {level.color} {level.barWidth}"></div>
												</div>
											</div>
											<div class="shrink-0 text-right">
												{#if packs}
													<p class="text-sm font-bold text-gray-900">{packs}</p>
													<p class="text-[10px] text-gray-400">{item.quantity} btl</p>
												{:else}
													<p class="text-sm font-bold text-gray-900">{item.quantity}</p>
													<p class="text-[10px] {level.textColor} font-medium">{level.label}</p>
												{/if}
											</div>
										</div>
									{/each}
								</div>
							{/if}
						</div>
					{/each}
				</div>
			</div>
		{:else if inventoryView === 'products' && groupedByProduct.length > 0}
			<div class="space-y-2">
				{#each groupedByProduct as g}
					{@const ps = packSizeForSku(g.sku)}
					{@const packs = fmtPacks(g.total, ps)}
					<div class="overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-gray-100">
						<button
							type="button"
							class="w-full px-4 py-3 text-left transition-colors hover:bg-gray-50/80"
							onclick={() => toggleProduct(g.sku)}
						>
							<div class="flex items-center justify-between gap-3">
								<div class="min-w-0">
									<h4 class="truncate text-sm font-semibold text-gray-900">{g.product_name}</h4>
									<p class="text-[11px] text-gray-400">{g.sku}</p>
								</div>
								<div class="flex shrink-0 items-center gap-2">
									<div class="text-right">
										{#if packs}
											<p class="text-base font-bold text-gray-900">{packs}</p>
											<p class="text-[10px] text-gray-400">{g.total} btl total</p>
										{:else}
											<p class="text-base font-bold text-gray-900">{g.total}</p>
											<p class="text-[10px] text-gray-400">total btl</p>
										{/if}
									</div>
									<svg
										class="h-4 w-4 shrink-0 text-gray-400 transition-transform {isProductCollapsed(g.sku) ? 'rotate-180' : ''}"
										fill="none"
										stroke="currentColor"
										viewBox="0 0 24 24"
									>
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
									</svg>
								</div>
							</div>
						</button>
						{#if !isProductCollapsed(g.sku)}
							<div class="border-t border-gray-100">
								{#each g.byStorage as row, j}
									{@const invItem = inventoryData.find(i => i.sku === g.sku && i.storage_name === row.storage_name)}
									{@const level = invItem ? getStockLevel(invItem) : { label: '', color: 'bg-gray-300', textColor: 'text-gray-500', barWidth: 'w-0', isAlert: false }}
									{@const rowPs = packSizeForSku(g.sku)}
									{@const rowPacks = fmtPacks(row.quantity, rowPs)}
									<div class="flex items-center gap-3 px-4 py-2.5 {j < g.byStorage.length - 1 ? 'border-b border-gray-50' : ''}">
										<div
											class="h-2 w-2 shrink-0 rounded-full {row.storage_type === 'warehouse' ? 'bg-blue-400' : 'bg-green-400'}"
										></div>
										<div class="min-w-0 flex-1">
											<p class="text-sm font-medium text-gray-800">{row.storage_name}</p>
											<div class="mt-1 h-1 w-full max-w-[120px] rounded-full bg-gray-100">
												<div class="h-1 rounded-full {level.color} {level.barWidth}"></div>
											</div>
										</div>
										<div class="shrink-0 text-right">
											{#if rowPacks}
												<p class="text-sm font-bold text-gray-900">{rowPacks}</p>
												<p class="text-[10px] text-gray-400">{row.quantity} btl</p>
											{:else}
												<p class="text-sm font-bold text-gray-900">{row.quantity}</p>
												<p class="text-[10px] {level.textColor} font-medium">{level.label}</p>
											{/if}
										</div>
									</div>
								{/each}
							</div>
						{/if}
					</div>
				{/each}
			</div>
		{:else if inventoryData.length === 0}
			<p class="rounded-xl bg-white py-8 text-center text-sm text-gray-500 shadow-sm ring-1 ring-gray-100">No stock recorded yet.</p>
		{/if}

		<!-- Sign out -->
		<div class="mt-6 flex justify-center">
			<button
				type="button"
				class="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
				onclick={handleSignOut}
			>
				<svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<path stroke-linecap="round" stroke-linejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" />
				</svg>
				Sign out ({$user?.email})
			</button>
		</div>
	{/if}
</div>
