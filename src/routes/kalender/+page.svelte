<script lang="ts">
	import type { Holiday } from '$lib/types';
	import { api } from '$lib/client/api';
	import { toast } from '$lib/client/toast';
	import Icon from '$lib/components/Icon.svelte';
	import Pagination from '$lib/components/Pagination.svelte';
	import { formatDateId } from '$lib/date';

	let { data }: { data: { holidays: Holiday[] } } = $props();
	const { holidays: initial } = data;

	let holidays = $state<Holiday[]>(initial);
	let page = $state(1);
	let pageSize = $state(10);
	let paginated = $derived(holidays.slice((page - 1) * pageSize, page * pageSize));

	let form = $state({ tanggal: '', keterangan: '', tipe: 'libur' });
	let showForm = $state(false);

	async function refresh() {
		holidays = await api<Holiday[]>('/api/calendar');
	}

	async function submit() {
		if (!form.tanggal) {
			toast('Tanggal wajib diisi', 'error');
			return;
		}
		try {
			await api('/api/calendar', { method: 'POST', body: JSON.stringify(form) });
			toast('Kalender akademik diperbarui');
			showForm = false;
			form = { tanggal: '', keterangan: '', tipe: 'libur' };
			await refresh();
		} catch (e: any) {
			toast(e.message, 'error');
		}
	}

	let selected = $state<Set<number>>(new Set());
	let bulkBusy = $state(false);

	function toggleSelect(id: number) {
		const next = new Set(selected);
		if (next.has(id)) next.delete(id);
		else next.add(id);
		selected = next;
	}

	function toggleSelectAll() {
		const allInPage = paginated.length > 0 && paginated.every((h) => selected.has(h.id));
		const next = new Set(selected);
		if (allInPage) {
			paginated.forEach((h) => next.delete(h.id));
		} else {
			paginated.forEach((h) => next.add(h.id));
		}
		selected = next;
	}

	function selectAllFiltered() {
		selected = new Set(holidays.map((h) => h.id));
	}

	async function hapus(h: Holiday) {
		if (!confirm(`Hapus entri ${formatDateId(h.tanggal)}?`)) return;
		try {
			await api(`/api/calendar/${h.id}`, { method: 'DELETE' });
			toast('Entri dihapus');
			await refresh();
		} catch (e: any) {
			toast(e.message, 'error');
		}
	}

	async function bulkDelete() {
		if (!confirm(`Hapus ${selected.size} entri kalender terpilih?`)) return;
		bulkBusy = true;
		try {
			const ids = Array.from(selected);
			await Promise.all(ids.map((id) => api(`/api/calendar/${id}`, { method: 'DELETE' })));
			toast(`${ids.length} entri kalender berhasil dihapus`);
			selected = new Set();
			await refresh();
		} catch (e: any) {
			toast(e.message, 'error');
		} finally {
			bulkBusy = false;
		}
	}
</script>

<svelte:head><title>Kalender Akademik — Aplikasi Wali Kelas</title></svelte:head>

