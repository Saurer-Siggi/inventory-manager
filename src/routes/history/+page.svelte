<script lang="ts">
	import { invalidateAll } from '$app/navigation'
	import { toast } from '$lib/components/toast.js'

	let { data } = $props()

	const transactions = $derived(data.transactions ?? [])
	let busy = $state<string | null>(null)

	const formatDate = (d: string) => new Date(d).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' })
	const typeLabel = { add: 'Eingebucht', remove: 'Ausgebucht', transfer: 'Umgelagert' } as Record<string, string>
	const typeClass = (t: string) =>
		t === 'add' ? 'bg-green-100 text-green-700' : t === 'remove' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'

	// A booking can be undone once; the server rejects undoing an undo or a repeat.
	const canUndo = (t: (typeof transactions)[number]) => !t.reverts_id && !t.reverted

	async function undo(id: string) {
		if (busy || !confirm('Diese Buchung rückgängig machen?')) return
		busy = id
		try {
			const res = await fetch(`/api/transactions/${id}/undo`, { method: 'POST' })
			if (res.ok) {
				toast.info('Buchung rückgängig gemacht')
				await invalidateAll()
			} else toast.error((await res.json().catch(() => null))?.message ?? 'Rückgängig nicht möglich')
		} catch {
			toast.error('Keine Verbindung')
		} finally {
			busy = null
		}
	}
</script>

<svelte:head><title>Verlauf · Siggi Inventar</title></svelte:head>

<div class="mx-auto max-w-2xl pb-6 pt-3">
	<h1 class="mb-1 text-lg font-bold text-gray-900">Verlauf</h1>
	<p class="mb-4 text-xs text-gray-500">Die letzten 80 Buchungen.</p>

	{#if transactions.length === 0}
		<p class="rounded-xl bg-white py-10 text-center text-sm text-gray-500 shadow-sm ring-1 ring-gray-100">Noch keine Buchungen.</p>
	{:else}
		<ul class="space-y-2">
			{#each transactions as t (t.id)}
				<li class="rounded-xl bg-white p-3.5 text-sm shadow-sm ring-1 ring-gray-100 {t.reverted ? 'opacity-60' : ''}">
					<div class="flex items-start justify-between gap-2">
						<span class="text-xs text-gray-400">{formatDate(t.created_at)}</span>
						<span class="shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold {typeClass(t.transaction_type)}">
							{t.reverts_id ? 'Rückbuchung' : typeLabel[t.transaction_type] ?? t.transaction_type}
						</span>
					</div>
					<div class="mt-1.5 flex items-end justify-between gap-3">
						<div class="min-w-0">
							<p class="font-semibold text-gray-900 {t.reverted ? 'line-through' : ''}">{t.product_name}</p>
							<p class="text-xs text-gray-500">
								{#if t.transaction_type === 'transfer'}
									{t.from_storage_name ?? '?'} → {t.to_storage_name ?? '?'}
								{:else}
									{t.storage_name}
								{/if}
							</p>
						</div>
						<p class="shrink-0 text-lg font-bold tabular-nums text-gray-900">
							{t.transaction_type === 'remove' ? '−' : t.transaction_type === 'add' ? '+' : '⇄'}{t.quantity}
							<span class="text-xs font-medium text-gray-400">Fl.</span>
						</p>
					</div>
					{#if t.notes}
						<p class="mt-2 border-t border-gray-100 pt-2 text-xs break-words text-gray-500">{t.notes}</p>
					{/if}
					{#if t.reverted}
						<p class="mt-1 text-xs font-medium text-gray-400">Rückgängig gemacht</p>
					{:else if canUndo(t)}
						<button
							type="button"
							onclick={() => undo(t.id)}
							disabled={busy === t.id}
							class="mt-2 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-gray-500 ring-1 ring-gray-200 transition hover:bg-gray-50 active:scale-95 disabled:opacity-50"
						>
							Rückgängig
						</button>
					{/if}
				</li>
			{/each}
		</ul>
	{/if}
</div>
