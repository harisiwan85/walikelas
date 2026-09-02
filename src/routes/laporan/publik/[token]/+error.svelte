<script lang="ts">
	import { page } from '$app/stores';
</script>

<svelte:head><title>Link Tidak Tersedia</title></svelte:head>

<div class="min-h-screen bg-slate-100 flex items-center justify-center p-6">
	<div class="max-w-md w-full card p-8 text-center space-y-3">
		<div class="mx-auto w-16 h-16 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center">
			<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-8 h-8">
				<circle cx="12" cy="12" r="10" />
				<line x1="12" y1="8" x2="12" y2="12" />
				<line x1="12" y1="16" x2="12.01" y2="16" />
			</svg>
		</div>
		<h1 class="text-lg font-bold text-slate-900">
			{$page.status === 410 ? 'Link Kedaluwarsa' : 'Link Tidak Valid'}
		</h1>
		<p class="text-sm text-slate-500">{$page.error?.message ?? 'Link laporan tidak dapat dibuka.'}</p>
		<a href="/login" class="btn-primary inline-flex items-center justify-center mt-2">Masuk Aplikasi</a>
	</div>
</div>
