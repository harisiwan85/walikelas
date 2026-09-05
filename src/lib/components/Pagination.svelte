<script lang="ts">
	import Icon from './Icon.svelte';

	let {
		totalItems = 0,
		currentPage = 1,
		pageSize = 10,
		pageSizeOptions = [10, 25, 50, 100],
		showPageSize = true,
		compact = false,
		onPageChange,
		onPageSizeChange
	}: {
		totalItems: number;
		currentPage?: number;
		pageSize?: number;
		pageSizeOptions?: number[];
		showPageSize?: boolean;
		compact?: boolean;
		onPageChange?: (page: number) => void;
		onPageSizeChange?: (size: number) => void;
	} = $props();

	let totalPages = $derived(Math.max(1, Math.ceil(totalItems / (pageSize || 10))));
	let startItem = $derived(totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1);
	let endItem = $derived(Math.min(totalItems, currentPage * pageSize));

	function goTo(p: number) {
		const target = Math.max(1, Math.min(totalPages, p));
		if (target !== currentPage) {
			onPageChange?.(target);
		}
	}

	function handlePageSize(e: Event) {
		const val = Number((e.target as HTMLSelectElement).value) || 10;
		onPageSizeChange?.(val);
		onPageChange?.(1);
	}

	// Buat daftar angka halaman dengan elipsis cerdas
	let visiblePages = $derived.by(() => {
		if (totalPages <= 7) {
			return Array.from({ length: totalPages }, (_, i) => i + 1);
		}
		const pages: (number | 'ellipsis')[] = [];
		pages.push(1);
		if (currentPage > 3) {
			pages.push('ellipsis');
		}
		const start = Math.max(2, currentPage - 1);
		const end = Math.min(totalPages - 1, currentPage + 1);
		for (let i = start; i <= end; i++) {
			pages.push(i);
		}
		if (currentPage < totalPages - 2) {
			pages.push('ellipsis');
		}
		pages.push(totalPages);
		return pages;
	});
</script>

{#if totalItems > 0}
	<div class="flex flex-wrap items-center justify-between gap-3 px-4 py-3 bg-white border-t border-slate-200 text-sm select-none {compact ? 'text-xs' : ''}">
		<!-- Info rentang data & opsi page size -->
		<div class="flex flex-wrap items-center gap-3 text-slate-500">
			<span>
				Menampilkan <b class="text-slate-800 font-semibold">{startItem}</b>–<b class="text-slate-800 font-semibold">{endItem}</b> dari <b class="text-slate-800 font-semibold">{totalItems}</b> data
			</span>

			{#if showPageSize && !compact}
				<div class="flex items-center gap-1.5 pl-2 border-l border-slate-200">
					<span class="text-xs text-slate-400">Tampilkan:</span>
					<select
						value={pageSize}
						onchange={handlePageSize}
						class="text-xs font-medium py-1 px-2 rounded-lg border border-slate-200 bg-slate-50 text-slate-700 hover:bg-white focus:ring-1 focus:ring-indigo-500 cursor-pointer"
					>
						{#each pageSizeOptions as opt}
							<option value={opt}>{opt} / hal</option>
						{/each}
					</select>
				</div>
			{/if}
		</div>

		<!-- Tombol navigasi halaman -->
		{#if totalPages > 1}
			<nav class="flex items-center gap-1 ml-auto" aria-label="Navigasi Halaman">
				<!-- Tombol Pertama -->
				{#if !compact && totalPages > 4}
					<button
						type="button"
						class="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-700 disabled:opacity-30 disabled:pointer-events-none transition-colors"
						onclick={() => goTo(1)}
						disabled={currentPage === 1}
						title="Halaman Pertama"
					>
						<Icon name="chevrons-left" class="w-4 h-4" />
					</button>
				{/if}

				<!-- Tombol Sebelumnya -->
				<button
					type="button"
					class="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900 disabled:opacity-30 disabled:pointer-events-none transition-colors text-xs font-medium cursor-pointer"
					onclick={() => goTo(currentPage - 1)}
					disabled={currentPage === 1}
					title="Halaman Sebelumnya"
				>
					<Icon name="chevron-left" class="w-3.5 h-3.5" />
					{#if !compact}<span class="hidden sm:inline">Sebelumnya</span>{/if}
				</button>

				<!-- Angka Halaman -->
				{#if !compact}
					<div class="flex items-center gap-1 mx-0.5">
						{#each visiblePages as p, idx}
							{#if p === 'ellipsis'}
								<span class="px-2 text-slate-400 text-xs select-none">…</span>
							{:else}
								<button
									type="button"
									class="min-w-[32px] h-8 px-2 rounded-lg text-xs font-semibold transition-all cursor-pointer {currentPage === p
										? 'bg-indigo-600 text-white shadow-sm ring-1 ring-indigo-600'
										: 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 border border-slate-200'}"
									onclick={() => goTo(p as number)}
									aria-current={currentPage === p ? 'page' : undefined}
								>
									{p}
								</button>
							{/if}
						{/each}
					</div>
				{:else}
					<span class="px-2 text-xs font-medium text-slate-600">
						{currentPage} / {totalPages}
					</span>
				{/if}

				<!-- Tombol Selanjutnya -->
				<button
					type="button"
					class="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900 disabled:opacity-30 disabled:pointer-events-none transition-colors text-xs font-medium cursor-pointer"
					onclick={() => goTo(currentPage + 1)}
					disabled={currentPage === totalPages}
					title="Halaman Selanjutnya"
				>
					{#if !compact}<span class="hidden sm:inline">Selanjutnya</span>{/if}
					<Icon name="chevron-right" class="w-3.5 h-3.5" />
				</button>

				<!-- Tombol Terakhir -->
				{#if !compact && totalPages > 4}
					<button
						type="button"
						class="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-700 disabled:opacity-30 disabled:pointer-events-none transition-colors"
						onclick={() => goTo(totalPages)}
						disabled={currentPage === totalPages}
						title="Halaman Terakhir"
					>
						<Icon name="chevrons-right" class="w-4 h-4" />
					</button>
				{/if}
			</nav>
		{/if}
	</div>
{/if}
