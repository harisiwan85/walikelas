<script lang="ts">
	import type { ClassRow, JournalEntry, Subject, User } from '$lib/types';
	import { api } from '$lib/client/api';
	import { toast } from '$lib/client/toast';
	import Modal from '$lib/components/Modal.svelte';
	import Icon from '$lib/components/Icon.svelte';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import Pagination from '$lib/components/Pagination.svelte';
	import { formatDateId, formatDateShort, todayStr } from '$lib/date';

	let { data }: { data: { user: User; journals: JournalEntry[]; classes: ClassRow[]; subjects: Subject[]; teacherSubjects: Subject[]; isGuruMapel: boolean; from: string; to: string } } = $props();
	const { user, classes, subjects: allSubjects, teacherSubjects, isGuruMapel } = data;
	let journals = $state<JournalEntry[]>(data.journals);

	let filterClass = $state<number | ''>('');
	let from = $state(data.from);
	let to = $state(data.to);
	let page = $state(1);
	let pageSize = $state(10);
	let showModal = $state(false);
	let editing = $state<JournalEntry | null>(null);
	let menuFor = $state<number | null>(null);

	let form = $state({
		class_id: '',
		tanggal: todayStr(),
		subject_id: '',
		materi: '',
		kegiatan: '',
		kendala: '',
		catatan: ''
	});

	// Mapel yang diajarkan di kelas yang dipilih pada form (guru mapel: hanya mapel yang diampu)
	let formSubjects = $derived(form.class_id ? subjectsForForm(Number(form.class_id)) : []);

	function subjectsForForm(cid: number): Subject[] {
		const byClass = allSubjects.filter((s) => s.classes.some((c) => c.id === cid));
		if (!isGuruMapel) return byClass;
		const mine = new Set(teacherSubjects.map((s) => s.id));
		return byClass.filter((s) => mine.has(s.id));
	}

	const emptyMsg = 'Belum ada catatan jurnal. Klik "Tulis Jurnal" untuk mencatat kegiatan pembelajaran hari ini.';

	let filtered = $derived(
		journals.filter((j) => {
			const mc = !filterClass || j.class_id === filterClass;
			const md = (!from || j.tanggal >= from) && (!to || j.tanggal <= to);
			return mc && md;
		})
	);

	const canDelete = user.role === 'admin' || user.role === 'wali_kelas';

	let selected = $state<Set<number>>(new Set());
	let bulkBusy = $state(false);

	$effect(() => {
		const _ = [filterClass, from, to];
		page = 1;
		selected = new Set();
	});

	let paginated = $derived(filtered.slice((page - 1) * pageSize, page * pageSize));

	async function refresh() {
		const params = new URLSearchParams();
		if (filterClass) params.set('class_id', String(filterClass));
		if (from) params.set('from', from);
		if (to) params.set('to', to);
		journals = await api<JournalEntry[]>(`/api/journal?${params}`);
	}

	function openAdd() {
		editing = null;
		form = {
			class_id: String(user.role === 'wali_kelas' ? user.class_id ?? '' : data.classes[0]?.id ?? ''),
			tanggal: todayStr(),
			subject_id: '',
			materi: '',
			kegiatan: '',
			kendala: '',
			catatan: ''
		};
		showModal = true;
	}

	function openEdit(j: JournalEntry) {
		editing = j;
		form = {
			class_id: String(j.class_id),
			tanggal: j.tanggal,
			subject_id: j.subject_id ? String(j.subject_id) : '',
			materi: j.materi,
			kegiatan: j.kegiatan,
			kendala: j.kendala,
			catatan: j.catatan
		};
		showModal = true;
	}

	async function submit() {
		if (!form.class_id) {
			toast('Pilih kelas terlebih dahulu', 'error');
			return;
		}
		if (!form.materi.trim() && !form.kegiatan.trim() && !form.catatan.trim()) {
			toast('Isi minimal salah satu: materi, kegiatan, atau catatan', 'error');
			return;
		}
		try {
			const payload = {
				class_id: Number(form.class_id),
				tanggal: form.tanggal,
				subject_id: form.subject_id ? Number(form.subject_id) : null,
				materi: form.materi,
				kegiatan: form.kegiatan,
				kendala: form.kendala,
				catatan: form.catatan
			};
			if (editing) {
				await api(`/api/journal/${editing.id}`, { method: 'PUT', body: JSON.stringify(payload) });
				toast('Jurnal diperbarui');
			} else {
				await api('/api/journal', { method: 'POST', body: JSON.stringify(payload) });
				toast('Jurnal tersimpan');
			}
			showModal = false;
			await refresh();
		} catch (e: any) {
			toast(e.message, 'error');
		}
	}

	async function hapus(j: JournalEntry) {
		if (!confirm('Hapus catatan jurnal ini?')) return;
		try {
			await api(`/api/journal/${j.id}`, { method: 'DELETE' });
			toast('Jurnal dihapus');
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
		const allInPage = paginated.length > 0 && paginated.every((j) => selected.has(j.id));
		const next = new Set(selected);
		if (allInPage) {
			paginated.forEach((j) => next.delete(j.id));
		} else {
			paginated.forEach((j) => next.add(j.id));
		}
		selected = next;
	}

	function selectAllFiltered() {
		selected = new Set(filtered.map((j) => j.id));
	}

	async function bulkDelete() {
		if (!confirm(`Hapus ${selected.size} catatan jurnal terpilih?`)) return;
		bulkBusy = true;
		try {
			const ids = Array.from(selected);
			await Promise.all(ids.map((id) => api(`/api/journal/${id}`, { method: 'DELETE' })));
			toast(`${ids.length} catatan jurnal berhasil dihapus`);
			selected = new Set();
			await refresh();
		} catch (e: any) {
			toast(e.message, 'error');
		} finally {
			bulkBusy = false;
		}
	}
</script>

<svelte:head><title>Jurnal Kelas — Aplikasi Wali Kelas</title></svelte:head>

<div class="space-y-6">
	<div class="flex flex-wrap items-center justify-between gap-3">
		<p class="text-sm text-slate-500">Jurnal harian guru — catat materi, kegiatan, kendala, dan catatan kelas</p>
		<button class="btn-primary" onclick={openAdd}><Icon name="plus" class="w-4 h-4" /> Tulis Jurnal</button>
	</div>

	<div class="card p-4 flex flex-wrap gap-3 items-center">
		<div class="min-w-40">
			<select bind:value={filterClass} onchange={refresh}>
				<option value="">Semua Kelas</option>
				{#each classes as c}
					<option value={c.id}>Kelas {c.nama}</option>
				{/each}
			</select>
		</div>
		<div class="flex items-center gap-2">
			<input type="date" bind:value={from} onchange={refresh} />
			<span class="text-slate-400 text-sm">s/d</span>
			<input type="date" bind:value={to} onchange={refresh} />
		</div>
		<span class="text-xs text-slate-400 ml-auto">{filtered.length} catatan</span>
	</div>

	<div class="space-y-4">
		{#if canDelete && paginated.length > 0}
			<div class="flex items-center justify-between px-2 text-sm text-slate-600 bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
				<label class="inline-flex items-center gap-2 cursor-pointer select-none">
					<input
						type="checkbox"
						class="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
						checked={paginated.length > 0 && paginated.every((j) => selected.has(j.id))}
						onchange={toggleSelectAll}
					/>
					<span class="text-xs font-semibold text-slate-700">Pilih Semua di Halaman Ini</span>
				</label>
				{#if filtered.length > paginated.length && selected.size > 0 && selected.size < filtered.length}
					<button class="text-xs text-indigo-600 hover:underline font-medium cursor-pointer" onclick={selectAllFiltered}>
						Pilih semua {filtered.length} catatan jurnal
					</button>
				{/if}
			</div>
		{/if}

		{#each paginated as j (j.id)}
			<div class="card p-5 space-y-3 transition {selected.has(j.id) ? 'ring-2 ring-indigo-500 bg-indigo-50/20' : ''}">
				<div class="flex flex-wrap items-start justify-between gap-2">
					<div class="flex items-center gap-3">
						{#if canDelete}
							<input
								type="checkbox"
								class="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
								checked={selected.has(j.id)}
								onchange={() => toggleSelect(j.id)}
							/>
						{/if}
						<div class="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
							<Icon name="jurnal" class="w-5 h-5" />
						</div>
						<div>
							<div class="font-semibold text-slate-900">Kelas {j.class_name}</div>
							<div class="text-xs text-slate-500">{formatDateId(j.tanggal)}{j.dicatat_oleh ? ` • oleh ${j.dicatat_oleh}` : ''}</div>
						</div>
					</div>
					<div class="flex items-center gap-2">
						{#if j.subject_name}
							<span class="badge badge-izin">{j.subject_name}</span>
						{/if}
						<div class="relative">
							<button
								class="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
								onclick={(e) => {
									e.stopPropagation();
									menuFor = menuFor === j.id ? null : j.id;
								}}
								aria-label="Menu jurnal"
								title="Menu"
							>
								<Icon name="more" class="w-4 h-4" />
							</button>
							{#if menuFor === j.id}
								<div class="absolute right-0 top-full mt-1 w-36 bg-white rounded-xl shadow-lg border border-slate-200 py-1 z-20">
									<button
										class="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 cursor-pointer"
										onclick={() => {
											menuFor = null;
											openEdit(j);
										}}
									>
										<Icon name="edit" class="w-3.5 h-3.5 text-indigo-600" /> Edit
									</button>
									<button
										class="w-full flex items-center gap-2 px-3 py-2 text-sm text-rose-600 hover:bg-rose-50 cursor-pointer"
										onclick={() => {
											menuFor = null;
											hapus(j);
										}}
									>
										<Icon name="trash" class="w-3.5 h-3.5" /> Hapus
									</button>
								</div>
							{/if}
						</div>
					</div>
				</div>
				<div class="grid md:grid-cols-2 gap-4 text-sm">
					{#if j.materi}
						<div>
							<div class="text-xs font-semibold text-slate-400 uppercase mb-1">Materi</div>
							<p class="text-slate-700 whitespace-pre-line">{j.materi}</p>
						</div>
					{/if}
					{#if j.kegiatan}
						<div>
							<div class="text-xs font-semibold text-slate-400 uppercase mb-1">Kegiatan</div>
							<p class="text-slate-700 whitespace-pre-line">{j.kegiatan}</p>
						</div>
					{/if}
					{#if j.kendala}
						<div>
							<div class="text-xs font-semibold text-slate-400 uppercase mb-1">Kendala</div>
							<p class="text-slate-700 whitespace-pre-line">{j.kendala}</p>
						</div>
					{/if}
					{#if j.catatan}
						<div>
							<div class="text-xs font-semibold text-slate-400 uppercase mb-1">Catatan</div>
							<p class="text-slate-700 whitespace-pre-line">{j.catatan}</p>
						</div>
					{/if}
				</div>
			</div>
		{:else}
			<EmptyState icon="jurnal" title="Belum ada catatan jurnal" description={emptyMsg} />
		{/each}

		{#if filtered.length > 0}
			<div class="card overflow-hidden">
				<Pagination currentPage={page} {pageSize} totalItems={filtered.length} onPageChange={(p) => (page = p)} onPageSizeChange={(s) => (pageSize = s)} />
			</div>
		{/if}
	</div>

	{#if canDelete && selected.size > 0}
		<div class="fixed bottom-6 left-1/2 -translate-x-1/2 z-30 bg-slate-900 text-white px-5 py-3 rounded-2xl shadow-2xl flex flex-wrap items-center gap-4 text-sm animate-in fade-in duration-200 border border-slate-700">
			<div class="flex items-center gap-2 font-medium">
				<span class="w-2 h-2 rounded-full bg-indigo-400"></span>
				<span>{selected.size} jurnal terpilih</span>
			</div>
			{#if filtered.length > paginated.length && selected.size < filtered.length}
				<button class="text-xs text-indigo-300 hover:text-white underline cursor-pointer" onclick={selectAllFiltered}>
					Pilih semua {filtered.length} jurnal
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

<Modal open={showModal} title={editing ? 'Ubah Jurnal Kelas' : 'Tulis Jurnal Kelas'} onclose={() => (showModal = false)}>
	<div class="space-y-3">
		<div class="grid grid-cols-2 gap-3">
			<div>
				<label class="label">Kelas</label>
				<select class="w-full" bind:value={form.class_id} disabled={user.role === 'wali_kelas'}>
					<option value="">— Pilih kelas —</option>
					{#each classes as c}
						<option value={c.id}>Kelas {c.nama}</option>
					{/each}
				</select>
			</div>
			<div>
				<label class="label">Tanggal</label>
				<input class="w-full" type="date" bind:value={form.tanggal} />
			</div>
		</div>
		<div>
			<label class="label">Mata Pelajaran (opsional)</label>
			<select class="w-full" bind:value={form.subject_id}>
				<option value="">— Tanpa mapel —</option>
				{#each formSubjects as s}
					<option value={s.id}>{s.nama}</option>
				{/each}
			</select>
		</div>
		<div>
			<label class="label">Materi yang diajarkan</label>
			<input class="w-full" bind:value={form.materi} placeholder="Misal: Bab 1 Bilangan Bulat — operasi penjumlahan" />
		</div>
		<div>
			<label class="label">Kegiatan pembelajaran</label>
			<textarea class="w-full min-h-20" bind:value={form.kegiatan} placeholder="Metode, aktivitas, media yang digunakan..."></textarea>
		</div>
		<div>
			<label class="label">Kendala / masalah</label>
			<textarea class="w-full min-h-20" bind:value={form.kendala} placeholder="Kendala siswa, sarana, atau hal yang perlu ditindaklanjuti..."></textarea>
		</div>
		<div>
			<label class="label">Catatan kelas</label>
			<textarea class="w-full min-h-20" bind:value={form.catatan} placeholder="Kondisi kelas, evaluasi, catatan wali kelas..."></textarea>
		</div>
		<div class="flex justify-end gap-2 pt-2">
			<button class="btn-secondary" onclick={() => (showModal = false)}>Batal</button>
			<button class="btn-primary" onclick={submit}>Simpan Jurnal</button>
		</div>
	</div>
</Modal>
