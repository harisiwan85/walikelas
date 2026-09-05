<script lang="ts">
	import type { AcademicPeriod, ClassRow, School, Teacher } from '$lib/types';
	import { api } from '$lib/client/api';
	import { toast } from '$lib/client/toast';
	import Modal from '$lib/components/Modal.svelte';
	import Icon from '$lib/components/Icon.svelte';
	import Pagination from '$lib/components/Pagination.svelte';

	let { data }: { data: { classes: ClassRow[]; teachers: Teacher[]; school: School; periods: AcademicPeriod[] } } = $props();
	const { classes: initial, teachers, school, periods } = data;

	let classes = $state<ClassRow[]>(initial);
	let filterYear = $state(school.tahun_ajaran_aktif);
	let page = $state(1);
	let pageSize = $state(10);

	let showModal = $state(false);
	let editing = $state<ClassRow | null>(null);
	let form = $state({ nama: '', tingkat: 7, tahun_ajaran: '', wali_kelas_id: '' as number | string });

	let filtered = $derived(classes.filter((c) => !filterYear || c.tahun_ajaran === filterYear));
	const yearOptions = $derived([...new Set(classes.map((c) => c.tahun_ajaran))].sort().reverse());

	let selected = $state<Set<number>>(new Set());
	let bulkBusy = $state(false);

	$effect(() => {
		const _ = filterYear;
		page = 1;
		selected = new Set();
	});

	let paginated = $derived(filtered.slice((page - 1) * pageSize, page * pageSize));

	function openAdd() {
		editing = null;
		form = { nama: '', tingkat: 7, tahun_ajaran: school.tahun_ajaran_aktif, wali_kelas_id: '' };
		showModal = true;
	}

	function openEdit(c: ClassRow) {
		editing = c;
		form = { nama: c.nama, tingkat: c.tingkat, tahun_ajaran: c.tahun_ajaran, wali_kelas_id: c.wali_kelas_id ?? '' };
		showModal = true;
	}

	async function refresh() {
		classes = await api<ClassRow[]>('/api/classes');
	}

	async function submit() {
		try {
			const body = { ...form, wali_kelas_id: form.wali_kelas_id === '' ? null : Number(form.wali_kelas_id) };
			if (editing) {
				await api(`/api/classes/${editing.id}`, { method: 'PUT', body: JSON.stringify(body) });
				toast('Kelas diperbarui');
			} else {
				await api('/api/classes', { method: 'POST', body: JSON.stringify(body) });
				toast('Kelas ditambahkan');
			}
			showModal = false;
			await refresh();
		} catch (e: any) {
			toast(e.message, 'error');
		}
	}

	async function hapus(c: ClassRow) {
		if (!confirm(`Hapus kelas ${c.nama}? Seluruh siswa di dalamnya akan terhapus.`)) return;
		try {
			await api(`/api/classes/${c.id}`, { method: 'DELETE' });
			toast('Kelas dihapus');
			await refresh();
		} catch (e: any) {
			toast(e.message, 'error');
		}
	}

	function toggleSelect(id: number) {
		const next = new Set(selected);
		if (next.has(id)) next.delete(id);
		else next.add(id);
		selected = next;
	}

	function toggleSelectAll() {
		const allInPage = paginated.length > 0 && paginated.every((c) => selected.has(c.id));
		const next = new Set(selected);
		if (allInPage) {
			paginated.forEach((c) => next.delete(c.id));
		} else {
			paginated.forEach((c) => next.add(c.id));
		}
		selected = next;
	}

	function selectAllFiltered() {
		selected = new Set(filtered.map((c) => c.id));
	}

	async function bulkDelete() {
		if (!confirm(`Hapus ${selected.size} kelas terpilih? Seluruh siswa di dalamnya akan ikut terhapus.`)) return;
		bulkBusy = true;
		try {
			const ids = Array.from(selected);
			await Promise.all(ids.map((id) => api(`/api/classes/${id}`, { method: 'DELETE' })));
			toast(`${ids.length} kelas berhasil dihapus`);
			selected = new Set();
			await refresh();
		} catch (e: any) {
			toast(e.message, 'error');
		} finally {
			bulkBusy = false;
		}
	}
</script>

<svelte:head><title>Data Kelas — Aplikasi Wali Kelas</title></svelte:head>

