<script lang="ts">
	import { onMount } from 'svelte'
	import { products as productsStore } from '$lib/stores.js'
	import { outbox, pendingDelta } from '$lib/outbox.js'
	import { loadPrefs, savePrefs } from '$lib/prefs.js'

	let { data } = $props()
	// Offline bookings are applied on top so the numbers are right before the sync happened.
	const inventoryData = $derived(
		(data.inventory ?? []).map(i => ({
			...i,
			quantity: Math.max(0, i.quantity + pendingDelta($outbox, i.product_id, i.storage_id))
		}))
	)
	const stockAlerts = $derived(data.alerts ?? [])

	/** `locations` = grouped by warehouse/home; `products` = each product with a per-location breakdown */
	let inventoryView = $state<'locations' | 'products'>('locations')
	let collapsed = $state<Record<string, boolean>>({})

	onMount(() => {
		const v = (loadPrefs() as { view?: string }).view
		if (v === 'products' || v === 'locations') inventoryView = v
	})
	const setView = (v: 'locations' | 'products') => {
		inventoryView = v
		savePrefs({ view: v } as never)
	}

	const packSize = (productId: string) => $productsStore.find(p => p.id === productId)?.pack_size ?? 1
	const shortName = (name: string) => name.replace(/^Saurer Siggi\s*/i, '')

	const fmt = (bottles: number, ps: number) => {
		if (ps <= 1) return { main: String(bottles), sub: 'Fl.' }
		const packs = Math.floor(bottles / ps)
		const rem = bottles % ps
		return { main: `${packs} Packs`, sub: rem > 0 ? `+ ${rem} Fl. · ${bottles} gesamt` : `${bottles} Fl.` }
	}

	type Item = (typeof inventoryData)[number]

	const alertFor = (item: Item) =>
		stockAlerts.find(a => a.active && a.product_id === item.product_id && a.storage_id === item.storage_id)

	const level = (item: Item) => {
		const q = item.quantity
		const a = alertFor(item)
		if (a && q <= a.threshold) return { label: 'Warnung', bar: 'bg-red-500', text: 'text-red-700', w: 'w-1/4', alert: true }
		if (q === 0) return { label: 'Leer', bar: 'bg-red-400', text: 'text-red-600', w: 'w-0', alert: false }
		if (q <= 5) return { label: 'Niedrig', bar: 'bg-amber-400', text: 'text-amber-700', w: 'w-1/4', alert: false }
		if (q <= 20) return { label: 'Mittel', bar: 'bg-blue-400', text: 'text-blue-700', w: 'w-1/2', alert: false }
		return { label: 'Gut', bar: 'bg-green-400', text: 'text-green-700', w: 'w-full', alert: false }
	}

	const triggeredAlerts = $derived(inventoryData.filter(i => level(i).alert))
	const totals = $derived.by(() => {
		const byProduct: Record<string, { name: string; ps: number; quantity: number }> = {}
		for (const i of inventoryData) {
			byProduct[i.product_id] ??= { name: shortName(i.product_name), ps: packSize(i.product_id), quantity: 0 }
			byProduct[i.product_id].quantity += i.quantity
		}
		return Object.values(byProduct)
	})

	const byLocation = $derived.by(() => {
		const m: Record<string, { name: string; type: string; items: Item[]; total: number }> = {}
		for (const i of inventoryData) {
			m[i.storage_id] ??= { name: i.storage_name, type: i.storage_type, items: [], total: 0 }
			m[i.storage_id].items.push(i)
			m[i.storage_id].total += i.quantity
		}
		return Object.entries(m)
			.map(([id, v]) => ({ id, ...v }))
			.sort((a, b) => (a.type !== b.type ? (a.type === 'warehouse' ? -1 : 1) : a.name.localeCompare(b.name)))
	})

	const byProduct = $derived.by(() => {
		const m: Record<string, { id: string; name: string; sku: string; total: number; rows: Item[] }> = {}
		for (const i of inventoryData) {
			m[i.product_id] ??= { id: i.product_id, name: i.product_name, sku: i.sku, total: 0, rows: [] }
			m[i.product_id].total += i.quantity
			m[i.product_id].rows.push(i)
		}
		return Object.values(m).sort((a, b) => a.name.localeCompare(b.name))
	})

	const toggle = (key: string) => (collapsed = { ...collapsed, [key]: !collapsed[key] })

	function clearCaches() {
		// Cached pages contain stock data — drop them when signing out.
		try {
			void caches.delete('pages')
			void caches.delete('page-data')
		} catch {}
	}
