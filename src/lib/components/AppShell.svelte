<script lang="ts">
	import type { Snippet } from 'svelte'
	import { page } from '$app/stores'

	import { online, outbox, syncing } from '$lib/outbox.js'

	let {
		children,
		isAdmin = false,
		alertCount = 0
	}: { children: Snippet; isAdmin?: boolean; alertCount?: number } = $props()

	const path = $derived($page.url.pathname)

	type NavItem = {
		href: string
		label: string
		match: (p: string) => boolean
		icon: 'home' | 'remove' | 'add' | 'transfer' | 'history'
	}

	const items: NavItem[] = [
		{ href: '/', label: 'Bestand', match: p => p === '/', icon: 'home' },
		{ href: '/remove', label: 'Aus', match: p => p.startsWith('/remove'), icon: 'remove' },
		{ href: '/add', label: 'Ein', match: p => p.startsWith('/add'), icon: 'add' },
		{ href: '/transfer', label: 'Umlagern', match: p => p.startsWith('/transfer'), icon: 'transfer' },
		{ href: '/history', label: 'Verlauf', match: p => p.startsWith('/history'), icon: 'history' }
	]
	const activeColor = { home: 'text-blue-600', remove: 'text-red-600', add: 'text-green-600', transfer: 'text-blue-600', history: 'text-blue-600' }
	const activeBg = { home: 'bg-blue-50', remove: 'bg-red-50', add: 'bg-green-50', transfer: 'bg-blue-50', history: 'bg-blue-50' }

	const iconClass = 'h-[22px] w-[22px] shrink-0 sm:h-6 sm:w-6'
</script>

<div class="app-shell flex h-dvh max-h-dvh flex-col overflow-hidden bg-gray-50">
	<!-- Header -->
	<header
		class="flex shrink-0 items-center justify-between border-b border-gray-100 bg-white px-4 py-2.5 shadow-sm"
		style="padding-top: max(0.625rem, env(safe-area-inset-top, 0px)); padding-left: max(1rem, env(safe-area-inset-left, 0px)); padding-right: max(1rem, env(safe-area-inset-right, 0px));"
	>
		<div class="flex items-center gap-2">
			<div class="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-600">
				<svg class="h-4 w-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
					<path stroke-linecap="round" stroke-linejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
				</svg>
			</div>
			<span class="text-sm font-semibold text-gray-800">Siggi Inventar</span>
		</div>
		{#if isAdmin}
			<div class="flex shrink-0 items-center gap-0.5">
				<a
					href="/alerts"
					class="relative flex h-9 w-9 items-center justify-center rounded-full text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900 {path.startsWith('/alerts') ? 'bg-blue-50 text-blue-600' : ''}"
					aria-label="Warnungen{alertCount ? ` (${alertCount})` : ''}"
					title="Warnungen"
				>
					<svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<path stroke-linecap="round" stroke-linejoin="round" d="M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0" />
					</svg>
					{#if alertCount > 0}
						<span class="absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">{alertCount}</span>
					{/if}
				</a>
				<a
					href="/locations"
					class="flex h-9 w-9 items-center justify-center rounded-full text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900 {path.startsWith('/locations') ? 'bg-blue-50 text-blue-600' : ''}"
					aria-label="Lagerorte"
					title="Lagerorte"
				>
					<svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<path stroke-linecap="round" stroke-linejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
					</svg>
				</a>
				<a
					href="/admin"
					class="flex h-9 w-9 items-center justify-center rounded-full text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900 {path.startsWith('/admin') ? 'bg-blue-50 text-blue-600' : ''}"
					aria-label="Produkte & Einstellungen"
					title="Produkte & Einstellungen"
				>
					<svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
						/>
						<path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
					</svg>
				</a>
			</div>
		{:else}
			<span class="h-8 w-8" aria-hidden="true"></span>
		{/if}
	</header>

	{#if !$online || $outbox.length > 0}
		<div
			class="flex shrink-0 items-center justify-center gap-2 bg-amber-100 px-4 py-1.5 text-xs font-medium text-amber-900"
			role="status"
		>
			{#if $syncing}
				<span class="h-3 w-3 animate-spin rounded-full border-2 border-amber-700 border-t-transparent"></span>
				Synchronisiere…
			{:else if !$online}
				Offline{$outbox.length ? ` · ${$outbox.length} Buchung${$outbox.length > 1 ? 'en' : ''} gespeichert` : ' — Ansicht aus dem Zwischenspeicher'}
			{:else}
				{$outbox.length === 1 ? '1 Buchung wartet' : `${$outbox.length} Buchungen warten`} auf Sync
			{/if}
		</div>
	{/if}

	<!-- Main content -->
	<div
		class="min-h-0 flex-1 overflow-x-hidden overflow-y-auto"
		style="padding-left: max(1rem, env(safe-area-inset-left, 0px)); padding-right: max(1rem, env(safe-area-inset-right, 0px));"
	>
		{@render children()}
	</div>

	<!-- Bottom nav -->
	<nav
		class="flex shrink-0 items-end justify-around border-t border-gray-200 bg-white shadow-[0_-4px_20px_rgba(0,0,0,0.06)]"
		style="padding-bottom: max(0.35rem, env(safe-area-inset-bottom, 0px)); padding-left: env(safe-area-inset-left, 0px); padding-right: env(safe-area-inset-right, 0px);"
		aria-label="Hauptnavigation"
	>
		{#each items as item}
			{@const active = item.match(path)}
			<a
				href={item.href}
				aria-current={active ? 'page' : undefined}
				class="flex min-w-0 flex-1 flex-col items-center gap-0.5 px-1 pb-1.5 pt-2 text-[10px] font-medium no-underline transition-colors sm:text-xs
					{active ? activeColor[item.icon] : 'text-gray-500 hover:text-gray-800'}"
			>
				<span
					class="flex h-8 w-12 items-center justify-center rounded-full transition-colors {active ? activeBg[item.icon] : ''}"
					aria-hidden="true"
				>
					<svg class={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
						{#if item.icon === 'home'}
							<path d="M3 10.5 12 4l9 6.5V20a1 1 0 01-1 1h-5v-6H9v6H4a1 1 0 01-1-1v-9.5Z" />
						{:else if item.icon === 'remove'}
							<circle cx="12" cy="12" r="9" /><path d="M9 12h6" />
						{:else if item.icon === 'add'}
							<circle cx="12" cy="12" r="9" /><path d="M12 9v6M9 12h6" />
						{:else if item.icon === 'transfer'}
							<path d="M7.5 21 3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5M16.5 3 21 7.5m0 0L16.5 12" />
						{:else}
							<path d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
						{/if}
					</svg>
				</span>
				<span class="max-w-full truncate px-0.5">{item.label}</span>
			</a>
		{/each}
	</nav>
</div>