<div class="space-y-6">
	<div class="flex items-center justify-between gap-3">
		<p class="text-sm text-slate-500">Tahun ajaran {school.tahun_ajaran_aktif} • Semester {school.semester_aktif}</p>
		<button class="btn-primary" onclick={openAdd}><Icon name="plus" class="w-4 h-4" /> Tambah Kelas</button>
	</div>

	<div class="card p-4 flex flex-wrap items-center gap-3">
		<div>
			<label class="label">Filter Tahun Ajaran</label>
			<select class="w-56" bind:value={filterYear}>
				<option value="">Semua Tahun Ajaran</option>
				{#each yearOptions as y}
					<option value={y}>{y}{y === school.tahun_ajaran_aktif ? ' (aktif)' : ' (arsip)'}</option>
				{/each}
			</select>
		</div>
		<span class="text-xs text-slate-400 ml-auto">{filtered.length} kelas</span>
	</div>

	<div class="card overflow-hidden">
		<table class="data-table">
			<thead>
				<tr>
					<th class="w-10 text-center">
						<input
							type="checkbox"
							class="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
							checked={paginated.length > 0 && paginated.every((c) => selected.has(c.id))}
							onchange={toggleSelectAll}
							title="Centang semua di halaman ini"
						/>
					</th>
					<th class="text-center">No</th>
					<th>Kelas</th>
					<th>Tingkat</th>
					<th>Tahun Ajaran</th>
					<th>Wali Kelas</th>
					<th class="text-center">Jumlah Siswa</th>
					<th class="text-right">Aksi</th>
				</tr>
			</thead>
			<tbody>
				{#each paginated as c, i}
					<tr class={selected.has(c.id) ? 'bg-indigo-50/40' : ''}>
						<td class="text-center">
							<input
								type="checkbox"
								class="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
								checked={selected.has(c.id)}
								onchange={() => toggleSelect(c.id)}
							/>
						</td>
						<td class="text-center text-slate-400">{(page - 1) * pageSize + i + 1}</td>
						<td class="font-medium">Kelas {c.nama}</td>
						<td>{c.tingkat}</td>
						<td>
							{c.tahun_ajaran}
							{#if c.tahun_ajaran !== school.tahun_ajaran_aktif}<span class="badge-neutral ml-1">Arsip</span>{/if}
						</td>
						<td>
							{#if c.wali_kelas_nama}
								{c.wali_kelas_nama}
							{:else}
								<span class="text-slate-400">—</span>
							{/if}
						</td>
						<td class="text-center">{c.jumlah_siswa}</td>
						<td class="text-right whitespace-nowrap">
							<button class="inline-flex items-center gap-1 text-indigo-600 hover:underline text-xs font-semibold cursor-pointer mr-3" onclick={() => openEdit(c)}><Icon name="edit" class="w-3.5 h-3.5" /> Edit</button>
							<button class="inline-flex items-center gap-1 text-rose-600 hover:underline text-xs font-semibold cursor-pointer" onclick={() => hapus(c)}><Icon name="trash" class="w-3.5 h-3.5" /> Hapus</button>
						</td>
					</tr>
				{:else}
					<tr><td colspan="8" class="text-center py-8 text-slate-400">Belum ada kelas</td></tr>
				{/each}
			</tbody>
		</table>
		<Pagination currentPage={page} {pageSize} totalItems={filtered.length} onPageChange={(p) => (page = p)} onPageSizeChange={(s) => (pageSize = s)} />
	</div>

	{#if selected.size > 0}
		<div class="fixed bottom-6 left-1/2 -translate-x-1/2 z-30 bg-slate-900 text-white px-5 py-3 rounded-2xl shadow-2xl flex flex-wrap items-center gap-4 text-sm animate-in fade-in duration-200 border border-slate-700">
			<div class="flex items-center gap-2 font-medium">
				<span class="w-2 h-2 rounded-full bg-indigo-400"></span>
				<span>{selected.size} kelas terpilih</span>
			</div>
			{#if filtered.length > paginated.length && selected.size < filtered.length}
				<button class="text-xs text-indigo-300 hover:text-white underline cursor-pointer" onclick={selectAllFiltered}>
					Pilih semua {filtered.length} kelas
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

<Modal open={showModal} title={editing ? 'Edit Kelas' : 'Tambah Kelas'} onclose={() => (showModal = false)}>
	<div class="space-y-3">
		<div class="grid grid-cols-2 gap-3">
			<div>
				<label class="label">Nama Kelas</label>
				<input class="w-full" bind:value={form.nama} placeholder="contoh: 7A" />
			</div>
			<div>
				<label class="label">Tingkat</label>
				<select class="w-full" bind:value={form.tingkat}>
					<option value={7}>7</option>
					<option value={8}>8</option>
					<option value={9}>9</option>
					<option value={10}>10</option>
					<option value={11}>11</option>
					<option value={12}>12</option>
				</select>
			</div>
		</div>
		<div>
			<label class="label">Tahun Ajaran</label>
			<input class="w-full" bind:value={form.tahun_ajaran} placeholder="2026/2027" list="tahun-ajaran-list" />
			<datalist id="tahun-ajaran-list">
				{#each periods as p}
					<option value={p.tahun_ajaran}>{p.tahun_ajaran} {p.semester}</option>
				{/each}
			</datalist>
		</div>
		<div>
			<label class="label">Wali Kelas</label>
			<select class="w-full" bind:value={form.wali_kelas_id}>
				<option value="">— Belum ditentukan —</option>
				{#each teachers as t}
					<option value={t.id}>{t.nama}</option>
				{/each}
			</select>
		</div>
		<div class="flex justify-end gap-2 pt-2">
			<button class="btn-secondary" onclick={() => (showModal = false)}>Batal</button>
			<button class="btn-primary" onclick={submit} disabled={!form.nama}>Simpan</button>
		</div>
	</div>
</Modal>
