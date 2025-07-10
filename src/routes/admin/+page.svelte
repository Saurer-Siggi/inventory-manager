<script>
	import { goto } from '$app/navigation'
	import { supabase } from '$lib/supabaseClient.js'
	import { user } from '$lib/auth.js'
	import { onMount } from 'svelte'
	
	let { data } = $props()
	
	let activeTab = $state('products')
	let loading = $state(false)
	let error = $state('')
	let success = $state('')
	
	// Client-side data loading for dropdowns
	let products = $state(data.products || [])
	let storages = $state(data.storages || [])
	let transactions = $state([])
	let stockAlerts = $state([])
	let dataLoading = $state(false)
	
	// Load dropdown data and enhanced transactions client-side
	onMount(async () => {
		try {
			dataLoading = true
			
			// Load products and storages if not already loaded
			if (!data.products || data.products.length === 0) {
				const { data: productsData, error: productsError } = await supabase
					.from('products')
					.select('*')
					.order('sku')
				
				if (productsError) {
					console.error('Products error:', productsError)
				} else {
					products = productsData || []
				}
			}
			
			if (!data.storages || data.storages.length === 0) {
				const { data: storagesData, error: storagesError } = await supabase
					.from('storages')
					.select('*')
					.order('name')
				
				if (storagesError) {
					console.error('Storages error:', storagesError)
				} else {
					storages = storagesData || []
				}
			}
			
			// Load transactions with proper joins
			await loadTransactions()
			
			// Load stock alerts
			await loadStockAlerts()
			
		} catch (err) {
			console.error('Data loading error:', err)
			error = 'Failed to load data: ' + String(err)
		} finally {
			dataLoading = false
		}
	})
	
	// Load transactions with manual joins to avoid relationship issues
	const loadTransactions = async () => {
		try {
			// First get raw transactions
			const { data: rawTransactions, error: transactionsError } = await supabase
				.from('transactions')
				.select('*')
				.order('created_at', { ascending: false })
				.limit(50)
			
			if (transactionsError) {
				console.error('Transactions error:', transactionsError)
				return
			}
			
			// Then manually join with products and storages
			const enhancedTransactions = rawTransactions.map(transaction => {
				const product = products.find(p => p.id === transaction.product_id)
				const storage = storages.find(s => s.id === transaction.storage_id)
				const fromStorage = transaction.from_storage_id 
					? storages.find(s => s.id === transaction.from_storage_id)
					: null
				const toStorage = transaction.to_storage_id 
					? storages.find(s => s.id === transaction.to_storage_id)
					: null
				
				return {
					...transaction,
					product_name: product?.name || 'Unknown Product',
					product_sku: product?.sku || 'Unknown',
					storage_name: storage?.name || 'Unknown Storage',
					from_storage_name: fromStorage?.name || null,
					to_storage_name: toStorage?.name || null
				}
			})
			
			transactions = enhancedTransactions
		} catch (err) {
			console.error('Error loading transactions:', err)
		}
	}
	
	// Load stock alerts with manual joins
	const loadStockAlerts = async () => {
		try {
			const { data: rawAlerts, error: alertsError } = await supabase
				.from('stock_alerts')
				.select('*')
				.order('created_at', { ascending: false })
			
			if (alertsError) {
				console.error('Stock alerts error:', alertsError)
				return
			}
			
			// Manually join with products and storages
			const enhancedAlerts = rawAlerts.map(alert => {
				const product = products.find(p => p.id === alert.product_id)
				const storage = storages.find(s => s.id === alert.storage_id)
				
				return {
					...alert,
					product_name: product?.name || 'Unknown Product',
					product_sku: product?.sku || 'Unknown',
					storage_name: storage?.name || 'Unknown Storage'
				}
			})
			
			stockAlerts = enhancedAlerts
		} catch (err) {
			console.error('Error loading stock alerts:', err)
		}
	}
	
	// Form states
	let productForm = $state({
		id: null,
		sku: '',
		name: '',
		description: '',
		unit_size: '',
		pack_size: 1,
		active: true
	})
	
	let storageForm = $state({
		id: null,
		name: '',
		type: 'warehouse',
		location_details: '',
		active: true
	})
	
	let inventoryForm = $state({
		product_id: '',
		storage_id: '',
		quantity: 0,
		notes: 'Admin correction'
	})
	
	let alertForm = $state({
		id: null,
		product_id: '',
		storage_id: '',
		threshold: 5,
		active: true
	})
	
	
	// Reset forms
	const resetProductForm = () => {
		productForm = {
			id: null,
			sku: '',
			name: '',
			description: '',
			unit_size: '',
			pack_size: 1,
			active: true
		}
	}
	
	const resetStorageForm = () => {
		storageForm = {
			id: null,
			name: '',
			type: 'warehouse',
			location_details: '',
			active: true
		}
	}
	
	const resetInventoryForm = () => {
		inventoryForm = {
			product_id: '',
			storage_id: '',
			quantity: 0,
			notes: 'Admin correction'
		}
	}
	
	const resetAlertForm = () => {
		alertForm = {
			id: null,
			product_id: '',
			storage_id: '',
			threshold: 5,
			active: true
		}
	}
	
	
	// Product operations
	const saveProduct = async () => {
		if (!productForm.sku || !productForm.name || !productForm.unit_size) {
			error = 'Please fill in all required fields'
			return
		}
		
		loading = true
		error = ''
		success = ''
		
		try {
			if (productForm.id) {
				// Update existing product
				const { error: updateError } = await supabase
					.from('products')
					.update({
						sku: productForm.sku,
						name: productForm.name,
						description: productForm.description,
						unit_size: productForm.unit_size,
						pack_size: productForm.pack_size,
						active: productForm.active
					})
					.eq('id', productForm.id)
				
				if (updateError) throw updateError
				success = 'Product updated successfully'
			} else {
				// Create new product
				const { error: insertError } = await supabase
					.from('products')
					.insert({
						sku: productForm.sku,
						name: productForm.name,
						description: productForm.description,
						unit_size: productForm.unit_size,
						pack_size: productForm.pack_size,
						active: productForm.active
					})
				
				if (insertError) throw insertError
				success = 'Product created successfully'
			}
			
			resetProductForm()
			// Refresh client-side data
			const { data: updatedProducts } = await supabase
				.from('products')
				.select('*')
				.order('sku')
			products = updatedProducts || []
			
		} catch (e) {
			error = e.message
		} finally {
			loading = false
		}
	}
	
	const editProduct = (product) => {
		productForm = {
			id: product.id,
			sku: product.sku,
			name: product.name,
			description: product.description || '',
			unit_size: product.unit_size,
			pack_size: product.pack_size,
			active: product.active
		}
	}
	
	// Storage operations
	const saveStorage = async () => {
		if (!storageForm.name || !storageForm.type) {
			error = 'Please fill in all required fields'
			return
		}
		
		loading = true
		error = ''
		success = ''
		
		try {
			if (storageForm.id) {
				// Update existing storage
				const { error: updateError } = await supabase
					.from('storages')
					.update({
						name: storageForm.name,
						type: storageForm.type,
						location_details: storageForm.location_details,
						active: storageForm.active
					})
					.eq('id', storageForm.id)
				
				if (updateError) throw updateError
				success = 'Storage location updated successfully'
			} else {
				// Create new storage
				const { error: insertError } = await supabase
					.from('storages')
					.insert({
						name: storageForm.name,
						type: storageForm.type,
						location_details: storageForm.location_details,
						active: storageForm.active
					})
				
				if (insertError) throw insertError
				success = 'Storage location created successfully'
			}
			
			resetStorageForm()
			// Refresh client-side data
			const { data: updatedStorages } = await supabase
				.from('storages')
				.select('*')
				.order('name')
			storages = updatedStorages || []
			
		} catch (e) {
			error = e.message
		} finally {
			loading = false
		}
	}
	
	const editStorage = (storage) => {
		storageForm = {
			id: storage.id,
			name: storage.name,
			type: storage.type,
			location_details: storage.location_details || '',
			active: storage.active
		}
	}
	
	// Inventory correction
	const correctInventory = async () => {
		if (!inventoryForm.product_id || !inventoryForm.storage_id) {
			error = 'Please select both product and storage location'
			return
		}
		
		loading = true
		error = ''
		success = ''
		
		try {
			// Get current inventory
			const { data: currentInventory, error: inventoryError } = await supabase
				.from('inventory')
				.select('quantity')
				.eq('product_id', inventoryForm.product_id)
				.eq('storage_id', inventoryForm.storage_id)
				.single()
			
			if (inventoryError) throw inventoryError
			
			const currentQuantity = currentInventory.quantity
			const newQuantity = parseInt(inventoryForm.quantity)
			const difference = newQuantity - currentQuantity
			
			if (difference !== 0) {
				// Create correction transaction
				const { error: transactionError } = await supabase
					.from('transactions')
					.insert({
						product_id: inventoryForm.product_id,
						storage_id: inventoryForm.storage_id,
						transaction_type: difference > 0 ? 'add' : 'remove',
						quantity: Math.abs(difference),
						user_email: $user?.email,
						notes: inventoryForm.notes + ` (${currentQuantity} → ${newQuantity})`
					})
				
				if (transactionError) throw transactionError
				success = `Inventory corrected: ${difference > 0 ? '+' : ''}${difference} bottles`
			} else {
				success = 'No correction needed - quantities match'
			}
			
			resetInventoryForm()
			// Refresh inventory data and transactions
			const { data: updatedInventory } = await supabase
				.from('inventory_report')
				.select('*')
				.order('product_name, storage_name')
			data.inventory = updatedInventory || []
			
			// Reload transactions
			await loadTransactions()
			
		} catch (e) {
			error = e.message
		} finally {
			loading = false
		}
	}
	
	// Stock alert operations
	const saveAlert = async () => {
		if (!alertForm.product_id || !alertForm.storage_id || alertForm.threshold < 0) {
			error = 'Please select both product and storage location, and set a valid threshold'
			return
		}
		
		loading = true
		error = ''
		success = ''
		
		try {
			if (alertForm.id) {
				// Update existing alert
				const { error: updateError } = await supabase
					.from('stock_alerts')
					.update({
						product_id: alertForm.product_id,
						storage_id: alertForm.storage_id,
						threshold: alertForm.threshold,
						active: alertForm.active
					})
					.eq('id', alertForm.id)
				
				if (updateError) throw updateError
				success = 'Stock alert updated successfully'
			} else {
				// Create new alert
				const { error: insertError } = await supabase
					.from('stock_alerts')
					.insert({
						product_id: alertForm.product_id,
						storage_id: alertForm.storage_id,
						threshold: alertForm.threshold,
						active: alertForm.active
					})
				
				if (insertError) {
					if (insertError.code === '23505') {
						error = 'An alert already exists for this product and storage combination'
					} else {
						throw insertError
					}
				} else {
					success = 'Stock alert created successfully'
				}
			}
			
			if (success) {
				resetAlertForm()
				await loadStockAlerts()
			}
			
		} catch (e) {
			error = e.message
		} finally {
			loading = false
		}
	}
	
	const editAlert = (alert) => {
		alertForm = {
			id: alert.id,
			product_id: alert.product_id,
			storage_id: alert.storage_id,
			threshold: alert.threshold,
			active: alert.active
		}
	}
	
	const deleteAlert = async (alertId) => {
		if (!confirm('Are you sure you want to delete this alert?')) return
		
		loading = true
		error = ''
		success = ''
		
		try {
			const { error: deleteError } = await supabase
				.from('stock_alerts')
				.delete()
				.eq('id', alertId)
			
			if (deleteError) throw deleteError
			
			success = 'Stock alert deleted successfully'
			await loadStockAlerts()
			
		} catch (e) {
			error = e.message
		} finally {
			loading = false
		}
	}
	
	
	// Format date
	const formatDate = (dateString) => {
		return new Date(dateString).toLocaleString()
	}
	
	// Get current inventory for selected product/storage
	const getCurrentInventory = () => {
		if (!inventoryForm.product_id || !inventoryForm.storage_id) return null
		
		const inventoryItem = data.inventory.find(item => {
			// Need to match by IDs since we're comparing with form values
			const product = products.find(p => p.id === inventoryForm.product_id)
			const storage = storages.find(s => s.id === inventoryForm.storage_id)
			
			return item.sku === product?.sku && item.storage_name === storage?.name
		})
		
		return inventoryItem ? inventoryItem.quantity : 0
	}
	
	// Clear messages when switching tabs
	const setActiveTab = (tab) => {
		activeTab = tab
		error = ''
		success = ''
	}
