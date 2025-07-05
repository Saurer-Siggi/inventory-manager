<script>
	import '../app.css';
	import { onMount } from 'svelte'
	import { initAuth } from '$lib/auth.js'
	
	onMount(() => {
		initAuth()
	})
</script>

<slot />