<script lang="ts">
	import type { DashboardSummary, User } from '$lib/types';
	import { ROLES } from '$lib/types';
	import Icon from '$lib/components/Icon.svelte';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import AreaChart from '$lib/components/AreaChart.svelte';
	import Badge from '$lib/components/Badge.svelte';
	import { formatDateShort } from '$lib/date';

	let { data }: { data: { summary: DashboardSummary; user: User; tanggalLabel: string } } = $props();
	const { summary, user, tanggalLabel } = data;

	const canInput = user.role === 'admin' || user.role === 'wali_kelas';

	const pct = (n: number) => (summary.total_siswa ? Math.round((n / summary.total_siswa) * 100) : 0);

	const statCards = [
		{
			label: 'Hadir',
			value: summary.hadir,
			icon: 'check',
			grad: 'from-emerald-500 to-teal-600',
			shadow: 'shadow-emerald-500/30',
			bar: pct(summary.hadir),
			note: `${pct(summary.hadir)}% siswa`
		},
		{
			label: 'Sakit',
			value: summary.sakit,
			icon: 'heart',
			grad: 'from-amber-400 to-orange-500',
			shadow: 'shadow-amber-500/30',
			bar: pct(summary.sakit),
			note: `${pct(summary.sakit)}% siswa`
		},
		{
			label: 'Izin',
			value: summary.izin,
			icon: 'file-text',
			grad: 'from-sky-400 to-blue-600',
			shadow: 'shadow-sky-500/30',
			bar: pct(summary.izin),
			note: `${pct(summary.izin)}% siswa`
		},
		{
			label: 'Alpa',
			value: summary.alpa,
			icon: 'user-x',
			grad: 'from-rose-500 to-red-600',
			shadow: 'shadow-rose-500/30',
			bar: pct(summary.alpa),
			note: `${pct(summary.alpa)}% siswa`
		},
		{
			label: 'Terlambat',
			value: summary.terlambat,
			icon: 'clock',
			grad: 'from-orange-400 to-amber-600',
			shadow: 'shadow-orange-500/30',
			bar: pct(summary.terlambat),
			note: `${pct(summary.terlambat)}% siswa`
		},
		{
			label: 'Belum Dicatat',
			value: summary.belum_dicatat,
			icon: 'info',
			grad: 'from-slate-400 to-slate-600',
			shadow: 'shadow-slate-500/30',
			bar: pct(summary.belum_dicatat),
			note: `${pct(summary.belum_dicatat)}% siswa`
		}
	];

	const quickActions = [
		{ href: '/absensi', label: 'Input Absensi', icon: 'absensi', show: canInput },
		{ href: '/laporan', label: 'Lihat Laporan', icon: 'laporan', show: true },
		{ href: '/jurnal', label: 'Tulis Jurnal', icon: 'jurnal', show: user.role === 'admin' || user.role === 'wali_kelas' }
	].filter((a) => a.show);
</script>

<svelte:head><title>Dashboard — Aplikasi Wali Kelas</title></svelte:head>

