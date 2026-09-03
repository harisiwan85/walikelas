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
						<th class="text-center">No</th>
						<th>Tanggal</th>
						<th>Keterangan</th>
						<th class="text-center">Tipe</th>
						<th class="text-right">Aksi</th>
					</tr>
				</thead>
				<tbody>
					{#each paginated as h, i}
						<tr>
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
						<tr><td colspan="5" class="text-center py-8 text-slate-400">Belum ada entri kalender akademik</td></tr>
					{/each}
				</tbody>
			</table>
		</div>
		<Pagination bind:currentPage={page} bind:pageSize totalItems={holidays.length} />
	</div>
</div>
