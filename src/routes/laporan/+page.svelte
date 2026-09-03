<script lang="ts">
	import type { AttendanceStatus, ClassRow, MatrixReport, ReportRow, School, User } from '$lib/types';
	import { api } from '$lib/client/api';
	import { toast } from '$lib/client/toast';
	import { addDays, monthRange, semesterRange, todayStr } from '$lib/date';
	import Icon from '$lib/components/Icon.svelte';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import Pagination from '$lib/components/Pagination.svelte';

	let { data }: { data: { user: User; classes: ClassRow[]; school: School; rows: ReportRow[]; matrix: MatrixReport; from: string; to: string } } = $props();
	const { user, classes, school, rows: initialRows, matrix: initialMatrix, from: initialFrom, to: initialTo } = data;

	const periods = [
		{ label: 'Hari Ini', from: todayStr(), to: todayStr() },
		{ label: '7 Hari Terakhir', from: addDays(todayStr(), -6), to: todayStr() },
		{ label: 'Bulan Ini', from: monthRange(todayStr().slice(0, 7)).from, to: monthRange(todayStr().slice(0, 7)).to },
		{ label: 'Semester Ini', from: semesterRange(school.tahun_ajaran_aktif, school.semester_aktif).from, to: semesterRange(school.tahun_ajaran_aktif, school.semester_aktif).to }
	];

	const isWali = user.role === 'wali_kelas';
	let view = $state<'ringkas' | 'matriks'>('matriks');
	let selectedClass = $state<number | ''>(isWali ? (user.class_id ?? '') : '');
	let from = $state(initialFrom);
	let to = $state(initialTo);
	let rows = $state<ReportRow[]>(initialRows);
	let matrix = $state<MatrixReport>(initialMatrix);
	let loading = $state(false);

	let matrixPage = $state(1);
	let matrixPageSize = $state(25);
	let paginatedMatrixRows = $derived(matrix.rows.slice((matrixPage - 1) * matrixPageSize, matrixPage * matrixPageSize));

	let summaryPage = $state(1);
	let summaryPageSize = $state(25);
	let paginatedSummaryRows = $derived(rows.slice((summaryPage - 1) * summaryPageSize, summaryPage * summaryPageSize));

	const letter: Record<AttendanceStatus, string> = { hadir: 'H', sakit: 'S', izin: 'I', alpa: 'A', terlambat: 'T' };
	const cellCls: Record<AttendanceStatus, string> = {
		hadir: 'text-emerald-700 bg-emerald-50',
		sakit: 'text-amber-700 bg-amber-50',
		izin: 'text-sky-700 bg-sky-50',
		alpa: 'text-rose-700 bg-rose-50',
		terlambat: 'text-orange-700 bg-orange-50'
	};

	const summary = $derived({
		hadir: rows.reduce((s, r) => s + r.hadir, 0),
		sakit: rows.reduce((s, r) => s + r.sakit, 0),
		izin: rows.reduce((s, r) => s + r.izin, 0),
		alpa: rows.reduce((s, r) => s + r.alpa, 0),
		terlambat: rows.reduce((s, r) => s + r.terlambat, 0),
		avg: rows.length ? Math.round((rows.reduce((s, r) => s + r.persentase, 0) / rows.length) * 10) / 10 : 0
	});

	function setPeriod(p: { from: string; to: string }) {
		from = p.from;
		to = p.to;
		loadReport();
	}

	async function loadReport() {
		loading = true;
		matrixPage = 1;
		summaryPage = 1;
		try {
			const params = new URLSearchParams({ from, to });
			if (selectedClass) params.set('class_id', String(selectedClass));
			const res = await api<{ rows: ReportRow[] }>(`/api/reports/summary?${params}`);
			rows = res.rows;
			const mat = await api<MatrixReport>(`/api/reports/matrix?${params}`);
			matrix = mat;
		} catch (e: any) {
			toast(e.message, 'error');
		} finally {
			loading = false;
		}
	}

	function exportUrl(kind: 'xlsx' | 'pdf') {
		const params = new URLSearchParams({ from, to });
		if (selectedClass) params.set('class_id', String(selectedClass));
		return `/api/reports/export.${kind}?${params}`;
	}

	// Header tanggal: hanya angka tanggal + huruf depan hari (tanpa bulan)
	function fmtTanggal(d: string) {
		const [y, m, day] = d.split('-').map(Number);
		const days = ['M', 'S', 'S', 'R', 'K', 'J', 'S'];
		return { day, weekday: days[new Date(y, m - 1, day).getDay()] };
	}

	function pctCls(p: number) {
		return p >= 90 ? 'text-emerald-600' : p >= 75 ? 'text-amber-600' : 'text-rose-600';
	}
