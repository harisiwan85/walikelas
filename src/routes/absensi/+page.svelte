<script lang="ts">
	import type { AttendanceStatus, ClassRow, Subject, User } from '$lib/types';
	import { STATUS_LABEL } from '$lib/types';
	import { onMount } from 'svelte';
	import { api } from '$lib/client/api';
	import { toast } from '$lib/client/toast';
	import { formatDateId } from '$lib/date';
	import Icon from '$lib/components/Icon.svelte';

	let { data }: { data: { user: User; classes: ClassRow[]; classSubjects: Subject[]; teacherSubjects: Subject[]; isGuruMapel: boolean; selectedClassId: number | null; today: string } } = $props();
	const { user, classes, isGuruMapel, today } = data;

	const statuses: AttendanceStatus[] = ['hadir', 'sakit', 'izin', 'alpa', 'terlambat'];
	const isWali = user.role === 'wali_kelas';

	// Huruf + label pendek untuk chip cepat di mobile
	const LETTER: Record<AttendanceStatus, string> = { hadir: 'H', sakit: 'S', izin: 'I', alpa: 'A', terlambat: 'T' };
	const SHORT: Record<AttendanceStatus, string> = { hadir: 'Hadir', sakit: 'Sakit', izin: 'Izin', alpa: 'Alpa', telat: 'Telat', terlambat: 'Telat' } as Record<AttendanceStatus, string>;

	let tab = $state<'harian' | 'mapel'>(isGuruMapel ? 'mapel' : 'harian');

	// ---- tab harian ----
	let tanggal = $state(today);
	let classId = $state<number | null>(data.selectedClassId);
	let records = $state<{ student_id: number; nisn: string; nama: string; status: AttendanceStatus; keterangan: string; bukti_url: string }[]>([]);
	let uploadingId = $state<number | null>(null);
	let loading = $state(false);
	let saving = $state(false);
	let libur = $state(false);
	let classNama = $state('');
	let dataLoaded = $state(false);

	// ---- tab mapel ----
	let mTanggal = $state(today);
	let mClassId = $state<number | null>(data.selectedClassId ?? null);
	let mSubjectId = $state<number | ''>('');
	let mJamKe = $state(1);
	let mSubjects = $state<Subject[]>(data.classSubjects);
	let mRecords = $state<{ student_id: number; nisn: string; nama: string; status: AttendanceStatus; keterangan: string }[]>([]);
	let mLoading = $state(false);
	let mSaving = $state(false);
	let mLibur = $state(false);
	let mClassNama = $state('');
	let mLoaded = $state(false);

	const statusBtnCls: Record<AttendanceStatus, string> = {
		hadir: 'data-[active=true]:bg-emerald-600 data-[active=true]:text-white bg-emerald-50 text-emerald-700 border-emerald-200',
		sakit: 'data-[active=true]:bg-amber-600 data-[active=true]:text-white bg-amber-50 text-amber-700 border-amber-200',
		izin: 'data-[active=true]:bg-sky-600 data-[active=true]:text-white bg-sky-50 text-sky-700 border-sky-200',
		alpa: 'data-[active=true]:bg-rose-600 data-[active=true]:text-white bg-rose-50 text-rose-700 border-rose-200',
		terlambat: 'data-[active=true]:bg-orange-600 data-[active=true]:text-white bg-orange-50 text-orange-700 border-orange-200'
	};

	// Chip besar versi mobile: huruf + label pendek
	const chipCls: Record<AttendanceStatus, string> = {
		hadir: 'data-[on=true]:bg-emerald-600 data-[on=true]:border-emerald-600 data-[on=true]:text-white bg-emerald-50 text-emerald-700 border-emerald-200',
		sakit: 'data-[on=true]:bg-amber-500 data-[on=true]:border-amber-500 data-[on=true]:text-white bg-amber-50 text-amber-700 border-amber-200',
		izin: 'data-[on=true]:bg-sky-500 data-[on=true]:border-sky-500 data-[on=true]:text-white bg-sky-50 text-sky-700 border-sky-200',
		alpa: 'data-[on=true]:bg-rose-600 data-[on=true]:border-rose-600 data-[on=true]:text-white bg-rose-50 text-rose-700 border-rose-200',
		terlambat: 'data-[on=true]:bg-orange-500 data-[on=true]:border-orange-500 data-[on=true]:text-white bg-orange-50 text-orange-700 border-orange-200'
	};

	// ---------------------------------------------------------------- harian
	async function loadData() {
		if (!classId) return;
		loading = true;
		try {
			const res = await api<{
				tanggal: string;
				class_name: string;
				libur: boolean;
				records: { student_id: number; nisn: string; nama: string; status: AttendanceStatus; keterangan: string; bukti_url: string }[];
			}>(`/api/attendance?tanggal=${tanggal}&class_id=${classId}`);
			records = res.records.map((r) => ({ ...r, keterangan: r.keterangan ?? '' }));
			libur = res.libur;
			classNama = res.class_name;
			dataLoaded = true;
		} catch (e: any) {
			toast(e.message, 'error');
		} finally {
			loading = false;
		}
	}

	onMount(() => {
		if (tab === 'harian' && classId) loadData();
		if (tab === 'mapel') loadMapelSubjects();
	});

	function setStatus(studentId: number, status: AttendanceStatus) {
		records = records.map((r) => (r.student_id === studentId ? { ...r, status } : r));
	}

	function allHadir() {
		records = records.map((r) => ({ ...r, status: 'hadir' as AttendanceStatus, keterangan: '' }));
	}

	async function save() {
		if (!classId || records.length === 0) return;
		saving = true;
		try {
			const res = await api<{ ok: boolean; dicatat: number }>('/api/attendance', {
				method: 'POST',
				body: JSON.stringify({
					tanggal,
					class_id: classId,
					entries: records.map((r) => ({ student_id: r.student_id, status: r.status, keterangan: r.keterangan, bukti_url: r.bukti_url }))
				})
			});
			toast(`Absensi tersimpan (${res.dicatat} siswa)`);
			await loadData();
		} catch (e: any) {
			toast(e.message, 'error');
		} finally {
			saving = false;
		}
	}

	function jumlah(status: AttendanceStatus) {
		return records.filter((r) => r.status === status).length;
	}

	// ---------------------------------------------------------------- mapel
	async function loadMapelSubjects() {
		if (!mClassId) {
			mSubjects = [];
			return;
		}
		try {
			const res = await api<Subject[]>(`/api/subjects?class_id=${mClassId}`);
			if (isGuruMapel) {
				const mine = new Set(data.teacherSubjects.map((s) => s.id));
				mSubjects = res.filter((s) => mine.has(s.id));
			} else {
				mSubjects = res;
			}
			const stillValid = mSubjects.some((s) => s.id === Number(mSubjectId));
			if (!stillValid) mSubjectId = mSubjects[0]?.id ?? '';
			if (mSubjectId) loadMapelData();
		} catch (e: any) {
			toast(e.message, 'error');
		}
	}

	async function loadMapelData() {
		if (!mClassId || !mSubjectId) return;
		mLoading = true;
		try {
			const res = await api<{
				class_name: string;
				libur: boolean;
				records: { student_id: number; nisn: string; nama: string; status: AttendanceStatus; keterangan: string }[];
			}>(`/api/attendance/subject?tanggal=${mTanggal}&class_id=${mClassId}&subject_id=${mSubjectId}&jam_ke=${mJamKe}`);
			mRecords = res.records.map((r) => ({ ...r, keterangan: r.keterangan ?? '' }));
			mLibur = res.libur;
			mClassNama = res.class_name;
			mLoaded = true;
		} catch (e: any) {
			toast(e.message, 'error');
		} finally {
			mLoading = false;
		}
	}

	function mSetStatus(studentId: number, status: AttendanceStatus) {
		mRecords = mRecords.map((r) => (r.student_id === studentId ? { ...r, status } : r));
	}

	function mAllHadir() {
		mRecords = mRecords.map((r) => ({ ...r, status: 'hadir' as AttendanceStatus, keterangan: '' }));
	}

	async function mSave() {
		if (!mClassId || !mSubjectId || mRecords.length === 0) return;
		mSaving = true;
		try {
			const res = await api<{ ok: boolean; dicatat: number }>('/api/attendance/subject', {
				method: 'POST',
				body: JSON.stringify({
					tanggal: mTanggal,
					class_id: mClassId,
					subject_id: Number(mSubjectId),
					jam_ke: mJamKe,
					entries: mRecords.map((r) => ({ student_id: r.student_id, status: r.status, keterangan: r.keterangan }))
				})
			});
			toast(`Absensi mapel tersimpan (${res.dicatat} siswa)`);
			await loadMapelData();
		} catch (e: any) {
			toast(e.message, 'error');
		} finally {
			mSaving = false;
		}
	}

	function mJumlah(status: AttendanceStatus) {
		return mRecords.filter((r) => r.status === status).length;
	}

	async function uploadBukti(studentId: number, file: File | null) {
		if (!file) return;
		uploadingId = studentId;
		try {
			const fd = new FormData();
			fd.append('file', file);
			const res = await fetch('/api/attendance/upload', { method: 'POST', body: fd });
			const body = await res.json().catch(() => null);
			if (!res.ok) throw new Error(body?.message ?? 'Gagal mengunggah');
			records = records.map((r) => (r.student_id === studentId ? { ...r, bukti_url: body.url } : r));
			toast('Bukti berhasil diunggah');
		} catch (e: any) {
			toast(e.message, 'error');
		} finally {
			uploadingId = null;
		}
	}

	function inisial(nama: string) {
		return nama
			.split(' ')
			.filter(Boolean)
			.slice(0, 2)
			.map((w) => w[0])
			.join('')
			.toUpperCase();
	}
