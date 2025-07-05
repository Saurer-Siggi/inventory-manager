<div class="min-h-screen bg-gray-50">
	<div class="container mx-auto px-4 py-8">
		<header class="text-center mb-8">
			<h1 class="text-3xl font-bold text-gray-900 mb-2">Saurer Siggi Inventory</h1>
			<p class="text-gray-600">Inventory Management System</p>
		</header>

		<main class="max-w-md mx-auto">
			<div class="bg-white rounded-lg shadow-md p-6">
				<h2 class="text-xl font-semibold mb-4">Dashboard</h2>
				<div class="space-y-4">
					<div class="bg-blue-50 p-4 rounded-lg">
						<h3 class="font-medium text-blue-900">Total Inventory</h3>
						<p class="text-2xl font-bold text-blue-700">Loading...</p>
					</div>
					
					<div class="grid grid-cols-2 gap-4">
						<div class="bg-green-50 p-4 rounded-lg text-center">
							<h4 class="font-medium text-green-900">Likör</h4>
							<p class="text-lg font-semibold text-green-700">--</p>
						</div>
						<div class="bg-purple-50 p-4 rounded-lg text-center">
							<h4 class="font-medium text-purple-900">Klopfer</h4>
							<p class="text-lg font-semibold text-purple-700">--</p>
						</div>
					</div>
				</div>
			</div>

			<div class="mt-6 grid grid-cols-2 gap-4">
				<button class="bg-red-500 text-white px-4 py-3 rounded-lg font-medium hover:bg-red-600 transition-colors">
					Remove Bottles
				</button>
				<button class="bg-green-500 text-white px-4 py-3 rounded-lg font-medium hover:bg-green-600 transition-colors">
					Add Bottles
				</button>
			</div>
			
			<div class="mt-4">
				<button class="w-full bg-blue-500 text-white px-4 py-3 rounded-lg font-medium hover:bg-blue-600 transition-colors">
					Transfer Bottles
				</button>
			</div>
		</main>
	</div>
</div>
