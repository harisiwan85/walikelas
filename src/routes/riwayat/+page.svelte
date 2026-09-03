<script lang="ts">
	import type { ClassRow, User } from '$lib/types';
	import { STATUS_LABEL } from '$lib/types';
	import Badge from '$lib/components/Badge.svelte';
	import Pagination from '$lib/components/Pagination.svelte';
	import { api } from '$lib/client/api';
	import { toast } from '$lib/client/toast';
	import { formatDateShort } from '$lib/date';

	let { data }: { data: { user: User; classes: ClassRow[]; history: any[]; logs: any[]; from: string; to: string } } = $props();
	const { user, classes, history: initialHistory, logs: initialLogs, from: initialFrom, to: initialTo } = data;

	let tab = $state<'history' | 'logs'>('history');
	let filterClass = $state<number | ''>('');
	let from = $state(initialFrom);
	let to = $state(initialTo);
	let history = $state<any[]>(initialHistory);
	let logs = $state<any[]>(initialLogs);

	let historyPage = $state(1);
	let historyPageSize = $state(15);
	let paginatedHistory = $derived(history.slice((historyPage - 1) * historyPageSize, historyPage * historyPageSize));

	let logsPage = $state(1);
	let logsPageSize = $state(15);
	let paginatedLogs = $derived(logs.slice((logsPage - 1) * logsPageSize, logsPage * logsPageSize));

	async function loadHistory() {
		try {
			historyPage = 1;
			const params = new URLSearchParams({ from, to });
			if (filterClass) params.set('class_id', String(filterClass));
			history = await api<any[]>(`/api/attendance/history?${params}`);
		} catch (e: any) {
			toast(e.message, 'error');
		}
	}

	async function loadLogs() {
		try {
			logsPage = 1;
			logs = await api<any[]>('/api/attendance/logs');
		} catch (e: any) {
			toast(e.message, 'error');
		}
	}

	function switchTab(t: 'history' | 'logs') {
		tab = t;
		if (t === 'logs') loadLogs();
	}
</script>

<svelte:head><title>Riwayat & Log — Aplikasi Wali Kelas</title></svelte:head>

<div class="space-y-6">
	<p class="text-sm text-slate-500">Riwayat absensi dan jejak perubahan data</p>

	<div class="flex gap-2">
		<button
			class="px-4 py-2 rounded-lg border text-sm font-medium cursor-pointer {tab === 'history' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 border-slate-300'}"
			onclick={() => switchTab('history')}
		>
			Riwayat Absensi
		</button>
		<button
			class="px-4 py-2 rounded-lg border text-sm font-medium cursor-pointer {tab === 'logs' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 border-slate-300'}"
			onclick={() => switchTab('logs')}
		>
			Log Perubahan
		</button>
	</div>

	{#if tab === 'history'}
		<div class="card p-4 flex flex-wrap items-end gap-4">
			<div>
				<label class="label">Kelas</label>
				<select bind:value={filterClass} onchange={loadHistory}>
					<option value="">Semua Kelas</option>
					{#each classes as c}
						<option value={c.id}>Kelas {c.nama}</option>
					{/each}
				</select>
			</div>
			<div>
				<label class="label">Dari</label>
				<input type="date" bind:value={from} onchange={loadHistory} />
			</div>
			<div>
				<label class="label">Sampai</label>
				<input type="date" bind:value={to} onchange={loadHistory} />
			</div>
		</div>

		<div class="card overflow-hidden">
			<div class="overflow-x-auto">
				<table class="data-table">
					<thead>
						<tr>
							<th class="text-center">No</th>
							<th>Tanggal</th>
							<th>Nama Siswa</th>
							<th>Kelas</th>
							<th>Status</th>
							<th>Keterangan</th>
							<th>Dicatat Oleh</th>
							<th>Diperbarui</th>
						</tr>
					</thead>
					<tbody>
						{#each paginatedHistory as h, i}
							<tr>
								<td class="text-center text-slate-400">{(historyPage - 1) * historyPageSize + i + 1}</td>
								<td>{h.tanggal}</td>
								<td class="font-medium">{h.nama}</td>
								<td>{h.class_name}</td>
								<td><Badge status={h.status} /></td>
								<td class="text-slate-500">{h.keterangan || '-'}</td>
								<td>{h.dicatat_oleh ?? '-'}</td>
								<td class="text-slate-400 text-xs">{formatDateShort(h.updated_at?.slice(0, 10))}</td>
							</tr>
						{:else}
							<tr><td colspan="8" class="text-center py-8 text-slate-400">Belum ada catatan absensi</td></tr>
						{/each}
					</tbody>
				</table>
			</div>
			<Pagination bind:currentPage={historyPage} bind:pageSize={historyPageSize} totalItems={history.length} />
		</div>
	{:else}
		<div class="card overflow-hidden">
			<div class="overflow-x-auto">
				<table class="data-table">
					<thead>
						<tr>
							<th class="text-center">No</th>
							<th>Waktu</th>
							<th>Siswa</th>
							<th>Tanggal</th>
							<th>Dari</th>
							<th>Menjadi</th>
							<th>Oleh</th>
						</tr>
					</thead>
					<tbody>
						{#each paginatedLogs as l, i}
							<tr>
								<td class="text-center text-slate-400">{(logsPage - 1) * logsPageSize + i + 1}</td>
								<td class="text-slate-400">{l.changed_at}</td>
								<td class="font-medium">{l.nama}</td>
								<td>{l.tanggal}</td>
								<td>
									{#if l.old_status}
										{STATUS_LABEL[l.old_status as keyof typeof STATUS_LABEL]}
									{:else}
										<span class="text-slate-400">—</span>
									{/if}
								</td>
								<td><Badge status={l.new_status} /></td>
								<td>{l.user_name ?? '-'}</td>
							</tr>
						{:else}
							<tr><td colspan="7" class="text-center py-8 text-slate-400">Belum ada perubahan</td></tr>
						{/each}
					</tbody>
				</table>
			</div>
			<Pagination bind:currentPage={logsPage} bind:pageSize={logsPageSize} totalItems={logs.length} />
		</div>
	{/if}
</div>