<div class="space-y-6">
	<div class="flex flex-wrap items-center justify-between gap-3">
		<p class="text-sm text-slate-500">Hari libur nasional/sekolah otomatis dikecualikan dari perhitungan absensi</p>
		<button class="btn-primary" onclick={() => (showForm = !showForm)}>
			<Icon name={showForm ? 'x' : 'plus'} class="w-4 h-4" /> {showForm ? 'Tutup' : 'Tambah Libur'}
		</button>
	</div>

	{#if showForm}
		<div class="card p-5 space-y-4">
			<h2 class="font-semibold text-slate-900">Tambah / Ubah Hari Libur</h2>
			<div class="grid md:grid-cols-3 gap-4">
				<div>
					<label class="label">Tanggal</label>
					<input class="w-full" type="date" bind:value={form.tanggal} />
				</div>
				<div>
					<label class="label">Keterangan</label>
					<input class="w-full" bind:value={form.keterangan} placeholder="contoh: Hari Raya Idul Fitri" />
				</div>
				<div>
					<label class="label">Tipe</label>
					<select class="w-full" bind:value={form.tipe}>
						<option value="libur">Libur (dikecualikan dari absensi)</option>
						<option value="aktif">Hari aktif</option>
					</select>
				</div>
			</div>
			<div class="flex justify-end">
				<button class="btn-primary" onclick={submit}>Simpan</button>
			</div>
		</div>
	{/if}

	<div class="card overflow-hidden">
		<div class="overflow-x-auto">
			<table class="data-table">
				<thead>
					<tr>
						<th class="w-10 text-center">
							<input
								type="checkbox"
								class="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
								checked={paginated.length > 0 && paginated.every((h) => selected.has(h.id))}
								onchange={toggleSelectAll}
								title="Centang semua di halaman ini"
							/>
						</th>
						<th class="text-center">No</th>
						<th>Tanggal</th>
						<th>Keterangan</th>
						<th class="text-center">Tipe</th>
						<th class="text-right">Aksi</th>
					</tr>
				</thead>
				<tbody>
					{#each paginated as h, i}
						<tr class={selected.has(h.id) ? 'bg-indigo-50/40' : ''}>
							<td class="text-center">
								<input
									type="checkbox"
									class="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
									checked={selected.has(h.id)}
									onchange={() => toggleSelect(h.id)}
								/>
							</td>
							<td class="text-center text-slate-400">{(page - 1) * pageSize + i + 1}</td>
							<td class="font-medium">{formatDateId(h.tanggal)}</td>
							<td>{h.keterangan || '-'}</td>
							<td class="text-center">
								<span class={h.tipe === 'libur' ? 'badge-neutral' : 'badge-hadir'}>{h.tipe === 'libur' ? 'Libur' : 'Aktif'}</span>
							</td>
							<td class="text-right">
								<button class="inline-flex items-center gap-1 text-rose-600 hover:underline text-xs font-semibold cursor-pointer" onclick={() => hapus(h)}>
									<Icon name="trash" class="w-3.5 h-3.5" /> Hapus
								</button>
							</td>
						</tr>
					{:else}
						<tr><td colspan="6" class="text-center py-8 text-slate-400">Belum ada entri kalender akademik</td></tr>
					{/each}
				</tbody>
			</table>
		</div>
		<Pagination currentPage={page} {pageSize} totalItems={holidays.length} onPageChange={(p) => (page = p)} onPageSizeChange={(s) => (pageSize = s)} />
	</div>

	{#if selected.size > 0}
		<div class="fixed bottom-6 left-1/2 -translate-x-1/2 z-30 bg-slate-900 text-white px-5 py-3 rounded-2xl shadow-2xl flex flex-wrap items-center gap-4 text-sm animate-in fade-in duration-200 border border-slate-700">
			<div class="flex items-center gap-2 font-medium">
				<span class="w-2 h-2 rounded-full bg-indigo-400"></span>
				<span>{selected.size} entri kalender terpilih</span>
			</div>
			{#if holidays.length > paginated.length && selected.size < holidays.length}
				<button class="text-xs text-indigo-300 hover:text-white underline cursor-pointer" onclick={selectAllFiltered}>
					Pilih semua {holidays.length} entri
				</button>
			{/if}
			<div class="h-4 w-px bg-slate-700"></div>
			<button class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold cursor-pointer transition disabled:opacity-50" onclick={bulkDelete} disabled={bulkBusy}>
				<Icon name="trash" class="w-3.5 h-3.5" /> {bulkBusy ? 'Memproses...' : 'Hapus Terpilih'}
			</button>
			<button class="text-xs text-slate-400 hover:text-white cursor-pointer ml-1" onclick={() => (selected = new Set())} disabled={bulkBusy}>
				Batal
			</button>
		</div>
	{/if}
</div>