</script>

<svelte:head><title>Input Absensi — Aplikasi Wali Kelas</title></svelte:head>

<!-- Chip status cepat (versi mobile) -->
{#snippet chipGroup(selected: AttendanceStatus, onPick: (s: AttendanceStatus) => void)}
	<div class="grid grid-cols-5 gap-1.5 w-full">
		{#each statuses as s}
			<button
				type="button"
				class="flex flex-col items-center justify-center gap-0.5 py-2.5 rounded-xl border-2 transition-all cursor-pointer select-none touch-manipulation active:scale-95 {chipCls[s]}"
				data-on={selected === s}
				onclick={() => onPick(s)}
				aria-label={STATUS_LABEL[s]}
			>
				<span class="text-lg font-bold leading-none">{LETTER[s]}</span>
				<span class="text-[10px] font-medium leading-none">{SHORT[s]}</span>
			</button>
		{/each}
	</div>
{/snippet}

<!-- Kartu siswa versi mobile -->
{#snippet studentCard(r: any, idx: number, onPick: (id: number, s: AttendanceStatus) => void, isMapel: boolean)}
	<div class="rounded-2xl border border-slate-200 bg-white p-3 space-y-2.5 shadow-sm">
		<div class="flex items-center gap-3">
			<div class={`w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${r.status === 'hadir' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
				{inisial(r.nama)}
			</div>
			<div class="min-w-0 flex-1">
				<div class="font-semibold text-slate-900 text-sm truncate">{r.nama}</div>
				<div class="text-[11px] text-slate-400">#{idx + 1} • NISN {r.nisn || '-'}</div>
			</div>
			<span class="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full {r.status === 'hadir' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}">
				<span class="w-1.5 h-1.5 rounded-full {r.status === 'hadir' ? 'bg-emerald-500' : 'bg-rose-500'}"></span>
				{STATUS_LABEL[r.status as AttendanceStatus]}
			</span>
		</div>
		{@render chipGroup(r.status, (s) => onPick(r.student_id, s))}
			{#if r.status !== 'hadir'}
				<input
					class="w-full text-sm"
					placeholder="Catatan (opsional)"
					bind:value={r.keterangan}
				/>
			{/if}
		</div>
	{/snippet}

	<!-- Baris tabel versi desktop -->
	{#snippet tableRow(r: any, idx: number, onPick: (id: number, s: AttendanceStatus) => void, isMapel: boolean)}
		<tr>
			<td class="text-slate-400">{idx + 1}</td>
			<td class="font-medium">{r.nama}</td>
			<td class="text-slate-500">{r.nisn || '-'}</td>
			<td>
				<div class="flex flex-wrap gap-1.5">
					{#each statuses as s}
						<button
							type="button"
							class="px-3 py-1.5 rounded-lg border text-xs font-semibold transition-colors cursor-pointer {statusBtnCls[s]}"
							data-active={r.status === s}
							onclick={() => onPick(r.student_id, s)}
						>
							{STATUS_LABEL[s]}
						</button>
					{/each}
				</div>
			</td>
			<td>
				{#if r.status !== 'hadir'}
					<input class="w-full min-w-32" placeholder="Catatan (opsional)" bind:value={r.keterangan} />
				{/if}
			</td>
		</tr>
	{/snippet}

<!-- Ringkasan jumlah status -->
{#snippet summaryChips(count: (s: AttendanceStatus) => number)}
	<div class="flex flex-wrap gap-1.5">
		{#each statuses as s}
			<span class="badge-{s}">{LETTER[s]}: {count(s)}</span>
		{/each}
	</div>
{/snippet}

<div class="space-y-6">
	<div class="flex flex-wrap items-center justify-between gap-3">
		<p class="text-sm text-slate-500">Tandai siswa yang tidak hadir — default sudah <b>Hadir</b> untuk semua.</p>
		<div class="flex rounded-xl border border-slate-300 bg-white p-1 gap-1">
			{#if !isGuruMapel}
				<button
					class="px-4 py-1.5 rounded-lg text-sm font-medium cursor-pointer transition-colors {tab === 'harian' ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-100'}"
					onclick={() => (tab = 'harian')}
				>
					Absensi Harian
				</button>
			{/if}
			<button
				class="px-4 py-1.5 rounded-lg text-sm font-medium cursor-pointer transition-colors {tab === 'mapel' ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-100'}"
				onclick={() => (tab = 'mapel')}
			>
				Per Mapel
			</button>
		</div>
	</div>

	{#if tab === 'harian'}
		<!-- Filter: tanggal & kelas -->
		<div class="card p-4 grid grid-cols-2 gap-3 md:flex md:flex-wrap md:items-end md:gap-4">
			<div>
				<label class="label" for="tanggal">Tanggal</label>
				<input id="tanggal" type="date" bind:value={tanggal} onchange={loadData} class="w-full" />
			</div>
			<div>
				<label class="label" for="kelas">Kelas</label>
				<select id="kelas" bind:value={classId} onchange={loadData} disabled={isWali} class="w-full">
					{#each classes as c}
						<option value={c.id}>Kelas {c.nama}</option>
					{/each}
				</select>
			</div>
			<div class="col-span-2 text-xs text-slate-500 md:text-sm md:self-center">
				{formatDateId(tanggal)}{classNama ? ` • Kelas ${classNama}` : ''}
			</div>
		</div>

		{#if libur}
			<div class="bg-amber-50 border border-amber-200 text-amber-800 rounded-xl px-5 py-4 text-sm">
				Tanggal ini tercatat sebagai hari libur pada kalender akademik — absensi tidak dapat diinput.
			</div>
		{/if}

		{#if loading}
			<div class="text-center py-10 text-slate-400">Memuat data...</div>
		{:else if records.length > 0}
			<div class="card overflow-hidden">
				<div class="px-4 md:px-5 py-3.5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2.5">
					<div class="text-xs md:text-sm text-slate-600">
						<span class="font-semibold text-slate-900">{records.length}</span> siswa
						<div class="mt-1.5 md:mt-0 md:inline-block"><span class="hidden md:inline"></span>{@render summaryChips(jumlah)}</div>
					</div>
					<button class="btn-secondary !py-1.5 !px-3 text-xs" onclick={allHadir}><Icon name="check" class="w-3.5 h-3.5" /> Semua Hadir</button>
				</div>

				<!-- Versi mobile: kartu per siswa -->
				<div class="md:hidden p-3 space-y-3">
					{#each records as r, i (r.student_id)}
						{@render studentCard(r, i, (id, s) => setStatus(id, s), false)}
					{/each}
				</div>

				<!-- Versi desktop: tabel -->
				<div class="hidden md:block overflow-x-auto">
					<table class="data-table">
						<thead>
							<tr>
								<th>No</th>
								<th>Nama Siswa</th>
								<th>NISN</th>
								<th class="text-center">Status Kehadiran</th>
								<th>Keterangan</th>
							</tr>
						</thead>
						<tbody>
							{#each records as r, i (r.student_id)}
								{@render tableRow(r, i, (id, s) => setStatus(id, s), false)}
							{/each}
						</tbody>
					</table>
				</div>

				<!-- Bar simpan sticky (mobile) / footer (desktop) -->
				<div class="sticky bottom-[68px] md:static border-t border-slate-200 bg-white/95 backdrop-blur px-4 md:px-5 py-3 flex items-center gap-3 z-20">
					<div class="flex-1 min-w-0">
						<div class="text-[11px] text-slate-400 font-medium">Siap disimpan</div>
						<div class="flex flex-wrap gap-1 mt-0.5">
							{#each statuses as s}
								<span class="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">{LETTER[s]} {jumlah(s)}</span>
							{/each}
						</div>
					</div>
					<button class="btn-primary !py-3 md:!py-2.5 flex-none" onclick={save} disabled={saving || libur}>
						{#if saving}Menyimpan...{:else}<Icon name="save" class="w-4 h-4" /> Simpan{/if}
					</button>
				</div>
			</div>
		{:else}
			<div class="card p-10 text-center text-slate-400">Pilih kelas untuk mulai input absensi.</div>
		{/if}
	{:else}
		<!-- ===== Absensi per mata pelajaran ===== -->
		<div class="card p-4 grid grid-cols-2 gap-3 md:flex md:flex-wrap md:items-end md:gap-4">
			<div>
				<label class="label">Tanggal</label>
				<input type="date" bind:value={mTanggal} onchange={() => (mLoaded = false, loadMapelData())} class="w-full" />
			</div>
			<div>
				<label class="label">Kelas</label>
				<select
					bind:value={mClassId}
					onchange={() => {
						mSubjectId = '';
						loadMapelSubjects();
					}}
					disabled={isWali}
					class="w-full"
				>
					{#each classes as c}
						<option value={c.id}>Kelas {c.nama}</option>
					{/each}
				</select>
			</div>
			<div class="col-span-2 md:col-span-1">
				<label class="label">Mata Pelajaran</label>
				<select bind:value={mSubjectId} onchange={loadMapelData} class="w-full">
					{#each mSubjects as s}
						<option value={s.id}>{s.nama}</option>
					{/each}
				</select>
			</div>
			<div>
				<label class="label">Jam Ke</label>
				<select bind:value={mJamKe} onchange={loadMapelData} class="w-full">
					{#each Array.from({ length: 10 }, (_, i) => i + 1) as j}
						<option value={j}>Jam {j}</option>
					{/each}
				</select>
			</div>
			<div class="col-span-2 text-xs text-slate-500 md:text-sm md:self-center">
				{formatDateId(mTanggal)}{mClassNama ? ` • Kelas ${mClassNama}` : ''}
			</div>
		</div>

		{#if mLibur}
			<div class="bg-amber-50 border border-amber-200 text-amber-800 rounded-xl px-5 py-4 text-sm">
				Tanggal ini tercatat sebagai hari libur pada kalender akademik — absensi tidak dapat diinput.
			</div>
		{/if}

		{#if mLoading}
			<div class="text-center py-10 text-slate-400">Memuat data...</div>
		{:else if mRecords.length > 0}
			<div class="card overflow-hidden">
				<div class="px-4 md:px-5 py-3.5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2.5">
					<div class="text-xs md:text-sm text-slate-600">
						<span class="font-semibold text-slate-900">{mRecords.length}</span> siswa
						<div class="mt-1.5 md:mt-0 md:inline-block">{@render summaryChips(mJumlah)}</div>
					</div>
					<button class="btn-secondary !py-1.5 !px-3 text-xs" onclick={mAllHadir}><Icon name="check" class="w-3.5 h-3.5" /> Semua Hadir</button>
				</div>

				<div class="md:hidden p-3 space-y-3">
					{#each mRecords as r, i (r.student_id)}
						{@render studentCard(r, i, (id, s) => mSetStatus(id, s), true)}
					{/each}
				</div>

				<div class="hidden md:block overflow-x-auto">
					<table class="data-table">
						<thead>
							<tr>
								<th>No</th>
								<th>Nama Siswa</th>
								<th>NISN</th>
								<th class="text-center">Status Kehadiran</th>
								<th>Keterangan</th>
							</tr>
						</thead>
						<tbody>
							{#each mRecords as r, i (r.student_id)}
								{@render tableRow(r, i, (id, s) => mSetStatus(id, s), true)}
							{/each}
						</tbody>
					</table>
				</div>

				<div class="sticky bottom-[68px] md:static border-t border-slate-200 bg-white/95 backdrop-blur px-4 md:px-5 py-3 flex items-center gap-3 z-20">
					<div class="flex-1 min-w-0">
						<div class="text-[11px] text-slate-400 font-medium">Siap disimpan</div>
						<div class="flex flex-wrap gap-1 mt-0.5">
							{#each statuses as s}
								<span class="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">{LETTER[s]} {mJumlah(s)}</span>
							{/each}
						</div>
					</div>
					<button class="btn-primary !py-3 md:!py-2.5 flex-none" onclick={mSave} disabled={mSaving || mLibur}>
						{#if mSaving}Menyimpan...{:else}<Icon name="save" class="w-4 h-4" /> Simpan{/if}
					</button>
				</div>
			</div>
		{:else}
			<div class="card p-10 text-center text-slate-400">Pilih kelas & mata pelajaran untuk mulai input absensi.</div>
		{/if}
	{/if}

	<!-- Legenda (mobile) -->
	<div class="md:hidden px-1 pb-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-slate-500">
		<span class="font-semibold text-slate-600">Legenda:</span>
		{#each statuses as s}
			<span class="inline-flex items-center gap-1">
				<span class="inline-flex w-4 h-4 items-center justify-center rounded text-[9px] font-bold text-white {s === 'hadir' ? 'bg-emerald-600' : s === 'sakit' ? 'bg-amber-500' : s === 'izin' ? 'bg-sky-500' : s === 'alpa' ? 'bg-rose-600' : 'bg-orange-500'}">{LETTER[s]}</span>
				{SHORT[s]}
			</span>
		{/each}
	</div>
</div>