</script>

<svelte:head><title>Bestand · Siggi Inventar</title></svelte:head>

{#snippet actions(item: Item)}
	<div class="flex shrink-0 gap-1.5">
		<a
			href="/remove?product={item.product_id}&storage={item.storage_id}"
			class="flex h-11 w-11 items-center justify-center rounded-xl bg-red-50 text-red-600 ring-1 ring-red-100 transition active:scale-90"
			aria-label="{shortName(item.product_name)} aus {item.storage_name} ausbuchen"
		>
			<svg class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M4 10a1 1 0 011-1h10a1 1 0 110 2H5a1 1 0 01-1-1z" /></svg>
		</a>
		<a
			href="/add?product={item.product_id}&storage={item.storage_id}"
			class="flex h-11 w-11 items-center justify-center rounded-xl bg-green-50 text-green-700 ring-1 ring-green-100 transition active:scale-90"
			aria-label="{shortName(item.product_name)} in {item.storage_name} einbuchen"
		>
			<svg class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M10 4a1 1 0 011 1v4h4a1 1 0 110 2h-4v4a1 1 0 11-2 0v-4H5a1 1 0 110-2h4V5a1 1 0 011-1z" /></svg>
		</a>
	</div>
{/snippet}

<div class="mx-auto flex max-w-md flex-col pb-4 pt-3">
	{#if triggeredAlerts.length > 0}
		<a href="/alerts" class="mb-3 block rounded-2xl border border-red-200 bg-red-50 p-3 no-underline">
			<div class="flex items-center gap-2">
				<span class="h-2 w-2 animate-pulse rounded-full bg-red-500"></span>
				<h3 class="text-sm font-semibold text-red-900">
					{triggeredAlerts.length} Bestandswarnung{triggeredAlerts.length > 1 ? 'en' : ''}
				</h3>
			</div>
			<div class="mt-1.5 space-y-0.5">
				{#each triggeredAlerts as i}
					<p class="text-xs text-red-700">
						<span class="font-medium">{shortName(i.product_name)}</span> · {i.storage_name} ·
						<span class="font-semibold">{fmt(i.quantity, packSize(i.product_id)).main}</span>
					</p>
				{/each}
			</div>
		</a>
	{/if}

	<!-- Totals + view toggle -->
	<div class="mb-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-gray-100">
		<div class="flex flex-wrap items-start justify-between gap-3">
			<div class="flex gap-5">
				{#each totals as t}
					{@const f = fmt(t.quantity, t.ps)}
					<div>
						<p class="text-[11px] font-semibold uppercase tracking-wide text-gray-400">{t.name}</p>
						<p class="text-2xl font-bold tabular-nums text-gray-900">{f.main}</p>
						<p class="text-[11px] text-gray-400">{t.ps > 1 ? `${t.quantity} Fl.` : 'Flaschen'}</p>
					</div>
				{/each}
			</div>
			<div class="flex rounded-xl bg-gray-100 p-0.5 text-xs font-semibold" role="group" aria-label="Ansicht">
				<button type="button" onclick={() => setView('locations')} class="rounded-lg px-3 py-2 transition {inventoryView === 'locations' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}">Lager</button>
				<button type="button" onclick={() => setView('products')} class="rounded-lg px-3 py-2 transition {inventoryView === 'products' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}">Produkt</button>
			</div>
		</div>
	</div>

	{#if inventoryData.length === 0}
		<p class="rounded-2xl bg-white py-8 text-center text-sm text-gray-500 shadow-sm ring-1 ring-gray-100">Noch kein Bestand erfasst.</p>
	{:else if inventoryView === 'locations'}
		<div class="space-y-2">
			{#each byLocation as loc (loc.id)}
				{@const n = triggeredAlerts.filter(a => a.storage_id === loc.id).length}
				<div class="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-gray-100">
					<button type="button" class="w-full px-4 py-3 text-left" onclick={() => toggle(loc.id)} aria-expanded={!collapsed[loc.id]}>
						<div class="flex items-center justify-between gap-3">
							<div class="flex min-w-0 items-center gap-2.5">
								<span class="h-2.5 w-2.5 shrink-0 rounded-full {loc.type === 'warehouse' ? 'bg-blue-400' : 'bg-green-400'}"></span>
								<div class="min-w-0">
									<div class="flex items-center gap-1.5">
										<h4 class="truncate text-sm font-semibold text-gray-900">{loc.name}</h4>
										{#if n > 0}<span class="rounded-full bg-red-500 px-1.5 py-0.5 text-[9px] font-bold text-white">{n}</span>{/if}
									</div>
									<p class="text-[11px] text-gray-400">{loc.type === 'warehouse' ? 'Lager' : 'Zuhause'}</p>
								</div>
							</div>
							<div class="flex shrink-0 items-center gap-2.5">
								<p class="text-base font-bold tabular-nums text-gray-900">{loc.total} <span class="text-[10px] font-medium text-gray-400">Fl.</span></p>
								<svg class="h-4 w-4 text-gray-400 transition-transform {collapsed[loc.id] ? 'rotate-180' : ''}" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" /></svg>
							</div>
						</div>
					</button>
					{#if !collapsed[loc.id]}
						<ul class="border-t border-gray-100">
							{#each loc.items as item, idx (item.product_id)}
								{@const lv = level(item)}
								{@const f = fmt(item.quantity, packSize(item.product_id))}
								<li class="flex items-center gap-3 px-4 py-2.5 {idx < loc.items.length - 1 ? 'border-b border-gray-50' : ''}">
									<div class="min-w-0 flex-1">
										<p class="truncate text-sm font-medium text-gray-900">{shortName(item.product_name)}</p>
										<div class="mt-1 h-1 w-full max-w-[110px] rounded-full bg-gray-100"><div class="h-1 rounded-full {lv.bar} {lv.w}"></div></div>
									</div>
									<div class="shrink-0 text-right">
										<p class="text-sm font-bold tabular-nums text-gray-900">{f.main}</p>
										<p class="text-[10px] font-medium {lv.text}">{lv.label}{item.quantity > 0 && packSize(item.product_id) > 1 ? ` · ${f.sub}` : ''}</p>
									</div>
									{@render actions(item)}
								</li>
							{/each}
						</ul>
					{/if}
				</div>
			{/each}
		</div>
	{:else}
		<div class="space-y-2">
			{#each byProduct as g (g.id)}
				{@const ps = packSize(g.id)}
				<div class="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-gray-100">
					<button type="button" class="w-full px-4 py-3 text-left" onclick={() => toggle(g.id)} aria-expanded={!collapsed[g.id]}>
						<div class="flex items-center justify-between gap-3">
							<div class="min-w-0">
								<h4 class="truncate text-sm font-semibold text-gray-900">{g.name}</h4>
								<p class="text-[11px] text-gray-400">{g.sku}</p>
							</div>
							<div class="flex shrink-0 items-center gap-2">
								<div class="text-right">
									<p class="text-base font-bold tabular-nums text-gray-900">{fmt(g.total, ps).main}</p>
									{#if ps > 1}<p class="text-[10px] text-gray-400">{g.total} Fl. gesamt</p>{/if}
								</div>
								<svg class="h-4 w-4 text-gray-400 transition-transform {collapsed[g.id] ? 'rotate-180' : ''}" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" /></svg>
							</div>
						</div>
					</button>
					{#if !collapsed[g.id]}
						<ul class="border-t border-gray-100">
							{#each g.rows as item, idx (item.storage_id)}
								{@const lv = level(item)}
								{@const f = fmt(item.quantity, ps)}
								<li class="flex items-center gap-3 px-4 py-2.5 {idx < g.rows.length - 1 ? 'border-b border-gray-50' : ''}">
									<span class="h-2 w-2 shrink-0 rounded-full {item.storage_type === 'warehouse' ? 'bg-blue-400' : 'bg-green-400'}"></span>
									<div class="min-w-0 flex-1">
										<p class="truncate text-sm font-medium text-gray-800">{item.storage_name}</p>
										<div class="mt-1 h-1 w-full max-w-[110px] rounded-full bg-gray-100"><div class="h-1 rounded-full {lv.bar} {lv.w}"></div></div>
									</div>
									<div class="shrink-0 text-right">
										<p class="text-sm font-bold tabular-nums text-gray-900">{f.main}</p>
										<p class="text-[10px] font-medium {lv.text}">{lv.label}{item.quantity > 0 && ps > 1 ? ` · ${f.sub}` : ''}</p>
									</div>
									{@render actions(item)}
								</li>
							{/each}
						</ul>
					{/if}
				</div>
			{/each}
		</div>
	{/if}

	<div class="mt-6 flex justify-center">
		<form method="POST" action="/logout" onsubmit={clearCaches}>
			<button type="submit" class="flex items-center gap-1.5 rounded-xl px-3 py-2.5 text-xs text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600">
				<svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" /></svg>
				Abmelden
			</button>
		</form>
	</div>
</div>