<div class="space-y-6">
	<div class="flex flex-wrap items-center justify-between gap-3">
		<p class="text-sm text-slate-500">
			{tanggalLabel} • {ROLES[user.role]}{user.class_name ? ` • Kelas ${user.class_name}` : ''}
		</p>
		<div class="flex gap-2">
			{#each quickActions as a}
				<a href={a.href} class="btn-primary">
					<Icon name={a.icon} class="w-4 h-4" /> {a.label}
				</a>
			{/each}
		</div>
	</div>

	{#if summary.libur}
		<div class="bg-amber-50 border border-amber-200 text-amber-800 rounded-xl px-5 py-4 text-sm flex items-center gap-2">
			<Icon name="kalender" class="w-4 h-4" />				Hari ini adalah hari libur{summary.keterangan_libur ? ` (${summary.keterangan_libur})` : ' (libur sekolah)'} — absensi tidak dihitung.
		</div>
	{/if}

	<!-- Kartu statistik -->
	<div class="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
		{#each statCards as c}
			<div
				class={`rounded-2xl p-4 text-white bg-gradient-to-br ${c.grad} shadow-lg ${c.shadow} transition-transform hover:-translate-y-0.5`}
			>
				<div class="flex items-start justify-between">
					<div class="min-w-0">
						<div class="text-[11px] font-medium uppercase tracking-wider opacity-80 truncate">{c.label}</div>
						<div class="text-3xl font-bold mt-0.5 leading-none">{c.value}</div>
						<div class="text-[11px] opacity-80 mt-1">{c.note}</div>
					</div>
					<div class="w-10 h-10 shrink-0 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center">
						<Icon name={c.icon} class="w-5 h-5" />
					</div>
				</div>
				<div class="mt-3 h-1.5 bg-white/25 rounded-full overflow-hidden">
					<div class="h-full bg-white rounded-full transition-all" style="width: {c.bar}%"></div>
				</div>
			</div>
		{/each}
	</div>

	<div class="grid lg:grid-cols-3 gap-6">
		<!-- Grafik tren -->
		<div class="card p-5 lg:col-span-2">
			<div class="flex items-center justify-between mb-3">
				<h2 class="font-semibold text-slate-900 flex items-center gap-2">
					<Icon name="trending" class="w-4 h-4 text-indigo-600" /> Tren Kehadiran 7 Hari Terakhir
				</h2>
				<span class="badge-neutral">{summary.total_siswa} siswa</span>
			</div>
			{#if summary.trend.length > 0}
				<AreaChart data={summary.trend} />
			{:else}
				<EmptyState icon="trending" title="Belum ada data absensi" description="Input absensi harian untuk mulai melihat tren kehadiran." compact />
			{/if}
		</div>

		<!-- Libur mendatang + alert -->
		<div class="space-y-6">
			<div class="card overflow-hidden">
				<div class="px-5 py-4 border-b border-slate-200">
					<h2 class="font-semibold text-slate-900 flex items-center gap-2">
						<Icon name="kalender" class="w-4 h-4 text-indigo-600" /> Kalender Akademik
					</h2>
				</div>
				<div class="p-4 space-y-2">
					{#each summary.holidays as h}
						<div class="flex items-center justify-between bg-slate-50 rounded-lg px-3 py-2">
							<div>
								<div class="text-sm font-medium text-slate-900">{formatDateShort(h.tanggal)}</div>
								<div class="text-xs text-slate-500">{h.keterangan || 'Libur'}</div>
							</div>
							<span class="badge-neutral">Libur</span>
						</div>
					{:else}
						<EmptyState icon="kalender" title="Tidak ada libur mendatang" compact />
					{/each}
				</div>
			</div>

			<div class="card overflow-hidden">
				<div class="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
					<h2 class="font-semibold text-slate-900 flex items-center gap-2">
						<Icon name="alert" class="w-4 h-4 text-rose-500" /> Alert Alpa
					</h2>
					<span class="badge-alpa">{summary.alerts.length} siswa</span>
				</div>
				<div class="p-4 space-y-2 max-h-56 overflow-y-auto">
					{#each summary.alerts as a}
						<div class="flex items-center justify-between bg-rose-50 border border-rose-100 rounded-lg px-3 py-2">
							<div>
								<div class="text-sm font-medium text-slate-900">{a.nama}</div>
								<div class="text-xs text-slate-500">{a.class_name}</div>
							</div>
							<a
								href={`/api/reports/surat-panggilan?student_id=${a.student_id}`} data-sveltekit-reload
								class="inline-flex items-center gap-1 text-xs text-rose-600 hover:underline font-semibold"
								title="Unduh surat panggilan orang tua"
							>
								<Icon name="send" class="w-3 h-3" /> Surat
							</a>
						</div>
					{:else}
						<EmptyState icon="check" title="Tidak ada siswa dengan alpa berlebih" description="Semua siswa masih di bawah ambang alpa." compact />
					{/each}
				</div>
			</div>
		</div>
	</div>

	<div class="grid lg:grid-cols-2 gap-6">
		<!-- Rekap per kelas -->
		<div class="card overflow-hidden">
			<div class="px-5 py-4 border-b border-slate-200">
				<h2 class="font-semibold text-slate-900 flex items-center gap-2">
					<Icon name="kelas" class="w-4 h-4 text-indigo-600" /> Rekap Kehadiran per Kelas — Hari Ini
				</h2>
			</div>
			<div class="overflow-x-auto">
				<table class="data-table">
					<thead>
					<tr>
						<th class="text-center">No</th>
						<th>Kelas</th>
						<th class="text-center">Hadir</th>
						<th class="text-center">Sakit</th>
						<th class="text-center">Izin</th>
						<th class="text-center">Alpa</th>
						<th class="text-center">Tgl</th>
						<th class="text-center">Belum</th>
					</tr>
					</thead>
					<tbody>
					{#each summary.per_kelas as k, i}
						<tr>
							<td class="text-center text-slate-400">{i + 1}</td>
							<td class="font-medium">{k.class_name}</td>
								<td class="text-center">{k.hadir}</td>
								<td class="text-center">{k.sakit}</td>
								<td class="text-center">{k.izin}</td>
								<td class="text-center">{k.alpa}</td>
								<td class="text-center">{k.terlambat}</td>
								<td class="text-center">{k.belum_dicatat}</td>
							</tr>
						{:else}
							<tr><td colspan="8" class="text-center py-6"><EmptyState icon="kelas" title="Belum ada data kelas" compact /></td></tr>
						{/each}
					</tbody>
				</table>
			</div>
		</div>

		<!-- Siswa tidak hadir hari ini -->
		<div class="card overflow-hidden">
			<div class="px-5 py-4 border-b border-slate-200">
				<h2 class="font-semibold text-slate-900 flex items-center gap-2">
					<Icon name="bell" class="w-4 h-4 text-amber-500" /> Tidak Hadir Hari Ini ({summary.hariIniAbsen.length})
				</h2>
			</div>
			<div class="max-h-80 overflow-y-auto">
				<table class="data-table">
					<thead>
					<tr>
						<th class="text-center">No</th>
						<th>Nama</th>
						<th>Kelas</th>
						<th class="text-center">Status</th>
						<th>Keterangan</th>
					</tr>
					</thead>
					<tbody>
						{#each summary.hariIniAbsen as a, i}
							<tr>
								<td class="text-center text-slate-400">{i + 1}</td>
								<td class="font-medium">{a.nama}</td>
								<td>{a.class_name}</td>
								<td class="text-center"><Badge status={a.status} /></td>
								<td class="text-xs text-slate-500">{a.keterangan || '-'}</td>
							</tr>
						{:else}
							<tr><td colspan="5" class="text-center py-6 text-slate-400">Semua siswa hadir hari ini</td></tr>
						{/each}
					</tbody>
				</table>
			</div>
		</div>
	</div>
</div>
