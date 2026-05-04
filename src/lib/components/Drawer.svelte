<script lang="ts">
	import { type Snippet } from 'svelte'

	let {
		open = false,
		title = '',
		onclose,
		children
	}: {
		open?: boolean
		title?: string
		onclose?: () => void
		children?: Snippet
	} = $props()

	const handleBackdropClick = (e: MouseEvent) => {
		if (e.target === e.currentTarget) onclose?.()
	}

	const handleKeydown = (e: KeyboardEvent) => {
		if (e.key === 'Escape') onclose?.()
	}
</script>

<svelte:window onkeydown={handleKeydown} />

{#if open}
	<!-- Backdrop -->
	<div
		class="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
		role="button"
		tabindex="-1"
		aria-label="Close"
		onclick={handleBackdropClick}
		onkeydown={e => e.key === 'Enter' && onclose?.()}
	></div>

	<!-- Panel: slides up from bottom on mobile, slides in from right on sm+ -->
	<div
		class="fixed inset-x-0 bottom-0 z-50 flex max-h-[92dvh] flex-col rounded-t-2xl bg-white shadow-2xl sm:inset-y-0 sm:right-0 sm:left-auto sm:w-[420px] sm:max-h-none sm:rounded-none sm:rounded-l-2xl"
		style="padding-bottom: env(safe-area-inset-bottom, 0px);"
		role="dialog"
		aria-modal="true"
		aria-label={title}
	>
		<!-- Handle bar (mobile only) -->
		<div class="flex shrink-0 justify-center pb-1 pt-2.5 sm:hidden">
			<div class="h-1 w-10 rounded-full bg-gray-300"></div>
		</div>

		<!-- Header -->
		<div class="flex shrink-0 items-center justify-between border-b border-gray-100 px-4 py-3">
			<h2 class="text-base font-semibold text-gray-900">{title}</h2>
			<button
				type="button"
				class="flex h-8 w-8 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100 hover:text-gray-900"
				onclick={onclose}
				aria-label="Close"
			>
				<svg class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
					<path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
				</svg>
			</button>
		</div>

		<!-- Content -->
		<div class="min-h-0 flex-1 overflow-y-auto px-4 py-4">
			{@render children?.()}
		</div>
	</div>
{/if}
