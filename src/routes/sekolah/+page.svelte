<script lang="ts">
	import type { AcademicPeriod, School } from '$lib/types';
	import { api } from '$lib/client/api';
	import { toast } from '$lib/client/toast';
	import Icon from '$lib/components/Icon.svelte';
	import Pagination from '$lib/components/Pagination.svelte';

	let { data }: { data: { school: School } } = $props();
	const { school: initial } = data;

	let form = $state({ ...initial });
	let saving = $state(false);

	let periods = $state<AcademicPeriod[]>([]);
	let periodPage = $state(1);
	let periodPageSize = $state(5);
	let paginatedPeriods = $derived(periods.slice((periodPage - 1) * periodPageSize, periodPage * periodPageSize));

	let newPeriod = $state({ tahun_ajaran: '', semester: 'Ganjil' });
	let periodBusy = $state(false);
	let uploadingLogo = $state(false);

	async function uploadLogo(file: File | null) {
		if (!file) return;
		uploadingLogo = true;
		try {
			const fd = new FormData();
			fd.append('file', file);
			const res = await fetch('/api/school/logo', { method: 'POST', body: fd });
			const body = await res.json().catch(() => null);
			if (!res.ok) throw new Error(body?.message ?? 'Gagal mengunggah logo');
			form = { ...form, logo_url: body.url };
			toast('Logo sekolah diperbarui');
		} catch (e: any) {
			toast(e.message, 'error');
		} finally {
			uploadingLogo = false;
		}
	}

	async function loadPeriods() {
		try {
			periods = await api<AcademicPeriod[]>('/api/academic-periods');
		} catch (e: any) {
			toast(e.message, 'error');
		}
	}

	async function save() {
		saving = true;
		try {
			await api('/api/school', { method: 'PUT', body: JSON.stringify(form) });
			toast('Profil sekolah disimpan');
		} catch (e: any) {
			toast(e.message, 'error');
		} finally {
			saving = false;
		}
	}

	async function addPeriod() {
		if (!/^\d{4}\/\d{4}$/.test(newPeriod.tahun_ajaran)) {
			toast('Format tahun ajaran harus YYYY/YYYY', 'error');
			return;
		}
		periodBusy = true;
		try {
			await api('/api/academic-periods', { method: 'POST', body: JSON.stringify(newPeriod) });
			toast('Periode ditambahkan');
			newPeriod.tahun_ajaran = '';
			await loadPeriods();
		} catch (e: any) {
			toast(e.message, 'error');
		} finally {
			periodBusy = false;
		}
	}

	async function activate(p: AcademicPeriod) {
		if (!confirm(`Jadikan ${p.tahun_ajaran} Semester ${p.semester} sebagai periode aktif?`)) return;
		periodBusy = true;
		try {
			await api('/api/academic-periods', { method: 'PUT', body: JSON.stringify({ tahun_ajaran: p.tahun_ajaran, semester: p.semester }) });
			toast(`Periode aktif: ${p.tahun_ajaran} ${p.semester}`);
			form = { ...form, tahun_ajaran_aktif: p.tahun_ajaran, semester_aktif: p.semester };
			await loadPeriods();
		} catch (e: any) {
			toast(e.message, 'error');
		} finally {
			periodBusy = false;
		}
	}

	$effect(() => {
		loadPeriods();
	});
</script>

<svelte:head><title>Profil Sekolah — Aplikasi Wali Kelas</title></svelte:head>

