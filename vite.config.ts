import { sveltekit } from '@sveltejs/kit/vite';
import { SvelteKitPWA } from '@vite-pwa/sveltekit';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [
		sveltekit(),
		tailwindcss(),
		SvelteKitPWA({
			strategies: 'generateSW',
			registerType: 'autoUpdate',
			manifest: {
				name: 'Saurer Siggi Inventory',
				short_name: 'Siggi Inventory',
				description: 'Inventory management for Saurer Siggi Likör',
				theme_color: '#1f2937',
				background_color: '#ffffff',
				display: 'standalone',
				start_url: '/',
				icons: [
					{
						src: '/favicon.svg',
						sizes: '192x192',
						type: 'image/svg+xml'
					}
				]
			},
			workbox: {
				globPatterns: ['**/*.{js,css,html,svg,png,ico,webp,webmanifest}']
			}
		})
	]
});
