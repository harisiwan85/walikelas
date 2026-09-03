<script lang="ts">
	import type { ClassRow, Student, StudentStatus, User } from '$lib/types';
	import { api, upload } from '$lib/client/api';
	import { toast } from '$lib/client/toast';
	import Modal from '$lib/components/Modal.svelte';
	import Icon from '$lib/components/Icon.svelte';
	import Pagination from '$lib/components/Pagination.svelte';

	let { data }: { data: { user: User; students: Student[]; classes: ClassRow[] } } = $props();
	const { user, students: initialStudents, classes } = data;

	// Admin, kepala sekolah, dan wali kelas boleh menambah/mengubah/menghapus siswa
	const canManage = user.role === 'admin' || user.role === 'kepala_sekolah' || user.role === 'wali_kelas';
	const isWali = user.role === 'wali_kelas';

	let students = $state<Student[]>(initialStudents);
	let q = $state('');
	let filterClass = $state<number | ''>('');
	let filterStatus = $state<StudentStatus | ''>('');

	let page = $state(1);
	let pageSize = $state(10);

	let showModal = $state(false);
	let editing = $state<Student | null>(null);
	let form = $state<Partial<Student>>({});

	let showImport = $state(false);
	let importClass = $state<number | ''>('');
	let importFile = $state<File | null>(null);
	let importing = $state(false);
	let importResult = $state<{ inserted: number; skipped: number } | null>(null);

	let filtered = $derived(
		students.filter((s) => {
			const matchQ = !q || s.nama.toLowerCase().includes(q.toLowerCase()) || s.nisn.includes(q) || s.nis.includes(q);
			const matchClass = !filterClass || s.class_id === filterClass;
			const matchStatus = !filterStatus || s.status === filterStatus;
			return matchQ && matchClass && matchStatus;
		})
	);

	// Reset ke halaman 1 saat filter pencarian berubah
	$effect(() => {
		const _ = [q, filterClass, filterStatus];
		page = 1;
	});

	let paginated = $derived(filtered.slice((page - 1) * pageSize, page * pageSize));

	async function refresh() {
		students = await api<Student[]>('/api/students');
	}

	function openAdd() {
		editing = null;
		form = { class_id: isWali ? (user.class_id ?? classes[0]?.id) : classes[0]?.id, jenis_kelamin: 'L', status: 'aktif' };
		showModal = true;
	}

	function openEdit(s: Student) {
		editing = s;
		form = { ...s };
		showModal = true;
	}

	async function submit() {
		try {
			if (editing) {
				await api(`/api/students/${editing.id}`, { method: 'PUT', body: JSON.stringify(form) });
				toast('Data siswa diperbarui');
			} else {
				await api('/api/students', { method: 'POST', body: JSON.stringify(form) });
				toast('Siswa ditambahkan');
			}
			showModal = false;
			await refresh();
		} catch (e: any) {
			toast(e.message, 'error');
		}
	}

	async function hapus(s: Student) {
		if (!confirm(`Hapus siswa ${s.nama}? Riwayat absensinya akan ikut terhapus.`)) return;
		try {
			await api(`/api/students/${s.id}`, { method: 'DELETE' });
			toast('Siswa dihapus');
			await refresh();
		} catch (e: any) {
			toast(e.message, 'error');
		}
	}

	async function doImport() {
		if (!importClass || !importFile) {
			toast('Pilih kelas dan file Excel', 'error');
			return;
		}
		importing = true;
		importResult = null;
		try {
			const fd = new FormData();
			fd.append('class_id', String(importClass));
			fd.append('file', importFile);
			const res = await upload<{ inserted: number; skipped: number }>('/api/students/import', fd);
			importResult = res;
			toast(`${res.inserted} siswa diimpor, ${res.skipped} dilewati`);
			showImport = false;
			await refresh();
		} catch (e: any) {
			toast(e.message, 'error');
		} finally {
			importing = false;
		}
	}
</script>

<svelte:head><title>Data Siswa — Aplikasi Wali Kelas</title></svelte:head>