<div class="space-y-6 max-w-3xl">
	<p class="text-sm text-slate-500">Identitas sekolah muncul di semua laporan.</p>

	<div class="card card-pad space-y-4">
		<h2 class="font-semibold text-slate-900">Identitas Sekolah</h2>
		<div class="grid grid-cols-2 gap-4">
			<div class="col-span-2">
				<label class="label">Nama Sekolah</label>
				<input class="w-full" bind:value={form.nama} />
			</div>
			<div>
				<label class="label">NPSN</label>
				<input class="w-full" bind:value={form.npsn} />
			</div>
			<div>
				<label class="label">Kepala Sekolah</label>
				<input class="w-full" bind:value={form.kepala_sekolah} />
			</div>
			<div class="col-span-2">
				<label class="label">Alamat</label>
				<input class="w-full" bind:value={form.alamat} />
			</div>
		</div>
	</div>

	<div class="card card-pad space-y-4">
		<h2 class="font-semibold text-slate-900">Logo Sekolah</h2>
		<p class="text-xs text-slate-500">Logo dipakai pada kop laporan absensi (PDF, Excel, dan link publik).</p>
		<div class="flex items-center gap-5">
			<div class="w-24 h-24 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center overflow-hidden shrink-0">
				{#if form.logo_url}
					<img src={form.logo_url} alt="Logo sekolah" class="w-full h-full object-contain p-2" />
				{:else}
					<Icon name="sekolah" class="w-10 h-10 text-slate-300" />
				{/if}
			</div>
			<div class="space-y-2">
				<label
					class="inline-flex items-center gap-2 btn-secondary cursor-pointer"
				>
					{#if uploadingLogo}<span class="text-xs">Mengunggah...</span>
					{:else}<Icon name="upload" class="w-4 h-4" /> Unggah Logo{/if}
					<input type="file" accept="image/*" class="hidden" onchange={(e) => uploadLogo((e.target as HTMLInputElement).files?.[0] ?? null)} />
				</label>
				{#if form.logo_url}
					<button class="block text-xs text-rose-600 hover:underline cursor-pointer" onclick={async () => {
						if (!confirm('Hapus logo sekolah?')) return;
						form = { ...form, logo_url: '' };
						await save();
					}}>Hapus logo</button>
				{/if}
			</div>
		</div>
	</div>

	<div class="card card-pad space-y-4">
		<h2 class="font-semibold text-slate-900">Master Tahun Ajaran & Semester</h2>
		<div class="grid grid-cols-2 gap-4">
			<div>
				<label class="label">Tahun Ajaran Aktif</label>
				<input class="w-full bg-slate-50" value={form.tahun_ajaran_aktif} disabled />
			</div>
			<div>
				<label class="label">Semester Aktif</label>
				<input class="w-full bg-slate-50" value={form.semester_aktif} disabled />
			</div>
		</div>
		<p class="text-xs text-slate-500">
			Periode lama otomatis menjadi <b>arsip</b> saat periode baru diaktifkan — datanya tetap tersimpan, kelas per tahun ajaran bisa difilter di halaman Data Kelas.
		</p>

		<div class="border border-slate-200 rounded-xl overflow-hidden">
			<table class="data-table">
				<thead>
					<tr>
						<th class="text-center">No</th>
						<th>Tahun Ajaran</th>
						<th>Semester</th>
						<th class="text-center">Status</th>
						<th class="text-right">Aksi</th>
					</tr>
				</thead>
				<tbody>
					{#each paginatedPeriods as p, i}
						<tr>
							<td class="text-center text-slate-400">{(periodPage - 1) * periodPageSize + i + 1}</td>
							<td class="font-medium">{p.tahun_ajaran}</td>
							<td>{p.semester}</td>
							<td class="text-center">
								{#if p.aktif}
									<span class="badge badge-hadir">Aktif</span>
								{:else}
									<span class="badge-neutral">Arsip</span>
								{/if}
							</td>
							<td class="text-right">
								{#if !p.aktif}
									<button class="inline-flex items-center gap-1 text-emerald-600 hover:underline text-xs font-semibold cursor-pointer" onclick={() => activate(p)} disabled={periodBusy}>
										<Icon name="check" class="w-3.5 h-3.5" /> Aktifkan
									</button>
								{/if}
							</td>
						</tr>
					{:else}
						<tr><td colspan="5" class="text-center py-6 text-slate-400">Belum ada periode</td></tr>
					{/each}
				</tbody>
			</table>
			{#if periods.length > periodPageSize}
				<Pagination currentPage={periodPage} pageSize={periodPageSize} totalItems={periods.length} compact={true} showPageSize={false} onPageChange={(p) => (periodPage = p)} />
			{/if}
		</div>

		<div class="flex flex-wrap items-end gap-3 pt-1">
			<div>
				<label class="label">Tahun Ajaran Baru</label>
				<input class="w-40" bind:value={newPeriod.tahun_ajaran} placeholder="2027/2028" />
			</div>
			<div>
				<label class="label">Semester</label>
				<select class="w-32" bind:value={newPeriod.semester}>
					<option value="Ganjil">Ganjil</option>
					<option value="Genap">Genap</option>
				</select>
			</div>
			<button class="btn-secondary" onclick={addPeriod} disabled={periodBusy}><Icon name="plus" class="w-4 h-4" /> Tambah Periode</button>
		</div>
	</div>

	<div class="card card-pad space-y-4">
		<h2 class="font-semibold text-slate-900">Pengaturan Absensi</h2>
		<div>
			<label class="label">Ambang Batas Alpa (kali per tahun) untuk Alert</label>
			<input class="w-full" type="number" min="1" bind:value={form.alpa_threshold} />
			<p class="text-xs text-slate-400 mt-1">Siswa dengan jumlah alpa ≥ ambang batas akan muncul di dashboard sebagai peringatan.</p>
		</div>
	</div>

	<div class="flex justify-end">
		<button class="btn-primary" onclick={save} disabled={saving}>{saving ? 'Menyimpan...' : 'Simpan'}</button>
	</div>
</div>
