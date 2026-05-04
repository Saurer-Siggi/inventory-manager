<script lang="ts">
	import { supabase } from '$lib/supabaseClient.js'
	import { onMount } from 'svelte'

	type Row = {
		id: string
		created_at: string
		transaction_type: string
		quantity: number
		user_email: string | null
		notes: string | null
		product_name: string
		storage_name: string
		from_storage_name: string | null
		to_storage_name: string | null
	}

	let loading = $state(true)
	let transactions = $state<Row[]>([])

	const formatDate = (d: string) => new Date(d).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' })

	onMount(async () => {
		try {
			const [{ data: products }, { data: storages }, { data: raw }] = await Promise.all([
				supabase.from('products').select('id, name'),
				supabase.from('storages').select('id, name'),
				supabase.from('transactions').select('*').order('created_at', { ascending: false }).limit(80)
			])
			const pmap = new Map((products ?? []).map(p => [p.id, p.name as string]))
			const smap = new Map((storages ?? []).map(s => [s.id, s.name as string]))
			transactions = (raw ?? []).map(t => ({
				id: t.id,
				created_at: t.created_at,
				transaction_type: t.transaction_type,
				quantity: t.quantity,
				user_email: t.user_email,
				notes: t.notes,
				product_name: pmap.get(t.product_id) ?? 'Unknown',
				storage_name: smap.get(t.storage_id) ?? 'Unknown',
				from_storage_name: t.from_storage_id ? (smap.get(t.from_storage_id) ?? null) : null,
				to_storage_name: t.to_storage_id ? (smap.get(t.to_storage_id) ?? null) : null
			}))
		} catch (e) {
			console.error(e)
		} finally {
			loading = false
		}
	})
</script>

<div class="mx-auto max-w-2xl pb-6 pt-3">
	<h1 class="mb-1 text-lg font-bold text-gray-900">History</h1>
	<p class="mb-4 text-xs text-gray-500">Latest 80 transactions.</p>

	{#if loading}
		<div class="flex justify-center py-12">
			<div class="h-8 w-8 animate-spin rounded-full border-2 border-blue-400 border-t-transparent"></div>
		</div>
	{:else if transactions.length === 0}
		<p class="rounded-xl bg-white py-10 text-center text-sm text-gray-500 shadow-sm ring-1 ring-gray-100">No transactions yet.</p>
	{:else}
		<div class="space-y-2 md:hidden">
			{#each transactions as t}
				<div class="rounded-xl bg-white p-3.5 text-sm shadow-sm ring-1 ring-gray-100">
					<div class="flex items-start justify-between gap-2">
						<span class="text-xs text-gray-400">{formatDate(t.created_at)}</span>
						<span
							class="shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold {t.transaction_type === 'add'
								? 'bg-green-100 text-green-700'
								: t.transaction_type === 'remove'
									? 'bg-red-100 text-red-700'
									: 'bg-blue-100 text-blue-700'}"
						>
							{t.transaction_type}
						</span>
					</div>
					<p class="mt-1.5 font-semibold text-gray-900">{t.product_name}</p>
					<p class="text-xs text-gray-500">
						{#if t.transaction_type === 'transfer'}
							{t.from_storage_name ?? '?'} → {t.to_storage_name ?? '?'}
						{:else}
							{t.storage_name}
						{/if}
					</p>
					<p class="mt-1 text-xs text-gray-500">
						Qty <span class="font-semibold text-gray-800">{t.quantity}</span>
						· {t.user_email ?? '—'}
					</p>
					{#if t.notes}
						<p class="mt-2 border-t border-gray-100 pt-2 text-xs break-words text-gray-500">{t.notes}</p>
					{/if}
				</div>
			{/each}
		</div>

		<div class="hidden overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-gray-100 md:block">
			<div class="overflow-x-auto">
				<table class="w-full min-w-[640px] divide-y divide-gray-100 text-sm">
					<thead class="bg-gray-50">
						<tr>
							{#each ['Date', 'Type', 'Product', 'Location', 'Qty', 'User', 'Notes'] as col}
								<th class="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-gray-400">{col}</th>
							{/each}
						</tr>
					</thead>
					<tbody class="divide-y divide-gray-50">
						{#each transactions as t}
							<tr class="hover:bg-gray-50/50">
								<td class="whitespace-nowrap px-4 py-3 text-gray-700">{formatDate(t.created_at)}</td>
								<td class="whitespace-nowrap px-4 py-3">
									<span
										class="rounded-full px-2 py-0.5 text-xs font-semibold {t.transaction_type === 'add'
											? 'bg-green-100 text-green-700'
											: t.transaction_type === 'remove'
												? 'bg-red-100 text-red-700'
												: 'bg-blue-100 text-blue-700'}"
									>
										{t.transaction_type}
									</span>
								</td>
								<td class="whitespace-nowrap px-4 py-3 font-medium text-gray-900">{t.product_name}</td>
								<td class="whitespace-nowrap px-4 py-3 text-gray-700">
									{#if t.transaction_type === 'transfer'}
										{t.from_storage_name ?? '?'} → {t.to_storage_name ?? '?'}
									{:else}
										{t.storage_name}
									{/if}
								</td>
								<td class="whitespace-nowrap px-4 py-3 font-semibold text-gray-900">{t.quantity}</td>
								<td class="whitespace-nowrap px-4 py-3 text-gray-500">{t.user_email ?? '—'}</td>
								<td class="max-w-xs px-4 py-3 break-words text-gray-500">{t.notes ?? '—'}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		</div>
	{/if}
</div>