</script>

<div class="min-h-screen bg-gray-50">
	<div class="container mx-auto px-4 py-8">
		<header class="text-center mb-8">
			<div class="flex justify-between items-center mb-4">
				<h1 class="text-3xl font-bold text-gray-900">Admin Panel</h1>
				<button
					type="button"
					onclick={() => goto('/')}
					class="px-4 py-2 text-sm bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
				>
					← Back to Dashboard
				</button>
			</div>
			<p class="text-gray-600">System Administration & Corrections</p>
			{#if $user}
				<p class="text-sm text-gray-500 mt-1">Logged in as: {$user.email}</p>
			{/if}
		</header>

		<main class="max-w-6xl mx-auto">
			{#if data.error}
				<div class="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
					<h3 class="font-medium text-red-900 mb-2">Data Loading Error</h3>
					<p class="text-red-700 text-sm">{data.error}</p>
				</div>
			{/if}
			
			{#if error}
				<div class="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
					<p class="text-red-700 text-sm">{error}</p>
				</div>
			{/if}
			
			{#if success}
				<div class="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
					<p class="text-green-700 text-sm">{success}</p>
				</div>
			{/if}
			
			<!-- Tab Navigation -->
			<div class="mb-8">
				<nav class="flex space-x-8" aria-label="Tabs">
					<button
						onclick={() => setActiveTab('products')}
						class="whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm {activeTab === 'products' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}"
					>
						Products
					</button>
					<button
						onclick={() => setActiveTab('storages')}
						class="whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm {activeTab === 'storages' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}"
					>
						Storage Locations
					</button>
					<button
						onclick={() => setActiveTab('inventory')}
						class="whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm {activeTab === 'inventory' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}"
					>
						Inventory Corrections
					</button>
					<button
						onclick={() => setActiveTab('transactions')}
						class="whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm {activeTab === 'transactions' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}"
					>
						Transaction History
					</button>
					<button
						onclick={() => setActiveTab('alerts')}
						class="whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm {activeTab === 'alerts' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}"
					>
						Stock Alerts
					</button>
				</nav>
			</div>

			<!-- Products Tab -->
			{#if activeTab === 'products'}
				<div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
					<!-- Product Form -->
					<div class="bg-white rounded-lg shadow-md p-6">
						<h2 class="text-xl font-semibold mb-4">
							{productForm.id ? 'Edit Product' : 'Add New Product'}
						</h2>
						
						<form class="space-y-4">
							<div>
								<label class="block text-sm font-medium text-gray-700 mb-1">SKU *</label>
								<input
									type="text"
									bind:value={productForm.sku}
									class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
									placeholder="e.g., SSL-001"
								/>
							</div>
							
							<div>
								<label class="block text-sm font-medium text-gray-700 mb-1">Name *</label>
								<input
									type="text"
									bind:value={productForm.name}
									class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
									placeholder="Product name"
								/>
							</div>
							
							<div>
								<label class="block text-sm font-medium text-gray-700 mb-1">Description</label>
								<textarea
									bind:value={productForm.description}
									class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
									rows="3"
								></textarea>
							</div>
							
							<div>
								<label class="block text-sm font-medium text-gray-700 mb-1">Unit Size *</label>
								<input
									type="text"
									bind:value={productForm.unit_size}
									class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
									placeholder="e.g., 500ml"
								/>
							</div>
							
							<div>
								<label class="block text-sm font-medium text-gray-700 mb-1">Pack Size</label>
								<input
									type="number"
									bind:value={productForm.pack_size}
									min="1"
									class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
								/>
							</div>
							
							<div class="flex items-center">
								<input
									type="checkbox"
									bind:checked={productForm.active}
									id="product-active"
									class="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
								/>
								<label for="product-active" class="ml-2 block text-sm text-gray-700">
									Active
								</label>
							</div>
							
							<div class="flex gap-3">
								<button
									type="button"
									onclick={resetProductForm}
									class="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
								>
									Reset
								</button>
								<button
									type="button"
									onclick={saveProduct}
									disabled={loading}
									class="flex-1 bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 disabled:opacity-50"
								>
									{loading ? 'Saving...' : productForm.id ? 'Update' : 'Create'}
								</button>
							</div>
						</form>
					</div>
					
					<!-- Products List -->
					<div class="bg-white rounded-lg shadow-md p-6">
						<h2 class="text-xl font-semibold mb-4">Existing Products</h2>
						<div class="space-y-3">
							{#each products as product}
								<div class="border rounded-lg p-4 {product.active ? 'bg-white' : 'bg-gray-50'}">
									<div class="flex justify-between items-start mb-2">
										<div>
											<h3 class="font-medium text-gray-900">{product.name}</h3>
											<p class="text-sm text-gray-600">SKU: {product.sku}</p>
										</div>
										<div class="flex gap-2">
											<button
												onclick={() => editProduct(product)}
												class="text-blue-600 hover:text-blue-800 text-sm"
											>
												Edit
											</button>
											<span class="text-sm {product.active ? 'text-green-600' : 'text-gray-400'}">
												{product.active ? 'Active' : 'Inactive'}
											</span>
										</div>
									</div>
									<p class="text-sm text-gray-600">{product.unit_size} • Pack of {product.pack_size}</p>
									{#if product.description}
										<p class="text-sm text-gray-500 mt-1">{product.description}</p>
									{/if}
								</div>
							{/each}
						</div>
					</div>
				</div>
			{/if}

			<!-- Storage Locations Tab -->
			{#if activeTab === 'storages'}
				<div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
					<!-- Storage Form -->
					<div class="bg-white rounded-lg shadow-md p-6">
						<h2 class="text-xl font-semibold mb-4">
							{storageForm.id ? 'Edit Storage Location' : 'Add New Storage Location'}
						</h2>
						
						<form class="space-y-4">
							<div>
								<label class="block text-sm font-medium text-gray-700 mb-1">Name *</label>
								<input
									type="text"
									bind:value={storageForm.name}
									class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
									placeholder="Storage location name"
								/>
							</div>
							
							<div>
								<label class="block text-sm font-medium text-gray-700 mb-1">Type *</label>
								<select
									bind:value={storageForm.type}
									class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
								>
									<option value="warehouse">Warehouse</option>
									<option value="home">Home</option>
								</select>
							</div>
							
							<div>
								<label class="block text-sm font-medium text-gray-700 mb-1">Location Details</label>
								<textarea
									bind:value={storageForm.location_details}
									class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
									rows="3"
									placeholder="Additional location information"
								></textarea>
							</div>
							
							<div class="flex items-center">
								<input
									type="checkbox"
									bind:checked={storageForm.active}
									id="storage-active"
									class="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
								/>
								<label for="storage-active" class="ml-2 block text-sm text-gray-700">
									Active
								</label>
							</div>
							
							<div class="flex gap-3">
								<button
									type="button"
									onclick={resetStorageForm}
									class="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
								>
									Reset
								</button>
								<button
									type="button"
									onclick={saveStorage}
									disabled={loading}
									class="flex-1 bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 disabled:opacity-50"
								>
									{loading ? 'Saving...' : storageForm.id ? 'Update' : 'Create'}
								</button>
							</div>
						</form>
					</div>
					
					<!-- Storage Locations List -->
					<div class="bg-white rounded-lg shadow-md p-6">
						<h2 class="text-xl font-semibold mb-4">Existing Storage Locations</h2>
						<div class="space-y-3">
							{#each storages as storage}
								<div class="border rounded-lg p-4 {storage.active ? 'bg-white' : 'bg-gray-50'}">
									<div class="flex justify-between items-start mb-2">
										<div>
											<h3 class="font-medium text-gray-900">{storage.name}</h3>
											<p class="text-sm text-gray-600 capitalize">{storage.type}</p>
										</div>
										<div class="flex gap-2">
											<button
												onclick={() => editStorage(storage)}
												class="text-blue-600 hover:text-blue-800 text-sm"
											>
												Edit
											</button>
											<span class="text-sm {storage.active ? 'text-green-600' : 'text-gray-400'}">
												{storage.active ? 'Active' : 'Inactive'}
											</span>
										</div>
									</div>
									{#if storage.location_details}
										<p class="text-sm text-gray-500">{storage.location_details}</p>
									{/if}
								</div>
							{/each}
						</div>
					</div>
				</div>
			{/if}

			<!-- Inventory Corrections Tab -->
			{#if activeTab === 'inventory'}
				<div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
					<!-- Correction Form -->
					<div class="bg-white rounded-lg shadow-md p-6">
						<h2 class="text-xl font-semibold mb-4">Direct Inventory Correction</h2>
						<p class="text-sm text-gray-600 mb-4">
							Use this to correct inventory discrepancies. This will create a transaction to adjust the inventory to the specified quantity.
						</p>
						
						<form class="space-y-4">
							<div>
								<label class="block text-sm font-medium text-gray-700 mb-1">Product *</label>
								<select
									bind:value={inventoryForm.product_id}
									class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
								>
									<option value="">Select a product</option>
																{#each products.filter(p => p.active) as product}
								<option value={product.id}>{product.name} ({product.sku})</option>
							{/each}
								</select>
							</div>
							
							<div>
								<label class="block text-sm font-medium text-gray-700 mb-1">Storage Location *</label>
								<select
									bind:value={inventoryForm.storage_id}
									class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
								>
									<option value="">Select a storage location</option>
																{#each storages.filter(s => s.active) as storage}
								<option value={storage.id}>{storage.name}</option>
							{/each}
								</select>
							</div>
							
							{#if inventoryForm.product_id && inventoryForm.storage_id}
								<div class="bg-gray-50 p-3 rounded-lg">
									<p class="text-sm text-gray-600">
										Current Inventory: <span class="font-medium">{getCurrentInventory()} bottles</span>
									</p>
								</div>
							{/if}
							
							<div>
								<label class="block text-sm font-medium text-gray-700 mb-1">Correct Quantity To *</label>
								<input
									type="number"
									bind:value={inventoryForm.quantity}
									min="0"
									class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
									placeholder="Enter correct quantity"
								/>
							</div>
							
							<div>
								<label class="block text-sm font-medium text-gray-700 mb-1">Notes</label>
								<textarea
									bind:value={inventoryForm.notes}
									class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
									rows="3"
									placeholder="Reason for correction"
								></textarea>
							</div>
							
							<div class="flex gap-3">
								<button
									type="button"
									onclick={resetInventoryForm}
									class="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
								>
									Reset
								</button>
								<button
									type="button"
									onclick={correctInventory}
									disabled={loading}
									class="flex-1 bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-red-600 disabled:opacity-50"
								>
									{loading ? 'Correcting...' : 'Apply Correction'}
								</button>
							</div>
						</form>
					</div>
					
					<!-- Current Inventory Overview -->
					<div class="bg-white rounded-lg shadow-md p-6">
						<h2 class="text-xl font-semibold mb-4">Current Inventory</h2>
						<div class="space-y-3">
							{#each data.inventory as item}
								<div class="border rounded-lg p-4">
									<div class="flex justify-between items-center">
										<div>
											<h3 class="font-medium text-gray-900">{item.product_name}</h3>
											<p class="text-sm text-gray-600">{item.storage_name}</p>
										</div>
										<div class="text-right">
											<p class="text-lg font-semibold text-gray-900">{item.quantity}</p>
											<p class="text-sm text-gray-500">bottles</p>
										</div>
									</div>
								</div>
							{/each}
						</div>
					</div>
				</div>
			{/if}

			<!-- Transaction History Tab -->
			{#if activeTab === 'transactions'}
				<div class="bg-white rounded-lg shadow-md p-6">
					<h2 class="text-xl font-semibold mb-4">Recent Transactions (Last 50)</h2>
					<div class="overflow-x-auto">
						<table class="min-w-full divide-y divide-gray-200">
							<thead class="bg-gray-50">
								<tr>
									<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
										Date
									</th>
									<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
										Type
									</th>
									<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
										Product
									</th>
									<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
										Location
									</th>
									<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
										Quantity
									</th>
									<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
										User
									</th>
									<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
										Notes
									</th>
								</tr>
							</thead>
							<tbody class="bg-white divide-y divide-gray-200">
															{#each transactions as transaction}
								<tr>
									<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
										{formatDate(transaction.created_at)}
									</td>
									<td class="px-6 py-4 whitespace-nowrap">
										<span class="px-2 py-1 text-xs font-medium rounded-full {
											transaction.transaction_type === 'add' ? 'bg-green-100 text-green-800' :
											transaction.transaction_type === 'remove' ? 'bg-red-100 text-red-800' :
											'bg-blue-100 text-blue-800'
										}">
											{transaction.transaction_type}
										</span>
									</td>
									<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
										{transaction.product_name}
									</td>
									<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
										{#if transaction.transaction_type === 'transfer'}
											{transaction.from_storage_name || 'Unknown'} → {transaction.to_storage_name || 'Unknown'}
										{:else}
											{transaction.storage_name}
										{/if}
									</td>
									<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
										{transaction.quantity}
									</td>
									<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
										{transaction.user_email}
									</td>
									<td class="px-6 py-4 text-sm text-gray-900">
										{transaction.notes || '-'}
									</td>
								</tr>
							{/each}
							</tbody>
						</table>
					</div>
				</div>
			{/if}

			<!-- Stock Alerts Tab -->
			{#if activeTab === 'alerts'}
				<div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
					<!-- Alert Form -->
					<div class="bg-white rounded-lg shadow-md p-6">
						<h2 class="text-xl font-semibold mb-4">
							{alertForm.id ? 'Edit Stock Alert' : 'Add New Stock Alert'}
						</h2>
						<p class="text-sm text-gray-600 mb-4">
							Set up alerts to be notified when inventory drops below specified thresholds.
						</p>
						
						<form class="space-y-4">
							<div>
								<label class="block text-sm font-medium text-gray-700 mb-1">Product *</label>
								<select
									bind:value={alertForm.product_id}
									class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
								>
									<option value="">Select a product</option>
									{#each products.filter(p => p.active) as product}
										<option value={product.id}>{product.name} ({product.sku})</option>
									{/each}
								</select>
							</div>
							
							<div>
								<label class="block text-sm font-medium text-gray-700 mb-1">Storage Location *</label>
								<select
									bind:value={alertForm.storage_id}
									class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
								>
									<option value="">Select a storage location</option>
									{#each storages.filter(s => s.active) as storage}
										<option value={storage.id}>{storage.name}</option>
									{/each}
								</select>
							</div>
							
							<div>
								<label class="block text-sm font-medium text-gray-700 mb-1">Alert Threshold *</label>
								<input
									type="number"
									bind:value={alertForm.threshold}
									min="0"
									class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
									placeholder="Alert when stock drops below this number"
								/>
								<p class="text-xs text-gray-500 mt-1">
									Alert will trigger when inventory is at or below this quantity
								</p>
							</div>
							
							<div class="flex items-center">
								<input
									type="checkbox"
									bind:checked={alertForm.active}
									id="alert-active"
									class="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
								/>
								<label for="alert-active" class="ml-2 block text-sm text-gray-700">
									Active
								</label>
							</div>
							
							<div class="flex gap-3">
								<button
									type="button"
									onclick={resetAlertForm}
									class="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
								>
									Reset
								</button>
								<button
									type="button"
									onclick={saveAlert}
									disabled={loading}
									class="flex-1 bg-orange-500 text-white px-4 py-2 rounded-lg hover:bg-orange-600 disabled:opacity-50"
								>
									{loading ? 'Saving...' : alertForm.id ? 'Update Alert' : 'Create Alert'}
								</button>
							</div>
						</form>
					</div>
					
					<!-- Alerts List -->
					<div class="bg-white rounded-lg shadow-md p-6">
						<h2 class="text-xl font-semibold mb-4">Existing Stock Alerts</h2>
						<div class="space-y-3">
							{#each stockAlerts as alert}
								<div class="border rounded-lg p-4 {alert.active ? 'bg-white' : 'bg-gray-50'}">
									<div class="flex justify-between items-start mb-2">
										<div>
											<h3 class="font-medium text-gray-900">{alert.product_name}</h3>
											<p class="text-sm text-gray-600">{alert.storage_name}</p>
										</div>
										<div class="flex gap-2">
											<button
												onclick={() => editAlert(alert)}
												class="text-blue-600 hover:text-blue-800 text-sm"
											>
												Edit
											</button>
											<button
												onclick={() => deleteAlert(alert.id)}
												class="text-red-600 hover:text-red-800 text-sm"
											>
												Delete
											</button>
										</div>
									</div>
									<div class="flex justify-between items-center">
										<div>
											<p class="text-sm text-gray-600">
												Alert when ≤ <span class="font-semibold">{alert.threshold}</span> bottles
											</p>
											<p class="text-xs text-gray-500">SKU: {alert.product_sku}</p>
										</div>
										<span class="text-sm {alert.active ? 'text-green-600' : 'text-gray-400'}">
											{alert.active ? 'Active' : 'Inactive'}
										</span>
									</div>
								</div>
							{:else}
								<div class="text-center py-8 text-gray-500">
									<p>No stock alerts configured yet.</p>
									<p class="text-sm mt-1">Create your first alert to get notified about low stock levels.</p>
								</div>
							{/each}
						</div>
					</div>
				</div>
			{/if}

		</main>
	</div>
</div> 