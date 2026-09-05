<script lang="ts">
	import type { ClassRow, Subject, Teacher } from '$lib/types';
	import { api } from '$lib/client/api';
	import { toast } from '$lib/client/toast';
	import Modal from '$lib/components/Modal.svelte';
	import Icon from '$lib/components/Icon.svelte';
	import Pagination from '$lib/components/Pagination.svelte';

	let { data }: { data: { subjects: Subject[]; teachers: Teacher[]; classes: ClassRow[] } } = $props();
	const { subjects: initial, teachers, classes } = data;

	let subjects = $state<Subject[]>(initial);
	let page = $state(1);
	let pageSize = $state(10);
	let paginated = $derived(subjects.slice((page - 1) * pageSize, page * pageSize));

	let showModal = $state(false);
	let editing = $state<Subject | null>(null);
	let form = $state<{ kode: string; nama: string; teacher_ids: number[]; class_ids: number[] }>({
			kode: '',
			nama: '',
			teacher_ids: [],
			class_ids: []
		});

		function openAdd() {
			editing = null;
			form = { kode: '', nama: '', teacher_ids: [], class_ids: [] };
			showModal = true;
		}

		function openEdit(s: Subject) {
			editing = s;
			const tids = s.teacher_ids && s.teacher_ids.length
				? s.teacher_ids
				: s.teacher_id
				? [s.teacher_id]
				: [];
			form = {
				kode: s.kode,
				nama: s.nama,
				teacher_ids: tids,
				class_ids: s.classes.map((c) => c.id)
			};
			showModal = true;
		}

		function toggleTeacher(tid: number) {
			form.teacher_ids = form.teacher_ids.includes(tid)
				? form.teacher_ids.filter((x) => x !== tid)
				: [...form.teacher_ids, tid];
		}

		function toggleClass(cid: number) {
			form.class_ids = form.class_ids.includes(cid) ? form.class_ids.filter((x) => x !== cid) : [...form.class_ids, cid];
		}

		async function refresh() {
			subjects = await api<Subject[]>('/api/subjects');
		}

		async function submit() {
			try {
				const body = {
					kode: form.kode,
					nama: form.nama,
					teacher_id: form.teacher_ids[0] ?? null,
					teacher_ids: form.teacher_ids,
					class_ids: form.class_ids
				};
				if (editing) {
					await api(`/api/subjects/${editing.id}`, { method: 'PUT', body: JSON.stringify(body) });
					toast('Mata pelajaran diperbarui');
				} else {
					await api('/api/subjects', { method: 'POST', body: JSON.stringify(body) });
					toast('Mata pelajaran ditambahkan');
				}
				showModal = false;
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
		const allInPage = paginated.length > 0 && paginated.every((s) => selected.has(s.id));
		const next = new Set(selected);
		if (allInPage) {
			paginated.forEach((s) => next.delete(s.id));
		} else {
			paginated.forEach((s) => next.add(s.id));
		}
		selected = next;
	}

	function selectAllFiltered() {
		selected = new Set(subjects.map((s) => s.id));
	}

	async function hapus(s: Subject) {
		if (!confirm(`Hapus mata pelajaran ${s.nama}?`)) return;
		try {
			await api(`/api/subjects/${s.id}`, { method: 'DELETE' });
			toast('Mata pelajaran dihapus');
			await refresh();
		} catch (e: any) {
			toast(e.message, 'error');
		}
	}

	async function bulkDelete() {
		if (!confirm(`Hapus ${selected.size} mata pelajaran terpilih?`)) return;
		bulkBusy = true;
		try {
			const ids = Array.from(selected);
			await Promise.all(ids.map((id) => api(`/api/subjects/${id}`, { method: 'DELETE' })));
			toast(`${ids.length} mata pelajaran berhasil dihapus`);
			selected = new Set();
			await refresh();
		} catch (e: any) {
			toast(e.message, 'error');
		} finally {
			bulkBusy = false;
		}
	}
</script>

<svelte:head><title>Mata Pelajaran — Aplikasi Wali Kelas</title></svelte:head>

<div class="space-y-6">
	<div class="flex items-center justify-between gap-3">
		<p class="text-sm text-slate-500">{subjects.length} mata pelajaran</p>
		<button class="btn-primary" onclick={openAdd}><Icon name="plus" class="w-4 h-4" /> Tambah Mapel</button>
	</div>

	<div class="card overflow-hidden">
		<table class="data-table">
			<thead>
				<tr>
					<th class="w-10 text-center">
						<input
							type="checkbox"
							class="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
							checked={paginated.length > 0 && paginated.every((s) => selected.has(s.id))}
							onchange={toggleSelectAll}
							title="Centang semua di halaman ini"
						/>
					</th>
					<th class="text-center">No</th>
					<th>Kode</th>
					<th>Nama Pelajaran</th>
					<th>Guru Pengampu</th>
					<th>Kelas Diajar</th>
					<th class="text-right">Aksi</th>
				</tr>
			</thead>
			<tbody>
				{#each paginated as s, i}
					<tr class={selected.has(s.id) ? 'bg-indigo-50/40' : ''}>
						<td class="text-center">
							<input
								type="checkbox"
								class="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
								checked={selected.has(s.id)}
								onchange={() => toggleSelect(s.id)}
							/>
						</td>
						<td class="text-center text-slate-400">{(page - 1) * pageSize + i + 1}</td>
						<td class="font-mono text-xs text-slate-500">{s.kode || '-'}</td>
						<td class="font-medium">{s.nama}</td>
						<td>
							{#if s.teacher_nama}
								{s.teacher_nama}
							{:else}
								<span class="text-slate-400">—</span>
							{/if}
						</td>
						<td>{s.classes.map((c) => c.nama).join(', ') || '-'}</td>
						<td class="text-right whitespace-nowrap">
							<button class="inline-flex items-center gap-1 text-indigo-600 hover:underline text-xs font-semibold cursor-pointer mr-3" onclick={() => openEdit(s)}><Icon name="edit" class="w-3.5 h-3.5" /> Edit</button>
							<button class="inline-flex items-center gap-1 text-rose-600 hover:underline text-xs font-semibold cursor-pointer" onclick={() => hapus(s)}><Icon name="trash" class="w-3.5 h-3.5" /> Hapus</button>
						</td>
					</tr>
				{:else}
					<tr><td colspan="7" class="text-center py-8 text-slate-400">Belum ada mata pelajaran</td></tr>
				{/each}
			</tbody>
		</table>
		<Pagination currentPage={page} {pageSize} totalItems={subjects.length} onPageChange={(p) => (page = p)} onPageSizeChange={(s) => (pageSize = s)} />
	</div>

	{#if selected.size > 0}
		<div class="fixed bottom-6 left-1/2 -translate-x-1/2 z-30 bg-slate-900 text-white px-5 py-3 rounded-2xl shadow-2xl flex flex-wrap items-center gap-4 text-sm animate-in fade-in duration-200 border border-slate-700">
			<div class="flex items-center gap-2 font-medium">
				<span class="w-2 h-2 rounded-full bg-indigo-400"></span>
				<span>{selected.size} mata pelajaran terpilih</span>
			</div>
			{#if subjects.length > paginated.length && selected.size < subjects.length}
				<button class="text-xs text-indigo-300 hover:text-white underline cursor-pointer" onclick={selectAllFiltered}>
					Pilih semua {subjects.length} mata pelajaran
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

<Modal open={showModal} title={editing ? 'Edit Mata Pelajaran' : 'Tambah Mata Pelajaran'} onclose={() => (showModal = false)}>
	<div class="space-y-3">
		<div class="grid grid-cols-3 gap-3">
			<div>
				<label class="label">Kode</label>
				<input class="w-full" bind:value={form.kode} placeholder="MTK" />
			</div>
			<div class="col-span-2">
				<label class="label">Nama Pelajaran</label>
				<input class="w-full" bind:value={form.nama} />
			</div>
		</div>
			<div>
				<label class="label">Guru Pengampu (Bisa pilih lebih dari 1)</label>
				<div class="flex flex-wrap gap-2 max-h-48 overflow-y-auto p-2 bg-slate-50 rounded-xl border border-slate-200">
					{#each teachers as t}
						<button
							type="button"
							class="px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors cursor-pointer {form.teacher_ids.includes(t.id)
								? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
								: 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'}"
							onclick={() => toggleTeacher(t.id)}
						>
							{#if form.teacher_ids.includes(t.id)}✓ {/if}{t.nama}
						</button>
					{/each}
				</div>
			</div>
		<div>
			<label class="label">Kelas yang Diajar</label>
			<div class="flex flex-wrap gap-2">
				{#each classes as c}
					<button
						type="button"
						class="px-3 py-1.5 rounded-lg border text-sm transition-colors cursor-pointer {form.class_ids.includes(c.id)
							? 'bg-indigo-600 text-white border-indigo-600'
							: 'bg-white text-slate-600 border-slate-300'}"
						onclick={() => toggleClass(c.id)}
					>
						{c.nama}
					</button>
				{/each}
			</div>
		</div>
		<div class="flex justify-end gap-2 pt-2">
			<button class="btn-secondary" onclick={() => (showModal = false)}>Batal</button>
			<button class="btn-primary" onclick={submit} disabled={!form.nama}>Simpan</button>
		</div>
	</div>
</Modal>
