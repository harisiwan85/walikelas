<script lang="ts">
	import Icon from './Icon.svelte';

	let {
		icon = 'info',
		title = 'Belum ada data',
		description = '',
		actionLabel = '',
		onAction = () => {},
		compact = false
	}: {
		icon?: string;
		title?: string;
		description?: string;
		actionLabel?: string;
		onAction?: () => void;
		compact?: boolean;
	} = $props();
</script>

<div
	class="flex flex-col items-center justify-center text-center {compact ? 'py-6' : 'py-14'} px-6 rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/60"
>
	<div class="{compact ? 'w-11 h-11' : 'w-16 h-16'} rounded-full bg-indigo-100 flex items-center justify-center text-indigo-500 mb-3">
		<Icon name={icon} class={compact ? 'w-5 h-5' : 'w-7 h-7'} />
	</div>
	<div class="font-semibold text-slate-700 {compact ? 'text-sm' : 'text-base'}">{title}</div>
	{#if description}
		<p class="mt-1 text-sm text-slate-400 max-w-sm">{description}</p>
	{/if}
	{#if actionLabel}
		<button
			class="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 transition-colors cursor-pointer"
			onclick={onAction}
		>
			<Icon name="plus" class="w-4 h-4" />
			{actionLabel}
		</button>
	{/if}
</div>
