<script lang="ts">
	import type { AttendanceStatus, MatrixReport, School } from '$lib/types';
	import { formatDateShort } from '$lib/date';

	let {
		data
	}: {
		data: {
			matrix: MatrixReport;
			school: School;
			from: string;
			to: string;
			expires_at: string;
			class_name: string | null;
			wali_kelas: string | null;
		};
	} = $props();
	const { matrix, school, from, to, expires_at, class_name, wali_kelas } = data;

	const letter: Record<AttendanceStatus, string> = { hadir: 'H', sakit: 'S', izin: 'I', alpa: 'A', terlambat: 'T' };
	const cellCls: Record<AttendanceStatus, string> = {
		hadir: 'text-emerald-700 bg-emerald-50',
		sakit: 'text-amber-700 bg-amber-50',
		izin: 'text-sky-700 bg-sky-50',
		alpa: 'text-rose-700 bg-rose-50',
		terlambat: 'text-orange-700 bg-orange-50'
	};

	function fmtTanggal(d: string) {
		const [y, m, day] = d.split('-').map(Number);
		const days = ['M', 'S', 'S', 'R', 'K', 'J', 'S'];
		return { day, weekday: days[new Date(y, m - 1, day).getDay()] };
	}

	function pctCls(p: number) {
		return p >= 90 ? 'text-emerald-600' : p >= 75 ? 'text-amber-600' : 'text-rose-600';
	}

	function fmtExpiry(iso: string) {
		const d = new Date(iso);
		return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
	}

	function bulanTitle() {
		const d = new Date(`${from}T00:00:00`);
		const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
		return `Rekap Absensi Bulan ${months[d.getMonth()]} ${d.getFullYear()}`;
	}

	function tanggalCetak() {
		return new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'numeric', year: 'numeric' });
	}
</script>

<svelte:head><title>Laporan Publik — {school.nama}</title></svelte:head>

<div class="min-h-screen bg-slate-100 p-4 sm:p-8">
	<div class="max-w-5xl mx-auto space-y-4">
		<!-- Kop sekolah -->
		<div class="card p-6 sm:p-8">
			<div class="flex items-start gap-4">
				{#if school.logo_url}
					<img src={school.logo_url} alt="Logo sekolah" class="w-16 h-16 sm:w-20 sm:h-20 object-contain shrink-0" />
				{/if}
				<div class="min-w-0">
					<div class="text-lg sm:text-2xl font-extrabold text-slate-900 leading-tight">{school.nama || 'Aplikasi Wali Kelas'}</div>
					{#if school.alamat}
						<div class="text-sm text-slate-600 mt-0.5">{school.alamat}</div>
					{/if}
					<div class="text-sm text-slate-600">Tahun Ajaran {school.tahun_ajaran_aktif} - Semester {school.semester_aktif}</div>
				</div>
			</div>
			<div class="mt-4">
				<div class="border-t border-slate-400"></div>
				<div class="border-t-2 border-slate-900 mt-0.5"></div>
			</div>
			<h1 class="text-center font-bold text-lg sm:text-xl text-slate-900 mt-5">{bulanTitle()}</h1>
			<div class="mt-3 grid sm:grid-cols-2 gap-x-8 gap-y-1 text-sm text-slate-700">
				<div>Kelas: <span class="font-semibold">{class_name ? `Kelas ${class_name}` : 'Semua Kelas'}</span></div>
				<div>Wali Kelas: <span class="font-semibold">{wali_kelas ?? '-'}</span></div>
				<div>Tahun Ajaran: <span class="font-semibold">{school.tahun_ajaran_aktif}</span></div>
				<div>Semester: <span class="font-semibold">{school.semester_aktif}</span></div>
				<div>Tanggal Cetak: <span class="font-semibold">{tanggalCetak()}</span></div>
				<div class="sm:text-right">
					<span class="badge badge-izin">Link Publik • Berlaku sampai {fmtExpiry(expires_at)}</span>
				</div>
			</div>
		</div>

		<div class="card overflow-hidden">
			<div class="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
				<h2 class="font-semibold text-slate-900">
					Rekap Per Tanggal
					<span class="text-sm font-normal text-slate-400"> • {matrix.dates.length} tanggal diinput • {matrix.rows.length} siswa</span>
				</h2>
			</div>
			{#if matrix.dates.length}
				<div class="overflow-x-auto">
					<table class="data-table table-frozen share-table">
						<thead>
							<tr>
								<th class="sticky left-0 bg-white z-10 min-w-10 text-center">No</th>
								<th class="sticky left-10 bg-white z-10 min-w-48 text-left">Nama Siswa</th>
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
							{#each matrix.rows as r, i}
								<tr>
									<td class="sticky left-0 bg-white z-10 text-center text-slate-400">{i + 1}</td>
									<td class="sticky left-10 bg-white z-10 font-medium whitespace-nowrap">{r.nama}</td>
									{#each matrix.dates as d}
										{@const st = r.per_date[d]}
										<td class="text-center">
											{#if st}
												<span class="inline-flex w-8 h-8 items-center justify-center rounded-md text-xs font-bold {cellCls[st]}" title={st}>{letter[st]}</span>
											{:else}
												<span class="inline-flex w-8 h-8 items-center justify-center text-slate-300">-</span>
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
							{/each}
						</tbody>
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
					</table>
				</div>
			{:else}
				<div class="p-10 text-center text-sm text-slate-400">Belum ada data absensi pada periode ini.</div>
			{/if}
			<div class="px-5 py-3 border-t border-slate-200 flex flex-wrap items-center gap-4 text-xs text-slate-500">
				<span class="font-semibold text-slate-600">Keterangan:</span>
				<span class="inline-flex items-center gap-1"><span class="inline-flex w-5 h-5 items-center justify-center rounded text-[10px] font-bold {cellCls.hadir}">H</span> Hadir</span>
				<span class="inline-flex items-center gap-1"><span class="inline-flex w-5 h-5 items-center justify-center rounded text-[10px] font-bold {cellCls.sakit}">S</span> Sakit</span>
				<span class="inline-flex items-center gap-1"><span class="inline-flex w-5 h-5 items-center justify-center rounded text-[10px] font-bold {cellCls.izin}">I</span> Izin</span>
				<span class="inline-flex items-center gap-1"><span class="inline-flex w-5 h-5 items-center justify-center rounded text-[10px] font-bold {cellCls.alpa}">A</span> Alpa</span>
				<span class="inline-flex items-center gap-1"><span class="inline-flex w-5 h-5 items-center justify-center rounded text-[10px] font-bold {cellCls.terlambat}">T</span> Terlambat</span>
				<span class="ml-auto">- belum diinput</span>
			</div>
		</div>

		<div class="text-center text-xs text-slate-400">Dibagikan melalui Aplikasi Wali Kelas</div>
	</div>
</div>
