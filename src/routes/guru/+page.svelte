<script lang="ts">
	import type { Teacher } from '$lib/types';
	import { api } from '$lib/client/api';
	import { toast } from '$lib/client/toast';
	import Modal from '$lib/components/Modal.svelte';
	import Icon from '$lib/components/Icon.svelte';

	let { data }: { data: { teachers: Teacher[] } } = $props();
	const { teachers: initial } = data;

		let teachers = $state<Teacher[]>(initial);
		let q = $state('');
		let showModal = $state(false);
		let editing = $state<Teacher | null>(null);
		let form = $state<{ kode: string; nip: string; nuptk: string; nama: string; jabatan: string; kontak: string; foto_url: string }>({
			kode: '',
			nip: '',
			nuptk: '',
			nama: '',
			jabatan: 'guru_mapel',
			kontak: '',
			foto_url: ''
		});
		let uploadingFoto = $state(false);

		// --- kelola akun ---
		let showAccount = $state(false);
		let accountTeacher = $state<Teacher | null>(null);
		let accForm = $state({ username: '', email: '', password: '', role: 'guru_mapel' });
		let accBusy = $state(false);

		const jabatanLabel = (j: string) =>
			j === 'admin' ? 'Admin TU' : j === 'kepala_sekolah' ? 'Kepala Sekolah' : j === 'wali_kelas' ? 'Wali Kelas' : 'Guru Mapel';

		let filtered = $derived(
			teachers.filter((t) => !q || t.nama.toLowerCase().includes(q.toLowerCase()) || t.nip.includes(q) || t.kode.toLowerCase().includes(q.toLowerCase()))
		);

		function openAdd() {
			editing = null;
			form = { kode: '', nip: '', nuptk: '', nama: '', jabatan: 'guru_mapel', kontak: '', foto_url: '' };
			showModal = true;
		}

		function openEdit(t: Teacher) {
			editing = t;
			form = { kode: t.kode, nip: t.nip, nuptk: t.nuptk, nama: t.nama, jabatan: t.jabatan, kontak: t.kontak, foto_url: t.foto_url ?? '' };
			showModal = true;
		}

		async function uploadFotoGuru(file: File | null) {
			if (!file) return;
			uploadingFoto = true;
			try {
				const fd = new FormData();
				fd.append('file', file);
				const res = await fetch('/api/profile/photo', { method: 'POST', body: fd });
				const body = await res.json().catch(() => null);
				if (!res.ok) throw new Error(body?.message ?? 'Gagal mengunggah foto');
				form.foto_url = body.url;
				toast('Foto berhasil diunggah');
			} catch (e: any) {
				toast(e.message, 'error');
			} finally {
				uploadingFoto = false;
			}
		}

	async function refresh() {
		teachers = await api<Teacher[]>('/api/teachers');
	}

	async function submit() {
		try {
			if (editing) {
				await api(`/api/teachers/${editing.id}`, { method: 'PUT', body: JSON.stringify(form) });
				toast('Data guru diperbarui');
			} else {
				await api('/api/teachers', { method: 'POST', body: JSON.stringify(form) });
				toast('Guru ditambahkan');
			}
			showModal = false;
			await refresh();
		} catch (e: any) {
			toast(e.message, 'error');
		}
	}

	async function hapus(t: Teacher) {
		if (!confirm(`Hapus guru ${t.nama}?`)) return;
		try {
			await api(`/api/teachers/${t.id}`, { method: 'DELETE' });
			toast('Guru dihapus');
			await refresh();
		} catch (e: any) {
			toast(e.message, 'error');
		}
	}

	// ---------------------------------------------------------------- akun
	function openAccount(t: Teacher) {
		accountTeacher = t;
		accForm = {
			username: t.username ?? '',
			email: t.user_email ?? '',
			password: '',
			role: t.user_role ?? t.jabatan
		};
		showAccount = true;
	}

	async function saveAccount() {
		const teacher = accountTeacher;
		if (!teacher) return;
		accBusy = true;
		try {
			const res = await api<{ ok: boolean }>(`/api/teachers/${teacher.id}/account`, {
				method: 'PUT',
				body: JSON.stringify({ username: accForm.username, email: accForm.email, password: accForm.password, role: accForm.role })
			});
			if (!res.ok) throw new Error('Gagal menyimpan akun');
			toast('Akun tersimpan');
			accForm.password = '';
			await refresh();
			const updated = teachers.find((t) => t.id === teacher.id);
			if (updated) openAccount(updated);
		} catch (e: any) {
			toast(e.message, 'error');
		} finally {
			accBusy = false;
		}
	}

	async function resetPassword() {
		if (!accountTeacher) return;
		if (!accForm.password || accForm.password.length < 6) {
			toast('Isi password baru minimal 6 karakter', 'error');
			return;
		}
		accBusy = true;
		try {
			await api(`/api/teachers/${accountTeacher.id}/reset-password`, { method: 'POST', body: JSON.stringify({ password: accForm.password }) });
			toast('Password akun di-reset');
			accForm.password = '';
		} catch (e: any) {
			toast(e.message, 'error');
		} finally {
			accBusy = false;
		}
	}

	async function loginAs(t: Teacher) {
		if (!confirm(`Login sebagai ${t.nama} (${jabatanLabel(t.jabatan)})?`)) return;
		try {
			const res = await api<{ ok: boolean }>('/api/auth/impersonate', {
				method: 'POST',
				body: JSON.stringify({ teacher_id: t.id })
			});
			if (!res.ok) throw new Error('Gagal login sebagai guru');
			toast(`Masuk sebagai ${t.nama}`);
			window.location.href = '/';
		} catch (e: any) {
			toast(e.message, 'error');
		}
	}
