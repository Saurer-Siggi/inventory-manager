<script lang="ts">
	import { onMount, tick } from 'svelte'
	import { page } from '$app/stores'
	import { invalidateAll } from '$app/navigation'
	import { products, storages, inventory } from '$lib/stores.js'
	import { toast } from '$lib/components/toast.js'
	import { outbox, enqueue, online, pendingDelta } from '$lib/outbox.js'
	import { loadPrefs, savePrefs, uuid, haptic } from '$lib/prefs.js'
	import { resolveProductId, resolveStorageId } from '$lib/resolve.js'
	import type { RecentCombo } from '$lib/database.types.js'

	type Mode = 'remove' | 'add' | 'transfer'
	let { mode }: { mode: Mode } = $props()

	// Full class strings so Tailwind can see them.
	const THEME = $derived(({
		remove: {
			title: 'Ausbuchen',
			verb: 'Ausbuchen',
			done: 'Ausgebucht',
			tab: 'bg-red-500 text-white shadow-sm',
			sel: 'bg-red-50 ring-2 ring-red-500',
			chip: 'bg-red-50 text-red-700 ring-red-200',
			btn: 'bg-red-500 hover:bg-red-600',
			focus: 'focus:border-red-400 focus:ring-red-200'
		},
		add: {
			title: 'Einbuchen',
			verb: 'Einbuchen',
			done: 'Eingebucht',
			tab: 'bg-green-600 text-white shadow-sm',
			sel: 'bg-green-50 ring-2 ring-green-600',
			chip: 'bg-green-50 text-green-700 ring-green-200',
			btn: 'bg-green-600 hover:bg-green-700',
			focus: 'focus:border-green-400 focus:ring-green-200'
		},
		transfer: {
			title: 'Umlagern',
			verb: 'Umlagern',
			done: 'Umgelagert',
			tab: 'bg-blue-600 text-white shadow-sm',
			sel: 'bg-blue-50 ring-2 ring-blue-600',
			chip: 'bg-blue-50 text-blue-700 ring-blue-200',
			btn: 'bg-blue-600 hover:bg-blue-700',
			focus: 'focus:border-blue-400 focus:ring-blue-200'
		}
	})[mode])

	const TABS: { href: string; mode: Mode; label: string }[] = [
		{ href: '/remove', mode: 'remove', label: 'Ausbuchen' },
		{ href: '/add', mode: 'add', label: 'Einbuchen' },
		{ href: '/transfer', mode: 'transfer', label: 'Umlagern' }
	]

	let productId = $state('')
	let storageId = $state('') // booking location, or "from" for transfers
	let toStorageId = $state('')
	let qty = $state(1)
	let unit = $state<'packs' | 'bottles'>('packs')
	let notes = $state('')
	let showNotes = $state(false)
	let loading = $state(false)
	let confirming = $state(false)
	let justBooked = $state(false)
	let clientId = uuid()
	let confirmTimer: ReturnType<typeof setTimeout> | undefined

	const activeProducts = $derived($products.filter(p => p.active))
	const activeStorages = $derived($storages.filter(s => s.active))
	const product = $derived(activeProducts.find(p => p.id === productId))
	const ps = $derived(product?.pack_size ?? 1)
	const usesPacks = $derived(ps > 1)
	const unitSize = $derived(usesPacks && unit === 'packs' ? ps : 1)
	const bottles = $derived(qty * unitSize)

	const stockOf = (pid: string, sid: string): number => {
		const row = $inventory.find(i => i.product_id === pid && i.storage_id === sid)
		return Math.max(0, (row?.quantity ?? 0) + pendingDelta($outbox, pid, sid))
	}
	const fmtBottles = (n: number, size = ps) => {
		if (size <= 1) return `${n} Fl.`
		const packs = Math.floor(n / size)
		const rem = n % size
		return rem > 0 ? `${packs} Packs + ${rem} Fl.` : `${packs} Packs`
	}
	const shortName = (name: string) => name.replace(/^Saurer Siggi\s*/i, '')

	const srcStock = $derived(product && storageId ? stockOf(productId, storageId) : null)
	const dstStock = $derived(product && toStorageId ? stockOf(productId, toStorageId) : null)
	const newSrc = $derived(srcStock === null ? null : mode === 'add' ? srcStock + bottles : srcStock - bottles)
	const insufficient = $derived(mode !== 'add' && srcStock !== null && bottles > srcStock)
	// Transfers can't exceed the source stock (the server refuses it too); removals may be forced.
	const blocked = $derived(mode === 'transfer' && insufficient)
	const ready = $derived(
		!!product &&
			!!storageId &&
			qty >= 1 &&
			!blocked &&
			(mode !== 'transfer' || (!!toStorageId && toStorageId !== storageId))
	)

	const productTotal = (pid: string) => activeStorages.reduce((n, s) => n + stockOf(pid, s.id), 0)

	// Locations: for removals the ones with stock come first; the last used one leads otherwise.
	const sortedStorages = $derived.by(() => {
		const last = loadPrefsSafe().lastStorage?.[mode]
		const rank = (id: string) => {
			if (mode !== 'add' && productId) return -stockOf(productId, id)
			return id === last ? -1 : 0
		}
		return [...activeStorages].sort((a, b) => rank(a.id) - rank(b.id) || a.name.localeCompare(b.name))
	})
	const loadPrefsSafe = () => (typeof localStorage === 'undefined' ? {} : loadPrefs())

	const chips = $derived(unit === 'packs' && usesPacks ? [1, 2, 3, 5, 10] : usesPacks ? [1, 2, 6, 12, 24] : [1, 2, 5, 10, 20])

	const combos = $derived(
		(($page.data.recent ?? []) as RecentCombo[])
			.filter(c => c.transaction_type === mode)
			.filter(c => activeProducts.some(p => p.id === c.product_id) && activeStorages.some(s => s.id === c.storage_id))
			.filter(c => mode !== 'transfer' || activeStorages.some(s => s.id === c.to_storage_id))
			.slice(0, 5)
	)
	const recentNotes = $derived((($page.data.recentNotes ?? []) as string[]).slice(0, 6))

	function comboLabel(c: RecentCombo) {
		const p = activeProducts.find(x => x.id === c.product_id)!
		const s = activeStorages.find(x => x.id === c.storage_id)!
		const to = activeStorages.find(x => x.id === c.to_storage_id)
		const q = p.pack_size > 1 && c.quantity % p.pack_size === 0 ? `${c.quantity / p.pack_size} Packs` : `${c.quantity} Fl.`
		return `${shortName(p.name)} · ${s.name}${to ? ` → ${to.name}` : ''} · ${q}`
	}

	function applyCombo(c: RecentCombo) {
		haptic()
		productId = c.product_id
		storageId = c.storage_id
		toStorageId = c.to_storage_id ?? ''
		const p = activeProducts.find(x => x.id === c.product_id)!
		if (p.pack_size > 1 && c.quantity % p.pack_size === 0) {
			unit = 'packs'
			qty = c.quantity / p.pack_size
		} else {
			unit = 'bottles'
			qty = c.quantity
		}
		resetConfirm()
	}

	function autoPickStorage() {
		if (!productId) return
		const last = loadPrefs().lastStorage?.[mode]
		if (mode === 'add') {
			if (!storageId && last && activeStorages.some(s => s.id === last)) storageId = last
			return
		}
		if (storageId && stockOf(productId, storageId) > 0) return
		const withStock = activeStorages.filter(s => stockOf(productId, s.id) > 0)
		if (last && withStock.some(s => s.id === last)) storageId = last
		else if (withStock.length === 1) storageId = withStock[0].id
		else if (storageId && withStock.length > 0) storageId = ''
	}

	function pickProduct(id: string) {
		haptic()
		productId = id
		const p = activeProducts.find(x => x.id === id)
		if (p && p.pack_size <= 1) unit = 'bottles'
		else unit = loadPrefs().unit ?? 'packs'
		savePrefs({ lastProduct: id })
		autoPickStorage()
		resetConfirm()
	}

	function pickStorage(id: string) {
		haptic()
		storageId = id
		if (toStorageId === id) toStorageId = ''
		savePrefs({ lastStorage: { ...loadPrefs().lastStorage, [mode]: id } })
		resetConfirm()
	}

	function pickTo(id: string) {
		haptic()
		toStorageId = id
		savePrefs({ lastToStorage: id })
		resetConfirm()
	}

	function setUnit(u: 'packs' | 'bottles') {
		if (u === unit) return
		// Keep the same bottle count when it divides cleanly, otherwise start over at 1.
		const total = bottles
		unit = u
		qty = u === 'packs' ? (total % ps === 0 ? Math.max(1, total / ps) : 1) : total
		savePrefs({ unit: u })
		resetConfirm()
	}

	function setQty(n: number) {
		qty = Math.max(1, Math.min(9999, Math.floor(Number.isFinite(n) ? n : 1)))
		resetConfirm()
	}

	function resetConfirm() {
		confirming = false
		clearTimeout(confirmTimer)
	}

	function addNote(n: string) {
		notes = notes.trim() === n ? '' : n
	}

	function applyDeepLink() {
		const params = $page.url.searchParams
		const prod = params.get('product')?.trim()
		const stor = params.get('storage')?.trim() ?? params.get('from')?.trim()
		const to = params.get('to')?.trim()
		const q = params.get('quantity')
		const n = params.get('notes')?.trim()
		if (!prod && !stor && !to && q == null && !n) return false
		let any = false
		if (prod) {
			const id = resolveProductId(prod, activeProducts)
			if (id) {
				pickProduct(id)
				any = true
			} else toast.error(`Unbekanntes Produkt: ${prod} (SKU oder ID)`)
		}
		for (const [val, apply] of [
			[stor, (id: string) => (storageId = id)],
			[to, (id: string) => (toStorageId = id)]
		] as [string | undefined, (id: string) => void][]) {
			if (!val) continue
			const res = resolveStorageId(val, activeStorages)
			if ('id' in res) {
				apply(res.id)
				any = true
			} else toast.error(res.error)
		}
		if (q) {
			const v = Number.parseInt(q, 10)
			if (Number.isFinite(v) && v >= 1) qty = v
			else toast.error('Ungültige Menge im Link')
		}
		if (n) {
			notes = n
			showNotes = true
		}
		if (any) toast.info('Aus Link vorbelegt — prüfen und buchen')
		return any
	}

	onMount(async () => {
		// On a hard load the layout fills the stores in an effect that runs after this mount.
		await tick()
		const prefs = loadPrefs()
		if (!applyDeepLink()) {
			const last = prefs.lastStorage?.[mode]
			if (mode === 'add' && last && activeStorages.some(s => s.id === last)) storageId = last
			if (mode === 'transfer') {
				if (last && activeStorages.some(s => s.id === last)) storageId = last
				if (prefs.lastToStorage && prefs.lastToStorage !== storageId && activeStorages.some(s => s.id === prefs.lastToStorage))
					toStorageId = prefs.lastToStorage
			}
			if (activeProducts.length === 1) pickProduct(activeProducts[0].id)
		}
	})

	function summary() {
		const q = usesPacks && unit === 'packs' ? `${qty} ${qty === 1 ? 'Pack' : 'Packs'} (${bottles} Fl.)` : `${bottles} Fl.`
		return q
	}

	async function submit() {
		if (!ready || loading) return
		if (insufficient && !confirming) {
			confirming = true
			haptic(30)
			clearTimeout(confirmTimer)
			confirmTimer = setTimeout(() => (confirming = false), 5000)
			return
		}

		loading = true
		const payload: Record<string, unknown> = {
			product_id: productId,
			storage_id: storageId,
			transaction_type: mode,
			quantity: bottles,
			notes: notes.trim() || null
		}
		if (mode === 'transfer') {
			payload.from_storage_id = storageId
			payload.to_storage_id = toStorageId
		}
		const sName = $storages.find(s => s.id === storageId)?.name ?? ''
		const tName = $storages.find(s => s.id === toStorageId)?.name ?? ''
		const label = `${THEME.done}: ${summary()} ${shortName(product!.name)} ${
			mode === 'remove' ? 'aus' : mode === 'add' ? 'in' : 'von'
		} ${sName}${mode === 'transfer' ? ` → ${tName}` : ''}`

		const finish = () => {
			haptic(25)
			justBooked = true
			setTimeout(() => (justBooked = false), 1400)
			qty = 1
			notes = ''
			showNotes = false
			confirming = false
			clientId = uuid()
			document.getElementById('stock-form-top')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
		}

		try {
			if (!$online) throw new TypeError('offline')
			const res = await fetch('/api/transactions', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ ...payload, client_id: clientId, force: insufficient && mode === 'remove' })
			})
			const body = await res.json().catch(() => ({}))
			if (res.status === 401) {
				location.href = '/login'
				return
			}
			if (!res.ok) {
				toast.error(body?.message ?? 'Buchung fehlgeschlagen')
				if (res.status === 409) await invalidateAll()
				return
			}
			finish()
			const id = body.id as string
			toast.success(label, {
				duration: 9000,
				action: {
					label: 'Rückgängig',
					run: async () => {
						const r = await fetch(`/api/transactions/${id}/undo`, { method: 'POST' }).catch(() => null)
						if (r?.ok) {
							toast.info('Buchung rückgängig gemacht')
							await invalidateAll()
						} else toast.error((await r?.json().catch(() => null))?.message ?? 'Rückgängig nicht möglich')
					}
				}
			})
			await invalidateAll()
		} catch (e) {
			if (e instanceof TypeError) {
				// No connection: keep the booking locally, it syncs automatically later.
				enqueue({ client_id: clientId, label, payload, queued_at: Date.now() })
				finish()
				toast.info(`Offline gespeichert — ${label}`, { duration: 5000 })
			} else {
				toast.error(e instanceof Error ? e.message : String(e))
			}
		} finally {
			loading = false
		}
	}

	const tile =
		'min-h-14 rounded-xl bg-white px-3 py-2.5 text-left shadow-sm ring-1 ring-gray-200 transition active:scale-[0.97]'
