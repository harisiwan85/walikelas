<script lang="ts">
	import { toasts } from '$lib/client/toast';
</script>

<div class="fixed bottom-4 right-4 z-100 space-y-2">
	{#each $toasts as t (t.id)}
		<div
			class="px-4 py-3 rounded-lg shadow-lg text-sm font-medium text-white max-w-sm
				{ t.type === 'success' ? 'bg-emerald-600' : 'bg-rose-600' }"
		>
			{t.message}
		</div>
	{/each}
</div>