</script>

<svelte:head><title>Laporan Absensi — Aplikasi Wali Kelas</title></svelte:head>

<div class="space-y-6">
	<div class="flex flex-wrap items-center justify-between gap-3">
		<p class="text-sm text-slate-500">Rekap kehadiran per siswa & per tanggal input</p>
		<div class="flex gap-2">
			<a class="btn-success" href={exportUrl('xlsx')} data-sveltekit-reload><Icon name="download" class="w-4 h-4" /> Export Excel</a>
			<a class="btn-secondary" href={exportUrl('pdf')} data-sveltekit-reload><Icon name="download" class="w-4 h-4" /> Export PDF</a>
		</div>
	</div>

	<div class="card p-5 space-y-4">
		<div class="flex flex-wrap gap-2">
			{#each periods as p}
				<button
					class="px-4 py-2 rounded-lg border text-sm font-medium cursor-pointer transition-colors
						{from === p.from && to === p.to ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 border-slate-300'}"
					onclick={() => setPeriod(p)}
				>
					{p.label}
				</button>
			{/each}
		</div>
		<div class="flex flex-wrap items-end gap-4">
			{#if !isWali}
				<div>
					<label class="label">Kelas</label>
					<select bind:value={selectedClass} onchange={loadReport}>
						<option value="">Semua Kelas</option>
						{#each classes as c}
							<option value={c.id}>Kelas {c.nama}</option>
						{/each}
					</select>
				</div>
			{/if}
			<div>
				<label class="label">Dari Tanggal</label>
				<input type="date" bind:value={from} onchange={loadReport} />
			</div>
			<div>
				<label class="label">Sampai Tanggal</label>
				<input type="date" bind:value={to} onchange={loadReport} />
			</div>
			<div class="flex rounded-xl border border-slate-300 bg-white p-1 gap-1 ml-auto">
				<button
					class="px-4 py-1.5 rounded-lg text-sm font-medium cursor-pointer transition-colors {view === 'matriks' ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-100'}"
					onclick={() => (view = 'matriks')}
				>
					Per Tanggal
				</button>
				<button
					class="px-4 py-1.5 rounded-lg text-sm font-medium cursor-pointer transition-colors {view === 'ringkas' ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-100'}"
					onclick={() => (view = 'ringkas')}
				>
					Ringkasan
				</button>
			</div>
		</div>
	</div>

	{#if view === 'matriks'}
		<div class="card overflow-hidden">
			<div class="px-5 py-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
				<h2 class="font-semibold text-slate-900">
					Rekap Per Tanggal
					<span class="text-sm font-normal text-slate-400"> • {matrix.class_name ? `Kelas ${matrix.class_name}` : 'Semua Kelas'} • {matrix.dates.length} tanggal diinput</span>
				</h2>
				{#if loading}<span class="text-xs text-slate-400">memuat...</span>{/if}
			</div>
			<div class="overflow-x-auto">
				<table class="data-table table-frozen">
					<thead>
						<tr>
							<th class="sticky left-0 bg-white z-10 min-w-10 text-center">No</th>
							<th class="sticky left-10 bg-white z-10 min-w-44 text-left">Nama Siswa</th>
							{#each matrix.dates as d}
								{@const f = fmtTanggal(d)}
								<th class="text-center px-2 whitespace-nowrap" title={d}>
									<div class="text-xs text-slate-400">{f.weekday}</div>
									<div class="text-base">{f.day}</div>
								</th>
							{/each}
							<th class="text-center">H</th>
							<th class="text-center">S</th>
							<th class="text-center">I</th>
							<th class="text-center">A</th>
							<th class="text-center">T</th>
							<th class="text-center">%</th>
						</tr>
					</thead>
					<tbody>
						{#each paginatedMatrixRows as r, i}
							<tr>
								<td class="sticky left-0 bg-white z-10 text-center text-slate-400">{(matrixPage - 1) * matrixPageSize + i + 1}</td>
								<td class="sticky left-10 bg-white z-10 font-medium whitespace-nowrap">{r.nama}</td>
								{#each matrix.dates as d}
									{@const st = r.per_date[d]}
									<td class="text-center">
										{#if st}
											<span class="inline-flex w-7 h-7 items-center justify-center rounded-md text-xs font-bold {cellCls[st]}" title={st}>{letter[st]}</span>
										{:else}
											<span class="inline-flex w-7 h-7 items-center justify-center text-slate-300">-</span>
										{/if}
									</td>
								{/each}
								<td class="text-center font-semibold text-emerald-600">{r.hadir}</td>
								<td class="text-center font-semibold text-amber-600">{r.sakit}</td>
								<td class="text-center font-semibold text-sky-600">{r.izin}</td>
								<td class="text-center font-semibold {r.alpa > 0 ? 'text-rose-600' : 'text-slate-300'}">{r.alpa}</td>
								<td class="text-center font-semibold text-orange-600">{r.terlambat}</td>
								<td class="text-center font-semibold {pctCls(r.persentase)}">{r.persentase}%</td>
							</tr>
						{:else}
							<tr><td colspan={matrix.dates.length + 8} class="text-center py-6"><EmptyState icon="laporan" title="Belum ada data absensi pada periode ini" compact /></td></tr>
						{/each}
					</tbody>
					{#if matrix.dates.length}
						<tfoot>
							<tr class="bg-slate-50">
								<td class="sticky left-0 bg-slate-50 z-10"></td>
								<td class="sticky left-10 bg-slate-50 z-10 font-semibold text-slate-700">% Kehadiran</td>
								{#each matrix.dates as d}
									{@const st = matrix.per_date[d]}
									<td class="text-center">
										<span class="font-bold text-xs {pctCls(st?.persentase ?? 0)}">{st ? st.persentase + '%' : '-'}</span>
									</td>
								{/each}
								<td colspan="6" class="text-center text-xs text-slate-400">% per tanggal = hadir / siswa tercatat</td>
							</tr>
						</tfoot>
					{/if}
				</table>
			</div>
			<div class="px-5 py-3 border-t border-slate-200 flex flex-wrap items-center gap-4 text-xs text-slate-500">
				<span class="font-semibold text-slate-600">Legenda:</span>
				<span class="inline-flex items-center gap-1"><span class="inline-flex w-5 h-5 items-center justify-center rounded text-[10px] font-bold {cellCls.hadir}">H</span> Hadir</span>
				<span class="inline-flex items-center gap-1"><span class="inline-flex w-5 h-5 items-center justify-center rounded text-[10px] font-bold {cellCls.sakit}">S</span> Sakit</span>
				<span class="inline-flex items-center gap-1"><span class="inline-flex w-5 h-5 items-center justify-center rounded text-[10px] font-bold {cellCls.izin}">I</span> Izin</span>
				<span class="inline-flex items-center gap-1"><span class="inline-flex w-5 h-5 items-center justify-center rounded text-[10px] font-bold {cellCls.alpa}">A</span> Alpa</span>
				<span class="inline-flex items-center gap-1"><span class="inline-flex w-5 h-5 items-center justify-center rounded text-[10px] font-bold {cellCls.terlambat}">T</span> Terlambat</span>
				<span class="ml-auto">- belum diinput</span>
			</div>
			<Pagination bind:currentPage={matrixPage} bind:pageSize={matrixPageSize} totalItems={matrix.rows.length} pageSizeOptions={[10, 25, 50, 100]} />
		</div>
	{:else}
		<div class="grid lg:grid-cols-3 gap-6">
			<div class="grid grid-cols-2 md:grid-cols-3 gap-4 lg:col-span-2">
				<div class="card p-4 text-center"><div class="text-2xl font-bold text-emerald-600">{summary.hadir}</div><div class="text-xs text-slate-500 mt-1">Hadir</div></div>
				<div class="card p-4 text-center"><div class="text-2xl font-bold text-amber-600">{summary.sakit}</div><div class="text-xs text-slate-500 mt-1">Sakit</div></div>
				<div class="card p-4 text-center"><div class="text-2xl font-bold text-sky-600">{summary.izin}</div><div class="text-xs text-slate-500 mt-1">Izin</div></div>
				<div class="card p-4 text-center"><div class="text-2xl font-bold text-rose-600">{summary.alpa}</div><div class="text-xs text-slate-500 mt-1">Alpa</div></div>
				<div class="card p-4 text-center"><div class="text-2xl font-bold text-orange-600">{summary.terlambat}</div><div class="text-xs text-slate-500 mt-1">Terlambat</div></div>
				<div class="card p-4 text-center"><div class="text-2xl font-bold text-indigo-600">{summary.avg}%</div><div class="text-xs text-slate-500 mt-1">Rata-rata Kehadiran</div></div>
			</div>
			<div class="card p-5">
				<h3 class="text-sm font-semibold text-slate-900 mb-3">Distribusi Status Absensi</h3>
				{#each [
					{ label: 'Hadir', v: summary.hadir, c: '#10b981' },
					{ label: 'Sakit', v: summary.sakit, c: '#f59e0b' },
					{ label: 'Izin', v: summary.izin, c: '#0ea5e9' },
					{ label: 'Alpa', v: summary.alpa, c: '#f43f5e' },
					{ label: 'Terlambat', v: summary.terlambat, c: '#f97316' }
				] as s}
					{@const total = summary.hadir + summary.sakit + summary.izin + summary.alpa + summary.terlambat}
					{@const pct = total > 0 ? Math.round((s.v / total) * 100) : 0}
					<div class="mb-2">
						<div class="flex justify-between text-xs text-slate-500 mb-1">
							<span>{s.label}</span><span>{s.v} ({pct}%)</span>
						</div>
						<div class="h-2 bg-slate-100 rounded-full overflow-hidden">
							<div class="h-full rounded-full" style="width:{pct}%;background:{s.c}"></div>
						</div>
					</div>
				{/each}
			</div>
		</div>

		<div class="card overflow-hidden">
			<div class="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
				<h2 class="font-semibold text-slate-900">Rekap per Siswa ({rows.length})</h2>
				{#if loading}<span class="text-xs text-slate-400">memuat...</span>{/if}
			</div>
			<div class="overflow-x-auto">
				<table class="data-table">
					<thead>
						<tr>
							<th>No</th>
							<th>Nama</th>
							<th>NISN</th>
							<th class="text-center">H</th>
							<th class="text-center">S</th>
							<th class="text-center">I</th>
							<th class="text-center">A</th>
							<th class="text-center">T</th>
							<th class="text-center">Total</th>
							<th class="text-center">% Kehadiran</th>
							<th class="text-center">Surat Panggilan</th>
						</tr>
					</thead>
					<tbody>
						{#each paginatedSummaryRows as r, i}
							<tr>
								<td class="text-slate-400">{(summaryPage - 1) * summaryPageSize + i + 1}</td>
								<td class="font-medium">{r.nama}</td>
								<td class="text-slate-500">{r.nisn || '-'}</td>
								<td class="text-center">{r.hadir}</td>
								<td class="text-center">{r.sakit}</td>
								<td class="text-center">{r.izin}</td>
								<td class="text-center font-semibold {r.alpa > 0 ? 'text-rose-600' : ''}">{r.alpa}</td>
								<td class="text-center">{r.terlambat}</td>
								<td class="text-center">{r.total}</td>
								<td class="text-center">
									<span class="badge-{r.persentase >= 90 ? 'hadir' : r.persentase >= 75 ? 'izin' : 'alpa'}">{r.persentase}%</span>
								</td>
								<td class="text-center">
									{#if r.alpa > 0}
										<a href={`/api/reports/surat-panggilan?student_id=${r.student_id}`} data-sveltekit-reload class="inline-flex items-center gap-1 text-xs text-rose-600 hover:underline font-semibold" title="Unduh surat panggilan orang tua">
											<Icon name="send" class="w-3 h-3" /> Surat
										</a>
									{:else}<span class="text-slate-300">-</span>{/if}
								</td>
							</tr>
						{:else}
							<tr><td colspan="11" class="text-center py-6"><EmptyState icon="laporan" title="Belum ada data absensi pada periode ini" compact /></td></tr>
						{/each}
					</tbody>
				</table>
			</div>
			<Pagination bind:currentPage={summaryPage} bind:pageSize={summaryPageSize} totalItems={rows.length} pageSizeOptions={[10, 25, 50, 100]} />
		</div>
	{/if}
</div>
