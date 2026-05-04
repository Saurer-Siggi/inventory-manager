import { sveltekit } from '@sveltejs/kit/vite';
import { SvelteKitPWA } from '@vite-pwa/sveltekit';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	server: {
		host: '0.0.0.0',
		port: 3000
	},
	preview: {
		host: '0.0.0.0',
		port: 3000
	},
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
				scope: '/',
				icons: [
					{
						src: '/pwa-icon.png',
						sizes: '192x192',
						type: 'image/png',
						purpose: 'any maskable'
					}
				]
			},
			workbox: {
				// Empty map skips @vite-pwa/sveltekit's buildGlobPatterns(), which otherwise appends
				// prerendered/**/*.{html,json} and triggers a workbox warning when nothing is prerendered.
				modifyURLPrefix: {},
				globPatterns: ['**/*.{js,css,html,svg,png,ico,webp,webmanifest}']
			}
		})
	]
});
