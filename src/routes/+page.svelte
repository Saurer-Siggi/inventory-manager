<script>
	import { user, signOut } from '$lib/auth.js'
	import { goto } from '$app/navigation'
	import { supabase } from '$lib/supabaseClient.js'
	import { onMount } from 'svelte'
	
	let { data } = $props();
	let inventoryData = $state(data.inventory || [])
	let totals = $state(data.totals || { liköer: 0, klopfer: 0, total: 0 })
	
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
</script>

<div class="min-h-screen bg-gray-50">
	<div class="container mx-auto px-4 py-8">
		<header class="text-center mb-8">
			<div class="flex justify-between items-center mb-4">
				<h1 class="text-3xl font-bold text-gray-900">Saurer Siggi Inventory</h1>
				{#if $user}
					<button
						on:click={handleSignOut}
						class="px-4 py-2 text-sm bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
					>
						Sign Out
					</button>
				{/if}
			</div>
			<p class="text-gray-600">Inventory Management System</p>
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

				<!-- Inventory Details -->
				{#if inventoryData && inventoryData.length > 0}
					<div class="bg-white rounded-lg shadow-md p-6 mt-6">
						<h3 class="text-lg font-semibold mb-4">Inventory by Location</h3>
						<div class="space-y-3">
							{#each inventoryData as item}
								<div class="flex justify-between items-center py-2 border-b border-gray-100">
									<div>
										<p class="font-medium text-gray-900">{item.product_name}</p>
										<p class="text-sm text-gray-600">{item.storage_name}</p>
									</div>
									<div class="text-right">
										<p class="font-semibold text-gray-900">{item.quantity}</p>
									</div>
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
