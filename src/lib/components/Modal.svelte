<script lang="ts">
	let {
		open,
		title,
		onclose,
		children
	}: {
		open: boolean;
		title: string;
		onclose: () => void;
		children: import('svelte').Snippet;
	} = $props();
</script>

	{#if open}
		<div
			class="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 overflow-y-auto"
			onclick={onclose}
			onkeydown={(e) => e.key === 'Escape' && onclose()}
			role="presentation"
		>
			<div
				class="card w-full max-w-xl my-8"
				onclick={(e: MouseEvent) => e.stopPropagation()}
				role="dialog"
				aria-modal="true"
			>
			<div class="flex items-center justify-between border-b border-slate-200 px-5 py-4">
				<h3 class="text-lg font-semibold">{title}</h3>
				<button
					class="text-slate-400 hover:text-slate-600 text-2xl leading-none cursor-pointer"
					onclick={onclose}
					aria-label="Tutup"
				>×</button>
			</div>
			<div class="p-5">{@render children()}</div>
		</div>
	</div>
{/if}
