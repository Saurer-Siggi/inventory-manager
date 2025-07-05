<script>
	import { goto } from '$app/navigation'
	import { supabase } from '$lib/supabaseClient.js'
	
	let { data } = $props();
	
	let selectedProduct = $state('')
	let selectedFromStorage = $state('')
	let selectedToStorage = $state('')
	let quantity = $state(1)
	let notes = $state('')
	let loading = $state(false)
	let error = $state('')
	
	const handleSubmit = async (e) => {
		e.preventDefault()
		if (!selectedProduct || !selectedFromStorage || !selectedToStorage || quantity <= 0) {
			error = 'Please fill in all required fields with valid values'
			return
		}
		
		if (selectedFromStorage === selectedToStorage) {
			error = 'Source and destination storage locations must be different'
			return
		}
		
		loading = true
		error = ''
		
		try {
			// Insert transaction
			const { error: transactionError } = await supabase
				.from('transactions')
				.insert({
					product_id: selectedProduct,
					storage_id: selectedFromStorage, // This is used for the main storage_id
					transaction_type: 'transfer',
					quantity: quantity,
					from_storage_id: selectedFromStorage,
					to_storage_id: selectedToStorage,
					user_email: data.userEmail,
					notes: notes || null
				})
			
			if (transactionError) {
				error = transactionError.message
			} else {
				// Success - go back to dashboard
				goto('/')
			}
		} catch (e) {
			error = e.message
		} finally {
			loading = false
		}
	}
</script>

<div class="min-h-screen bg-gray-50">
	<div class="container mx-auto px-4 py-8">
		<header class="text-center mb-8">
			<h1 class="text-2xl font-bold text-gray-900 mb-2">Transfer Bottles</h1>
			<p class="text-gray-600">Move stock between storage locations</p>
		</header>
		
		<main class="max-w-md mx-auto">
			{#if error}
				<div class="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
					<p class="text-red-700 text-sm">{error}</p>
				</div>
			{/if}
			
			<div class="bg-white rounded-lg shadow-md p-6">
				<form onsubmit={handleSubmit} class="space-y-4">
					<div>
						<label for="product" class="block text-sm font-medium text-gray-700 mb-1">
							Product *
						</label>
						<select
							id="product"
							bind:value={selectedProduct}
							required
							class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
						>
							<option value="">Select a product</option>
							{#each data.products as product}
								<option value={product.id}>{product.name} ({product.sku})</option>
							{/each}
						</select>
					</div>
					
					<div>
						<label for="from_storage" class="block text-sm font-medium text-gray-700 mb-1">
							From Storage Location *
						</label>
						<select
							id="from_storage"
							bind:value={selectedFromStorage}
							required
							class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
						>
							<option value="">Select source location</option>
							{#each data.storages as storage}
								<option value={storage.id}>{storage.name}</option>
							{/each}
						</select>
					</div>
					
					<div>
						<label for="to_storage" class="block text-sm font-medium text-gray-700 mb-1">
							To Storage Location *
						</label>
						<select
							id="to_storage"
							bind:value={selectedToStorage}
							required
							class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
						>
							<option value="">Select destination location</option>
							{#each data.storages as storage}
								<option value={storage.id}>{storage.name}</option>
							{/each}
						</select>
					</div>
					
					<div>
						<label for="quantity" class="block text-sm font-medium text-gray-700 mb-1">
							Quantity to Transfer *
						</label>
						<input
							type="number"
							id="quantity"
							bind:value={quantity}
							min="1"
							required
							class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
						/>
					</div>
					
					<div>
						<label for="notes" class="block text-sm font-medium text-gray-700 mb-1">
							Notes (Optional)
						</label>
						<textarea
							id="notes"
							bind:value={notes}
							rows="3"
							class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
							placeholder="Reason for transfer, etc."
						></textarea>
					</div>
					
					<div class="flex gap-3">
						<button
							type="button"
							onclick={() => goto('/')}
							class="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
						>
							Cancel
						</button>
						<button
							type="submit"
							disabled={loading}
							class="flex-1 bg-blue-500 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
						>
							{loading ? 'Transferring...' : 'Transfer Bottles'}
						</button>
					</div>
				</form>
			</div>
		</main>
	</div>
</div>