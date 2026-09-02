<script lang="ts">
	import { STATUS_LABEL } from '$lib/types';
	let { status }: { status: string } = $props();
</script>

<span class="badge-{status}">{STATUS_LABEL[status as keyof typeof STATUS_LABEL] ?? status}</span>