</script>

<div class="mx-auto flex max-w-md flex-col pb-2 pt-3" id="stock-form-top">
	<!-- Mode switch -->
	<nav class="mb-4 grid grid-cols-3 gap-1 rounded-2xl bg-gray-200/70 p-1" aria-label="Buchungsart">
		{#each TABS as t}
			<a
				href={t.href}
				data-sveltekit-replacestate
				aria-current={t.mode === mode ? 'page' : undefined}
				class="rounded-xl py-2.5 text-center text-sm font-semibold no-underline transition {t.mode === mode
					? THEME.tab
					: 'text-gray-600 hover:text-gray-900'}"
			>
				{t.label}
			</a>
		{/each}
	</nav>

	<!-- Frequent bookings: one tap fills everything -->
	{#if combos.length > 0}
		<section class="mb-4" aria-label="Häufig">
			<p class="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-400">Häufig</p>
			<div class="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
				{#each combos as c}
					<button
						type="button"
						onclick={() => applyCombo(c)}
						class="shrink-0 rounded-full px-3.5 py-2 text-sm font-medium ring-1 transition active:scale-95 {THEME.chip}"
					>
						{comboLabel(c)}
					</button>
				{/each}
			</div>
		</section>
	{/if}

	<!-- Product -->
	<section class="mb-4" aria-label="Produkt">
		<p class="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-400">Produkt</p>
		<div class="grid gap-2 {activeProducts.length > 1 ? 'grid-cols-2' : 'grid-cols-1'}">
			{#each activeProducts as p}
				<button
					type="button"
					aria-pressed={p.id === productId}
					onclick={() => pickProduct(p.id)}
					class="{tile} {p.id === productId ? THEME.sel : ''}"
				>
					<span class="block text-[15px] font-semibold leading-tight text-gray-900">{shortName(p.name)}</span>
					<span class="mt-0.5 block text-xs text-gray-500">
						{p.sku}{p.pack_size > 1 ? ` · ${p.pack_size}er Pack` : ''} · {fmtBottles(productTotal(p.id), p.pack_size)}
					</span>
				</button>
			{/each}
		</div>
		{#if activeProducts.length === 0}
			<p class="rounded-xl bg-white p-4 text-center text-sm text-gray-500 ring-1 ring-gray-200">Noch keine Produkte angelegt.</p>
		{/if}
	</section>

	<!-- Location(s) -->
	<section class="mb-4" aria-label={mode === 'transfer' ? 'Von' : 'Lagerort'}>
		<p class="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
			{mode === 'transfer' ? 'Von' : mode === 'remove' ? 'Aus welchem Lager?' : 'In welches Lager?'}
		</p>
		<div class="grid grid-cols-2 gap-2">
			{#each sortedStorages as s}
				{@const st = productId ? stockOf(productId, s.id) : null}
				{@const dim = mode !== 'add' && st === 0}
				<button
					type="button"
					aria-pressed={s.id === storageId}
					onclick={() => pickStorage(s.id)}
					class="{tile} {s.id === storageId ? THEME.sel : ''} {dim ? 'opacity-50' : ''}"
				>
					<span class="block text-sm font-semibold leading-tight text-gray-900">{s.name}</span>
					<span class="mt-0.5 block text-xs {st === 0 ? 'text-gray-400' : 'text-gray-500'}">
						{#if st === null}
							{s.type === 'warehouse' ? 'Lager' : 'Zuhause'}
						{:else}
							{fmtBottles(st)}
						{/if}
					</span>
				</button>
			{/each}
		</div>
	</section>

	{#if mode === 'transfer'}
		<section class="mb-4" aria-label="Nach">
			<p class="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-400">Nach</p>
			<div class="grid grid-cols-2 gap-2">
				{#each activeStorages.filter(s => s.id !== storageId) as s}
					{@const st = productId ? stockOf(productId, s.id) : null}
					<button
						type="button"
						aria-pressed={s.id === toStorageId}
						onclick={() => pickTo(s.id)}
						class="{tile} {s.id === toStorageId ? THEME.sel : ''}"
					>
						<span class="block text-sm font-semibold leading-tight text-gray-900">{s.name}</span>
						<span class="mt-0.5 block text-xs text-gray-500">{st === null ? (s.type === 'warehouse' ? 'Lager' : 'Zuhause') : fmtBottles(st)}</span>
					</button>
				{/each}
			</div>
		</section>
	{/if}

	<!-- Quantity -->
	<section class="mb-4 rounded-2xl bg-white p-3.5 shadow-sm ring-1 ring-gray-200" aria-label="Menge">
		<div class="mb-2 flex items-center justify-between gap-2">
			<p class="text-[11px] font-semibold uppercase tracking-wide text-gray-400">Menge</p>
			{#if usesPacks}
				<div class="flex rounded-lg bg-gray-100 p-0.5 text-xs font-semibold" role="group" aria-label="Einheit">
					<button type="button" onclick={() => setUnit('packs')} class="rounded-md px-3 py-1.5 transition {unit === 'packs' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}">Packs</button>
					<button type="button" onclick={() => setUnit('bottles')} class="rounded-md px-3 py-1.5 transition {unit === 'bottles' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}">Flaschen</button>
				</div>
			{/if}
		</div>

		<div class="flex items-center gap-3">
			<button
				type="button"
				onclick={() => setQty(qty - 1)}
				disabled={qty <= 1}
				aria-label="Weniger"
				class="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gray-100 text-gray-700 transition active:scale-90 disabled:opacity-40"
			>
				<svg class="h-6 w-6" viewBox="0 0 20 20" fill="currentColor"><path d="M4 10a1 1 0 011-1h10a1 1 0 110 2H5a1 1 0 01-1-1z" /></svg>
			</button>
			<input
				type="number"
				inputmode="numeric"
				pattern="[0-9]*"
				min="1"
				aria-label="Menge"
				value={qty}
				onfocus={e => e.currentTarget.select()}
				oninput={e => {
					const v = e.currentTarget.valueAsNumber
					if (Number.isFinite(v) && v >= 1) setQty(v)
				}}
				onblur={e => (e.currentTarget.value = String(qty))}
				class="h-14 min-w-0 flex-1 rounded-2xl border border-gray-200 bg-gray-50 text-center text-3xl font-bold tabular-nums focus:bg-white focus:ring-2 focus:outline-none {THEME.focus}"
			/>
			<button
				type="button"
				onclick={() => setQty(qty + 1)}
				aria-label="Mehr"
				class="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gray-100 text-gray-700 transition active:scale-90"
			>
				<svg class="h-6 w-6" viewBox="0 0 20 20" fill="currentColor"><path d="M10 4a1 1 0 011 1v4h4a1 1 0 110 2h-4v4a1 1 0 11-2 0v-4H5a1 1 0 110-2h4V5a1 1 0 011-1z" /></svg>
			</button>
		</div>

		<div class="mt-3 flex flex-wrap gap-2">
			{#each chips as c}
				<button
					type="button"
					onclick={() => setQty(c)}
					class="min-w-12 rounded-xl px-3 py-2 text-sm font-semibold ring-1 transition active:scale-95 {qty === c ? THEME.chip : 'bg-white text-gray-600 ring-gray-200'}"
				>
					{c}
				</button>
			{/each}
			{#if mode !== 'add' && srcStock !== null && srcStock >= unitSize}
				<button
					type="button"
					onclick={() => setQty(Math.floor(srcStock / unitSize))}
					class="rounded-xl bg-white px-3 py-2 text-sm font-semibold text-gray-600 ring-1 ring-gray-200 transition active:scale-95"
				>
					Alle
				</button>
			{/if}
		</div>

		{#if srcStock !== null && newSrc !== null}
			<p
				class="mt-3 rounded-xl px-3 py-2 text-sm {insufficient ? 'bg-amber-50 text-amber-900 ring-1 ring-amber-300' : 'bg-gray-50 text-gray-600'}"
				aria-live="polite"
			>
				{#if insufficient}<strong>{blocked ? 'Nicht möglich:' : 'Achtung:'}</strong> Bestand reicht nicht.{' '}{/if}
				{mode === 'transfer' ? 'Quelle' : 'Bestand'}: <strong>{fmtBottles(srcStock)}</strong> →
				<strong class={newSrc < 0 ? 'text-red-600' : ''}>{newSrc < 0 ? `${newSrc} Fl.` : fmtBottles(newSrc)}</strong>
				{#if mode === 'transfer' && dstStock !== null}
					<span class="text-gray-400"> · Ziel: {fmtBottles(dstStock)} → {fmtBottles(dstStock + bottles)}</span>
				{/if}
			</p>
		{/if}
	</section>

	<!-- Notes -->
	<section class="mb-4" aria-label="Notiz">
		{#if !showNotes && !notes}
			<button
				type="button"
				onclick={() => (showNotes = true)}
				class="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-sm text-gray-500 ring-1 ring-dashed ring-gray-300 transition hover:bg-white active:scale-[0.99]"
			>
				<svg class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path d="M10 4a1 1 0 011 1v4h4a1 1 0 110 2h-4v4a1 1 0 11-2 0v-4H5a1 1 0 110-2h4V5a1 1 0 011-1z" /></svg>
				Notiz{mode === 'remove' ? ' (Kunde, Anlass…)' : ''}
			</button>
		{:else}
			<input
				type="text"
				bind:value={notes}
				maxlength="500"
				autocomplete="off"
				placeholder={mode === 'remove' ? 'Kunde, Bar, Anlass…' : 'Notiz'}
				aria-label="Notiz"
				class="w-full rounded-xl border border-gray-200 bg-white px-3.5 py-3 text-base focus:ring-2 focus:outline-none {THEME.focus}"
			/>
			{#if mode === 'remove' && recentNotes.length > 0}
				<div class="mt-2 flex flex-wrap gap-1.5">
					{#each recentNotes as n}
						<button
							type="button"
							onclick={() => addNote(n)}
							class="max-w-full truncate rounded-full px-3 py-1.5 text-xs font-medium ring-1 transition active:scale-95 {notes.trim() === n ? THEME.chip : 'bg-white text-gray-600 ring-gray-200'}"
						>
							{n}
						</button>
					{/each}
				</div>
			{/if}
		{/if}
	</section>

	<!-- Sticky action bar -->
	<div
		class="sticky bottom-0 -mx-4 mt-auto border-t border-gray-200 bg-gray-50/95 px-4 pb-3 pt-3 backdrop-blur"
	>
		<button
			type="button"
			onclick={submit}
			disabled={!ready || loading}
			class="flex h-14 w-full items-center justify-center gap-2 rounded-2xl text-base font-bold text-white shadow-md transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40
				{justBooked ? 'bg-emerald-600' : confirming ? 'bg-amber-500 hover:bg-amber-600' : THEME.btn}"
		>
			{#if loading}
				<span class="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></span> Buche…
			{:else if justBooked}
				<svg class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M16.7 5.3a1 1 0 010 1.4l-7.5 7.5a1 1 0 01-1.4 0L3.3 9.7a1 1 0 111.4-1.4l3.8 3.8 6.8-6.8a1 1 0 011.4 0z" clip-rule="evenodd" /></svg>
				Gebucht
			{:else if blocked}
				Bestand reicht nicht
			{:else if confirming}
				Bestand reicht nicht — nochmal tippen
			{:else if !product}
				Produkt wählen
			{:else if !storageId}
				Lagerort wählen
			{:else if mode === 'transfer' && !toStorageId}
				Ziel wählen
			{:else}
				{summary()} {THEME.verb}
			{/if}
		</button>
		{#if !$online || $outbox.length > 0}
			<p class="mt-1.5 text-center text-xs text-amber-700">
				{!$online ? 'Offline — Buchungen werden gespeichert und später gesendet.' : ''}
				{$outbox.length > 0 ? ($outbox.length === 1 ? '1 Buchung wartet auf Sync.' : `${$outbox.length} Buchungen warten auf Sync.`) : ''}
			</p>
		{/if}
	</div>
</div>
