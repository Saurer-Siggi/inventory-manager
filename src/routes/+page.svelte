<script>
	import { user, signOut, authLoading } from '$lib/auth.js'
	import { goto } from '$app/navigation'
	import { supabase } from '$lib/supabaseClient.js'
	import { onMount } from 'svelte'
	
	let { data } = $props();
	let inventoryData = $state(data.inventory || [])
	let totals = $state(data.totals || { liköer: 0, klopfer: 0, total: 0 })
	
	// Auth guard is now handled in +layout.svelte
	
	const handleSignOut = async () => {
		await signOut()
		goto('/login')
	}
	
	// Real-time inventory updates
	onMount(() => {
		// Subscribe to inventory changes
		const inventoryChannel = supabase
			.channel('inventory_changes')
			.on(
				'postgres_changes',
				{
					event: 'UPDATE',
					schema: 'public',
					table: 'inventory'
				},
				(payload) => {
					// Refresh inventory data when changes occur
					refreshInventory()
				}
			)
			.on(
				'postgres_changes',
				{
					event: 'INSERT',
					schema: 'public',
					table: 'transactions'
				},
				(payload) => {
					// Refresh inventory data when new transactions are added
					refreshInventory()
				}
			)
			.subscribe()
		
		// Cleanup on unmount
		return () => {
			supabase.removeChannel(inventoryChannel)
		}
	})
	
	const refreshInventory = async () => {
		try {
			// Fetch updated inventory data
			const { data: inventory, error } = await supabase
				.from('inventory_report')
				.select('*')
				.order('product_name, storage_name')
			
			if (!error && inventory) {
				inventoryData = inventory
				
				// Recalculate totals
				const totalLiköer = inventory
					.filter(item => item.sku === 'SSL-001')
					.reduce((sum, item) => sum + item.quantity, 0)
				
				const totalKlopfer = inventory
					.filter(item => item.sku === 'SSK-001')
					.reduce((sum, item) => sum + item.quantity, 0)
				
				totals = {
					liköer: totalLiköer,
					klopfer: totalKlopfer,
					total: totalLiköer + totalKlopfer
				}
			}
		} catch (error) {
			console.error('Error refreshing inventory:', error)
		}
	}

	// Group inventory by storage location
	let groupedInventory = $state({})
	
	// Separate effect for inventory grouping
	$effect(() => {
		if (!inventoryData) {
			groupedInventory = {}
			return
		}
		
		const grouped = {}
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
		
		groupedInventory = grouped
	})

	// Separate effect for collapsed sections initialization
	$effect(() => {
		if (!groupedInventory || Object.keys(groupedInventory).length === 0) {
			return
		}
		
		// Initialize all sections as collapsed by default, but preserve existing state
		const newCollapsedSections = { ...collapsedSections }
		Object.keys(groupedInventory).forEach(storageName => {
			if (newCollapsedSections[storageName] === undefined) {
				newCollapsedSections[storageName] = true
			}
		})
		
		// Only update if there are actually new sections
		if (Object.keys(newCollapsedSections).length !== Object.keys(collapsedSections).length) {
			collapsedSections = newCollapsedSections
		}
	})

	// Get storage type styling
	const getStorageTypeStyle = (type) => {
		return type === 'warehouse' 
			? 'bg-blue-50 border-blue-200 text-blue-900' 
			: 'bg-green-50 border-green-200 text-green-900'
	}

	// Get stock level indicator
	const getStockLevel = (quantity) => {
		if (quantity === 0) return { color: 'bg-red-500', text: 'Empty' }
		if (quantity <= 5) return { color: 'bg-yellow-500', text: 'Low' }
		if (quantity <= 20) return { color: 'bg-blue-500', text: 'Medium' }
		return { color: 'bg-green-500', text: 'High' }
	}

	// Collapsible state for each location
	let collapsedSections = $state({})
</script>

