<script>
	import { goto } from '$app/navigation'
	import { supabase } from '$lib/supabaseClient.js'
	import { user } from '$lib/auth.js'
	import { onMount } from 'svelte'
	
	let { data } = $props();
	
	let selectedProduct = $state('')
	let selectedStorage = $state('')
	let quantity = $state(1)
	let notes = $state('')
	let loading = $state(false)
	let error = $state('')
	
	// Client-side data loading
	let products = $state([])
	let storages = $state([])
	let dataLoading = $state(true)
	let dataError = $state('')
	
	// Load data client-side after mount
	onMount(async () => {
		try {
			// Fetch products
			const { data: productsData, error: productsError } = await supabase
				.from('products')
				.select('*')
				.eq('active', true)
				.order('sku')

			if (productsError) {
				console.error('Products error:', productsError)
				dataError = 'Failed to load products: ' + productsError.message
				return
			}

			// Fetch storage locations
			const { data: storagesData, error: storagesError } = await supabase
				.from('storages')
				.select('*')
				.eq('active', true)
				.order('name')

			if (storagesError) {
				console.error('Storages error:', storagesError)
				dataError = 'Failed to load storages: ' + storagesError.message
				return
			}

			products = productsData || []
			storages = storagesData || []
			console.log('Loaded products:', $state.snapshot(products))
			console.log('Loaded storages:', $state.snapshot(storages))
		} catch (err) {
			console.error('Data loading error:', err)
			dataError = 'Failed to load data: ' + err.message
		} finally {
			dataLoading = false
		}
	})
	
	const handleSubmit = async (e) => {
		e.preventDefault()
		if (!selectedProduct || !selectedStorage || quantity <= 0) {
			error = 'Please fill in all required fields with valid values'
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
					storage_id: selectedStorage,
					transaction_type: 'add',
					quantity: quantity,
					user_email: $user?.email,
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
			<h1 class="text-2xl font-bold text-gray-900 mb-2">Add Bottles</h1>
			<p class="text-gray-600">Record new deliveries and restocking</p>
		</header>
		
		<main class="max-w-md mx-auto">
			{#if data.error}
				<div class="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
					<h3 class="font-medium text-red-900 mb-2">Data Loading Error</h3>
					<p class="text-red-700 text-sm">{data.error}</p>
					<p class="text-red-600 text-xs mt-2">Check console for details</p>
				</div>
			{/if}
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
							class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
						>
							<option value="">Select a product</option>
							{#each products as product}
								<option value={product.id}>{product.name} ({product.sku})</option>
							{/each}
						</select>
					</div>
					
					<div>
						<label for="storage" class="block text-sm font-medium text-gray-700 mb-1">
							Storage Location *
						</label>
						<select
							id="storage"
							bind:value={selectedStorage}
							required
							class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
						>
							<option value="">Select a storage location</option>
							{#each storages as storage}
								<option value={storage.id}>{storage.name}</option>
							{/each}
						</select>
					</div>
					
					<div>
						<label for="quantity" class="block text-sm font-medium text-gray-700 mb-1">
							Quantity to Add *
						</label>
						<input
							type="number"
							id="quantity"
							bind:value={quantity}
							min="1"
							required
							class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
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
							class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
							placeholder="Delivery details, batch info, etc."
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
							class="flex-1 bg-green-500 text-white px-4 py-2 rounded-lg font-medium hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
						>
							{loading ? 'Adding...' : 'Add Bottles'}
						</button>
					</div>
				</form>
			</div>
		</main>
	</div>
</div>