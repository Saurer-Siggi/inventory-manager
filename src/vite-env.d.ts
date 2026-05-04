/// <reference types="vite-plugin-pwa/client" />
/// <reference types="@vite-pwa/sveltekit/configuration" />

declare module 'virtual:pwa-info' {
	export interface PwaInfo {
		webManifest: { href: string; useCredentials: boolean; linkTag: string }
	}
	export const pwaInfo: PwaInfo | undefined
}

declare module 'virtual:pwa-register' {
	type RegisterSWOptions = {
		immediate?: boolean
		onRegistered?: (sw: ServiceWorkerRegistration | undefined) => void
		onRegisterError?: (error: unknown) => void
		onOfflineReady?: () => void
		onNeedRefresh?: () => void
	}
	export function registerSW(options?: RegisterSWOptions): (reloadPage?: boolean) => void
}
