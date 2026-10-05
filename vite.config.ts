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
				name: 'Saurer Siggi Inventar',
				short_name: 'Siggi Inventar',
				description: 'Lagerbestand für Saurer Siggi Likör & Klopfer',
				lang: 'de',
				categories: ['business', 'productivity'],
				shortcuts: [
					{ name: 'Ausbuchen', short_name: 'Aus', url: '/remove', icons: [{ src: '/pwa-icon.png', sizes: '192x192' }] },
					{ name: 'Einbuchen', short_name: 'Ein', url: '/add', icons: [{ src: '/pwa-icon.png', sizes: '192x192' }] },
					{ name: 'Umlagern', short_name: 'Umlagern', url: '/transfer', icons: [{ src: '/pwa-icon.png', sizes: '192x192' }] }
				],
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
				globPatterns: ['**/*.{js,css,html,svg,png,ico,webp,webmanifest}'],
				// The app is server-rendered, so pages are cached at runtime: network first (always fresh stock
				// when online), falling back to the last seen copy after 3 s / when offline.
				navigateFallback: null,
				runtimeCaching: [
					{
						urlPattern: ({ request, url }: { request: Request; url: URL }) =>
							url.origin === self.location.origin &&
							!url.pathname.startsWith('/api/') &&
							!url.pathname.startsWith('/logout') &&
							(request.mode === 'navigate' || (request.headers.get('accept') ?? '').includes('text/html')),
						handler: 'NetworkFirst',
						options: { cacheName: 'pages', networkTimeoutSeconds: 3, expiration: { maxEntries: 30 } }
					},
					{
						urlPattern: ({ url }: { url: URL }) => url.pathname.endsWith('/__data.json'),
						handler: 'NetworkFirst',
						options: { cacheName: 'page-data', networkTimeoutSeconds: 3, expiration: { maxEntries: 30 } }
					}
				]
			}
		})
	]
});