</script>

<svelte:head><title>Data Guru — Aplikasi Wali Kelas</title></svelte:head>

<div class="space-y-6">
	<div class="flex items-center justify-between gap-3">
		<p class="text-sm text-slate-500">{teachers.length} guru tercatat</p>
		<button class="btn-primary" onclick={openAdd}><Icon name="plus" class="w-4 h-4" /> Tambah Guru</button>
	</div>

	<div class="card p-4">
		<div class="relative">
			<span class="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"><Icon name="search" class="w-4 h-4" /></span>
			<input class="w-full pl-9" placeholder="Cari nama / NIP / kode..." bind:value={q} />
		</div>
	</div>

	<div class="card overflow-hidden">
		<div class="overflow-x-auto">
			<table class="data-table">
					<thead>
						<tr>
							<th class="text-center">No</th>
							<th>Foto</th>
							<th>Nama</th>
							<th>Kode</th>
							<th>NIP</th>
							<th>Jabatan</th>
							<th>Akun Login</th>
							<th class="text-right">Aksi</th>
						</tr>
					</thead>
					<tbody>
						{#each filtered as t, i}
							<tr>
								<td class="text-center text-slate-400">{i + 1}</td>
								<td>
									<div class="w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center overflow-hidden shrink-0 ring-1 ring-slate-200">
										{#if t.foto_url}
											<img src={t.foto_url} alt={t.nama} class="w-full h-full object-cover" />
										{:else}
											<Icon name="user" class="w-4 h-4" />
										{/if}
									</div>
								</td>
								<td class="font-medium">{t.nama}</td>
								<td class="font-mono text-xs text-slate-500">{t.kode || '-'}</td>
								<td class="text-slate-500">{t.nip || '-'}</td>
								<td><span class="badge-neutral">{jabatanLabel(t.jabatan)}</span></td>
								<td>
									{#if t.username}
										<span class="inline-flex items-center gap-1.5 text-xs">
											<span class="badge badge-hadir"><Icon name="user" class="w-3 h-3" /> {t.username}</span>
											<span class="text-slate-400">{t.user_role}</span>
										</span>
									{:else}
										<span class="text-xs text-slate-400">Belum ada akun</span>
									{/if}
								</td>
								<td class="text-right whitespace-nowrap">
									<button class="inline-flex items-center gap-1 text-indigo-600 hover:underline text-xs font-semibold cursor-pointer mr-3" onclick={() => openAccount(t)}><Icon name="user" class="w-3.5 h-3.5" /> Akun</button>
									<button class="inline-flex items-center gap-1 text-emerald-600 hover:underline text-xs font-semibold cursor-pointer mr-3" onclick={() => loginAs(t)} title="Login sebagai guru ini"><Icon name="logout" class="w-3.5 h-3.5" /> Masuk sebagai</button>
									<button class="inline-flex items-center gap-1 text-indigo-600 hover:underline text-xs font-semibold cursor-pointer mr-3" onclick={() => openEdit(t)}><Icon name="edit" class="w-3.5 h-3.5" /> Edit</button>
									<button class="inline-flex items-center gap-1 text-rose-600 hover:underline text-xs font-semibold cursor-pointer" onclick={() => hapus(t)}><Icon name="trash" class="w-3.5 h-3.5" /> Hapus</button>
								</td>
							</tr>
						{:else}
							<tr><td colspan="8" class="text-center py-8 text-slate-400">Tidak ada data guru</td></tr>
						{/each}
					</tbody>
			</table>
		</div>
	</div>
</div>

	<Modal open={showModal} title={editing ? 'Edit Guru' : 'Tambah Guru'} onclose={() => (showModal = false)}>
		<div class="space-y-4">
			<!-- Upload Foto Guru -->
			<div class="flex items-center gap-4 p-3 bg-slate-50 rounded-xl border border-slate-200">
				<div class="w-16 h-16 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center overflow-hidden shrink-0 ring-2 ring-indigo-200">
					{#if form.foto_url}
						<img src={form.foto_url} alt="Avatar" class="w-full h-full object-cover" />
					{:else}
						<Icon name="user" class="w-8 h-8" />
					{/if}
				</div>
				<div class="flex-1 min-w-0">
					<div class="text-sm font-semibold text-slate-900">Foto Avatar Guru</div>
					<div class="text-xs text-slate-500 mb-2">Format JPG, PNG, WEBP (maks. 2 MB)</div>
					<div class="flex items-center gap-2">
						<label class="btn-secondary text-xs py-1.5 px-3 cursor-pointer">
							{uploadingFoto ? 'Mengunggah...' : 'Pilih Foto'}
							<input type="file" accept="image/*" class="hidden" disabled={uploadingFoto} onchange={(e) => uploadFotoGuru((e.target as HTMLInputElement).files?.[0] ?? null)} />
						</label>
						{#if form.foto_url}
							<button type="button" class="text-xs text-rose-600 hover:underline" onclick={() => (form.foto_url = '')}>Hapus</button>
						{/if}
					</div>
				</div>
			</div>

			<div>
				<label class="label">Nama Lengkap</label>
				<input class="w-full" bind:value={form.nama} />
			</div>
		<div class="grid grid-cols-2 gap-3">
			<div>
				<label class="label">Kode Guru</label>
				<input class="w-full" bind:value={form.kode} placeholder="mis. GR001" />
			</div>
			<div>
				<label class="label">NIP</label>
				<input class="w-full" bind:value={form.nip} />
			</div>
		</div>
		<div>
			<label class="label">NUPTK</label>
			<input class="w-full" bind:value={form.nuptk} />
		</div>
		<div class="grid grid-cols-2 gap-3">
			<div>
				<label class="label">Jabatan</label>
				<select class="w-full" bind:value={form.jabatan}>
					<option value="guru_mapel">Guru Mapel</option>
					<option value="wali_kelas">Wali Kelas</option>
					<option value="kepala_sekolah">Kepala Sekolah</option>
					<option value="admin">Admin TU</option>
				</select>
			</div>
			<div>
				<label class="label">Kontak</label>
				<input class="w-full" bind:value={form.kontak} />
			</div>
		</div>
		<div class="flex justify-end gap-2 pt-2">
			<button class="btn-secondary" onclick={() => (showModal = false)}>Batal</button>
			<button class="btn-primary" onclick={submit} disabled={!form.nama}>Simpan</button>
		</div>
	</div>
</Modal>

<Modal open={showAccount} title={`Kelola Akun — ${accountTeacher?.nama ?? ''}`} onclose={() => (showAccount = false)}>
	<div class="space-y-3">
		<p class="text-xs text-slate-500">
			Buat atau perbarui akun login guru. Username dipakai untuk login; password dikosongkan berarti tidak diubah.
		</p>
		<div class="grid grid-cols-2 gap-3">
			<div>
				<label class="label">Username</label>
				<input class="w-full" bind:value={accForm.username} placeholder="mis. budi" />
			</div>
			<div>
				<label class="label">Email</label>
				<input class="w-full" type="email" bind:value={accForm.email} placeholder="guru@sekolah.sch.id" />
			</div>
		</div>
		<div class="grid grid-cols-2 gap-3">
			<div>
				<label class="label">Password {accountTeacher?.username ? '(kosongkan = tidak diubah)' : '(wajib untuk akun baru)'}</label>
				<input class="w-full" type="password" bind:value={accForm.password} placeholder="Minimal 6 karakter" />
			</div>
			<div>
				<label class="label">Role Akun</label>
				<select class="w-full" bind:value={accForm.role}>
					<option value="guru_mapel">Guru Mapel</option>
					<option value="wali_kelas">Wali Kelas</option>
					<option value="kepala_sekolah">Kepala Sekolah</option>
					<option value="admin">Admin TU</option>
				</select>
			</div>
		</div>
		<div class="flex flex-wrap items-center justify-between gap-3 pt-2">
			<button class="btn-secondary" onclick={resetPassword} disabled={accBusy}><Icon name="lock" class="w-4 h-4" /> Reset Password</button>
			<div class="flex gap-2">
				<button class="btn-secondary" onclick={() => (showAccount = false)}>Tutup</button>
				<button class="btn-primary" onclick={saveAccount} disabled={accBusy}>{accBusy ? 'Menyimpan...' : 'Simpan Akun'}</button>
			</div>
		</div>
	</div>
</Modal>