<div class="min-h-screen bg-gray-50">
	<div class="container mx-auto px-4 py-8">
		<header class="text-center mb-8">
			<h1 class="text-xl font-semibold text-gray-800 mb-4">Inventory Management System</h1>
			<div class="flex justify-between items-center mb-4">
				{#if $user}
					<a href="/admin" class="px-3 py-1 text-sm bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors">
						⚙️ Admin
					</a>
				{:else}
					<div></div>
				{/if}
				{#if $user}
					<button
						type="button"
						onclick={handleSignOut}
						class="px-4 py-2 text-sm bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
					>
						Sign Out
					</button>
				{/if}
			</div>
			{#if $user}
				<p class="text-sm text-gray-500 mt-1">Welcome, {$user.email}</p>
			{/if}
			<!-- Connection Status -->
			<div class="mt-2 text-sm {data.error ? 'text-red-600' : 'text-green-600'}">
				{data.connectionStatus || 'Connecting...'}
			</div>
		</header>

		<main class="max-w-md mx-auto">
			{#if data.error}
				<div class="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
					<h3 class="font-medium text-red-900 mb-2">Connection Error</h3>
					<p class="text-red-700 text-sm">{data.error}</p>
					<div class="mt-3 text-xs text-red-600">
						<p>Please check:</p>
						<ul class="list-disc list-inside mt-1">
							<li>Your .env file contains the correct Supabase URL and API key</li>
							<li>The database schema has been applied</li>
							<li>Your Supabase project is running</li>
						</ul>
					</div>
				</div>
			{:else}
				<div class="bg-white rounded-lg shadow-md p-6">
					<h2 class="text-xl font-semibold mb-4">Dashboard</h2>
					<div class="space-y-4">
						<div class="bg-blue-50 p-4 rounded-lg">
							<h3 class="font-medium text-blue-900">Total Inventory</h3>
							<p class="text-2xl font-bold text-blue-700">
								{totals.total} bottles
							</p>
						</div>
						
						<div class="grid grid-cols-2 gap-4">
							<div class="bg-green-50 p-4 rounded-lg text-center">
								<h4 class="font-medium text-green-900">Likör</h4>
								<p class="text-lg font-semibold text-green-700">
									{totals.liköer}
								</p>
							</div>
							<div class="bg-purple-50 p-4 rounded-lg text-center">
								<h4 class="font-medium text-purple-900">Klopfer</h4>
								<p class="text-lg font-semibold text-purple-700">
									{totals.klopfer}
								</p>
							</div>
						</div>
					</div>
				</div>

				<!-- Inventory by Location -->
				{#if inventoryData && inventoryData.length > 0}
					<div class="mt-6">
						<h3 class="text-lg font-semibold mb-4 text-gray-900">Inventory by Location</h3>
						<div class="space-y-4">
							{#each Object.values(groupedInventory).filter(location => location.total_quantity > 0).sort((a, b) => {
								// Sort by storage type first (warehouse before home)
								if (a.storage_type !== b.storage_type) {
									return a.storage_type === 'warehouse' ? -1 : 1
								}
								// Then sort by name within each type
								return a.storage_name.localeCompare(b.storage_name)
							}) as location}
								<div class="bg-white rounded-lg shadow-md border-l-4 {getStorageTypeStyle(location.storage_type).includes('blue') ? 'border-blue-500' : 'border-green-500'} overflow-hidden">
									<!-- Location Header -->
									<button 
										class="w-full p-4 {getStorageTypeStyle(location.storage_type)} text-left hover:opacity-90 transition-opacity"
										onclick={() => collapsedSections[location.storage_name] = !collapsedSections[location.storage_name]}
									>
										<div class="flex justify-between items-center">
											<div>
												<h4 class="font-semibold text-lg">{location.storage_name}</h4>
												<p class="text-sm opacity-75">
													{location.storage_type === 'warehouse' ? '🏭 Warehouse' : '🏠 Home'}
												</p>
											</div>
											<div class="text-right flex items-center space-x-3">
												<div>
													<p class="text-2xl font-bold">{location.total_quantity}</p>
													<p class="text-sm opacity-75">total bottles</p>
												</div>
												<div class="transform transition-transform {collapsedSections[location.storage_name] ? 'rotate-180' : ''}">
													<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
														<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
													</svg>
												</div>
											</div>
										</div>
									</button>
									
									<!-- Products in Location -->
									{#if !collapsedSections[location.storage_name]}
										<div class="p-4">
											<div class="space-y-3">
												{#each location.items as item}
													<div class="flex justify-between items-center py-2 border-b border-gray-100 last:border-b-0">
														<div class="flex items-center space-x-3">
															<div class="w-2 h-2 rounded-full {getStockLevel(item.quantity).color}"></div>
															<div>
																<p class="font-medium text-gray-900">{item.product_name}</p>
																<p class="text-xs text-gray-500">{item.sku}</p>
															</div>
														</div>
														<div class="text-right">
															<p class="font-semibold text-gray-900">{item.quantity}</p>
															<p class="text-xs text-gray-500">{getStockLevel(item.quantity).text}</p>
														</div>
													</div>
												{/each}
											</div>
										</div>
									{/if}
								</div>
							{/each}
						</div>
					</div>
				{/if}

				<div class="mt-6 grid grid-cols-2 gap-4">
					<a href="/remove" class="bg-red-500 text-white px-4 py-3 rounded-lg font-medium hover:bg-red-600 transition-colors text-center">
						Remove Bottles
					</a>
					<a href="/add" class="bg-green-500 text-white px-4 py-3 rounded-lg font-medium hover:bg-green-600 transition-colors text-center">
						Add Bottles
					</a>
				</div>
				
				<div class="mt-4">
					<a href="/transfer" class="block w-full bg-blue-500 text-white px-4 py-3 rounded-lg font-medium hover:bg-blue-600 transition-colors text-center">
						Transfer Bottles
					</a>
				</div>
			{/if}
		</main>
	</div>
</div>