<div class="space-y-6">
	<div class="flex flex-wrap items-center justify-between gap-3">
		<p class="text-sm text-slate-500">{students.length} siswa tercatat</p>
		{#if canManage}
			<div class="flex gap-2">
				<button class="btn-secondary" onclick={() => { importClass = isWali ? (user.class_id ?? '') : ''; importResult = null; showImport = true; }}><Icon name="download" class="w-4 h-4" /> Import Excel</button>
				<button class="btn-primary" onclick={openAdd}><Icon name="plus" class="w-4 h-4" /> Tambah Siswa</button>
			</div>
		{/if}
	</div>

	<div class="card p-4 flex flex-wrap gap-3 items-center">
		<div class="flex-1 min-w-48 relative">
			<span class="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"><Icon name="search" class="w-4 h-4" /></span>
			<input class="w-full pl-9" placeholder="Cari nama / NISN / NIS..." bind:value={q} />
		</div>
		<select bind:value={filterClass}>
			<option value="">Semua Kelas</option>
			{#each classes as c}
				<option value={c.id}>Kelas {c.nama}</option>
			{/each}
		</select>
		<select bind:value={filterStatus}>
			<option value="">Semua Status</option>
			<option value="aktif">Aktif</option>
			<option value="pindah">Pindah</option>
			<option value="lulus">Lulus</option>
			<option value="keluar">Keluar</option>
		</select>
	</div>

	<div class="card overflow-hidden">
		<div class="overflow-x-auto">
			<table class="data-table">
				<thead>
					<tr>
						<th>No</th>
						<th>Nama</th>
						<th>Kelas</th>
						<th>NISN</th>
						<th>L/P</th>
						<th>No. HP Orang Tua</th>
						<th>Status</th>
						{#if canManage}<th class="text-right">Aksi</th>{/if}
					</tr>
				</thead>
				<tbody>
					{#each paginated as s, i}
						<tr>
							<td class="text-slate-400">{(page - 1) * pageSize + i + 1}</td>
							<td class="font-medium">{s.nama}</td>
							<td>{s.class_name}</td>
							<td class="text-slate-500">{s.nisn || '-'}</td>
							<td>{s.jenis_kelamin}</td>
							<td>{s.no_hp_ortu || '-'}</td>
							<td><span class="badge-neutral">{s.status}</span></td>
						{#if canManage}
							<td class="text-right whitespace-nowrap">
								<button class="inline-flex items-center gap-1 text-indigo-600 hover:underline text-xs font-semibold cursor-pointer mr-3" onclick={() => openEdit(s)}><Icon name="edit" class="w-3.5 h-3.5" /> Edit</button>
								<button class="inline-flex items-center gap-1 text-rose-600 hover:underline text-xs font-semibold cursor-pointer" onclick={() => hapus(s)}><Icon name="trash" class="w-3.5 h-3.5" /> Hapus</button>
							</td>
						{/if}
						</tr>
					{:else}
						<tr><td colspan="{canManage ? 8 : 7}" class="text-center py-8 text-slate-400">Tidak ada data siswa</td></tr>
					{/each}
				</tbody>
			</table>
		</div>
		<Pagination bind:currentPage={page} bind:pageSize totalItems={filtered.length} />
	</div>
</div>

<Modal open={showModal} title={editing ? 'Edit Siswa' : 'Tambah Siswa'} onclose={() => (showModal = false)}>
	<div class="space-y-3">
		<div class="grid grid-cols-2 gap-3">
			<div>
				<label class="label">Nama Lengkap</label>
				<input class="w-full" bind:value={form.nama} placeholder="Nama siswa" />
			</div>
			<div>
				<label class="label">Kelas</label>
				<select class="w-full" bind:value={form.class_id} disabled={isWali}>
					{#each classes as c}
						<option value={c.id}>Kelas {c.nama}</option>
					{/each}
				</select>
			</div>
		</div>
		<div class="grid grid-cols-3 gap-3">
			<div>
				<label class="label">NISN</label>
				<input class="w-full" bind:value={form.nisn} />
			</div>
			<div>
				<label class="label">NIS</label>
				<input class="w-full" bind:value={form.nis} />
			</div>
			<div>
				<label class="label">Jenis Kelamin</label>
				<select class="w-full" bind:value={form.jenis_kelamin}>
					<option value="L">Laki-laki</option>
					<option value="P">Perempuan</option>
				</select>
			</div>
		</div>
		<div class="grid grid-cols-2 gap-3">
			<div>
				<label class="label">Tempat Lahir</label>
				<input class="w-full" bind:value={form.tempat_lahir} />
			</div>
			<div>
				<label class="label">Tanggal Lahir</label>
				<input class="w-full" type="date" bind:value={form.tanggal_lahir} />
			</div>
		</div>
		<div>
			<label class="label">Alamat</label>
			<input class="w-full" bind:value={form.alamat} />
		</div>
		<div class="grid grid-cols-2 gap-3">
			<div>
				<label class="label">No. HP Orang Tua/Wali</label>
				<input class="w-full" bind:value={form.no_hp_ortu} />
			</div>
			<div>
				<label class="label">Status</label>
				<select class="w-full" bind:value={form.status}>
					<option value="aktif">Aktif</option>
					<option value="pindah">Pindah</option>
					<option value="lulus">Lulus</option>
					<option value="keluar">Keluar</option>
				</select>
			</div>
		</div>
		<div class="flex justify-end gap-2 pt-2">
			<button class="btn-secondary" onclick={() => (showModal = false)}>Batal</button>
			<button class="btn-primary" onclick={submit} disabled={!form.nama}>Simpan</button>
		</div>
	</div>
</Modal>

<Modal open={showImport} title="Import Siswa dari Excel" onclose={() => (showImport = false)}>
	<div class="space-y-4">
		<div class="bg-sky-50 border border-sky-200 rounded-lg p-4 text-sm text-sky-800">
			<ol class="list-decimal ml-4 space-y-1">
				<li>Unduh <a class="font-semibold underline" href="/api/students/template">template Excel</a>.</li>
				<li>Isi sesuai kolom template (nisn, nis, nama, jenis_kelamin, tempat_lahir, tanggal_lahir, alamat, no_hp_ortu, status).</li>
				<li>Pilih kelas tujuan lalu unggah filenya.</li>
			</ol>
		</div>
		<div>
			<label class="label">Kelas Tujuan</label>
			<select class="w-full" bind:value={importClass} disabled={isWali}>
				<option value="">— Pilih kelas —</option>
				{#each classes as c}
					<option value={c.id}>Kelas {c.nama}</option>
				{/each}
			</select>
		</div>
		<div>
			<label class="label">File Excel (.xlsx / .xls)</label>
			<input type="file" accept=".xlsx,.xls" class="w-full border-0 p-0" onchange={(e) => (importFile = (e.target as HTMLInputElement).files?.[0] ?? null)} />
		</div>
		{#if importResult}
			<div class="text-sm text-emerald-700 bg-emerald-50 rounded-lg px-4 py-3">
				{importResult.inserted} siswa diimpor, {importResult.skipped} dilewati (NISN duplikat).
			</div>
		{/if}
		<div class="flex justify-end gap-2">
			<button class="btn-secondary" onclick={() => (showImport = false)}>Tutup</button>
			<button class="btn-primary" onclick={doImport} disabled={importing}> {importing ? 'Mengimpor...' : 'Import Sekarang'}</button>
		</div>
	</div>
</Modal>
