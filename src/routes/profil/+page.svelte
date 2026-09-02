<script lang="ts">
	import type { Role, User } from '$lib/types';
	import { ROLES } from '$lib/types';
	import { toast } from '$lib/client/toast';
	import Icon from '$lib/components/Icon.svelte';

	let { data }: { data: { user: User } } = $props();
	let profile = $state<User>(data.user);

	let name = $state(data.user.name);
	let savingName = $state(false);
	let uploading = $state(false);

	let oldPassword = $state('');
	let newPassword = $state('');
	let confirmPassword = $state('');
	let savingPass = $state(false);

	async function saveName() {
		if (!name.trim()) {
			toast('Nama tidak boleh kosong', 'error');
			return;
		}
		savingName = true;
		try {
			const res = await fetch('/api/profile', {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ name: name.trim() })
			});
			const body = await res.json().catch(() => null);
			if (!res.ok) throw new Error(body?.message ?? 'Gagal menyimpan profil');
			profile = { ...profile, name: name.trim() };
			toast('Profil diperbarui');
		} catch (e: any) {
			toast(e.message, 'error');
		} finally {
			savingName = false;
		}
	}

	async function uploadFoto(file: File | null) {
		if (!file) return;
		uploading = true;
		try {
			const fd = new FormData();
			fd.append('file', file);
			const res = await fetch('/api/profile/photo', { method: 'POST', body: fd });
			const body = await res.json().catch(() => null);
			if (!res.ok) throw new Error(body?.message ?? 'Gagal mengunggah foto');
			profile = { ...profile, foto_url: body.url };
			toast('Foto profil diperbarui');
		} catch (e: any) {
			toast(e.message, 'error');
		} finally {
			uploading = false;
		}
	}

	async function changePassword() {
		if (!oldPassword || !newPassword) {
			toast('Isi password lama dan baru', 'error');
			return;
		}
		if (newPassword.length < 6) {
			toast('Password baru minimal 6 karakter', 'error');
			return;
		}
		if (newPassword !== confirmPassword) {
			toast('Konfirmasi password tidak sama', 'error');
			return;
		}
		savingPass = true;
		try {
			const res = await fetch('/api/profile/password', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ old_password: oldPassword, new_password: newPassword })
			});
			const body = await res.json().catch(() => null);
			if (!res.ok) throw new Error(body?.message ?? 'Gagal mengganti password');
			toast('Password berhasil diganti');
			oldPassword = '';
			newPassword = '';
			confirmPassword = '';
		} catch (e: any) {
			toast(e.message, 'error');
		} finally {
			savingPass = false;
		}
	}

	const roleKey = $derived(ROLES[profile.role as Role]);
</script>

<svelte:head><title>Profil — Aplikasi Wali Kelas</title></svelte:head>

<div class="max-w-3xl space-y-6">
	<p class="text-sm text-slate-500">Kelola informasi akun, foto profil, dan password</p>

	<div class="card p-6 flex flex-col sm:flex-row items-center gap-6">
		<div class="relative">
			<div class="w-24 h-24 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center overflow-hidden ring-4 ring-indigo-50">
				{#if profile.foto_url}
					<img src={profile.foto_url} alt="Foto profil" class="w-full h-full object-cover" />
				{:else}
					<Icon name="user" class="w-12 h-12" />
				{/if}
			</div>
			<label
				class="absolute -bottom-1 -right-1 w-9 h-9 rounded-full bg-indigo-600 text-white flex items-center justify-center cursor-pointer shadow-lg hover:bg-indigo-700"
				title="Unggah foto profil"
			>
				{#if uploading}
					<span class="text-[10px] font-bold">...</span>
				{:else}
					<Icon name="camera" class="w-4 h-4" />
				{/if}
				<input type="file" accept="image/*" class="hidden" onchange={(e) => uploadFoto((e.target as HTMLInputElement).files?.[0] ?? null)} />
			</label>
		</div>
		<div class="text-center sm:text-left">
			<div class="text-xl font-bold text-slate-900">{profile.name}</div>
			<div class="text-sm text-slate-500">{profile.email}</div>
			<div class="mt-2 flex flex-wrap items-center justify-center sm:justify-start gap-2">
				<span class="badge badge-hadir">{roleKey}</span>
				{#if profile.class_name}
					<span class="badge badge-izin">Kelas {profile.class_name}</span>
				{/if}
			</div>
		</div>
	</div>

	<div class="card p-6 space-y-4">
		<h2 class="font-semibold text-slate-900 flex items-center gap-2"><Icon name="edit" class="w-4 h-4 text-indigo-600" /> Edit Profil</h2>
		<div class="grid sm:grid-cols-2 gap-4">
			<div>
				<label class="label">Nama Lengkap</label>
				<input class="w-full" bind:value={name} placeholder="Nama lengkap" />
			</div>
			<div>
				<label class="label">Email</label>
				<input class="w-full bg-slate-50 text-slate-500" value={profile.email} disabled />
			</div>
		</div>
		<div class="flex justify-end">
			<button class="btn-primary" onclick={saveName} disabled={savingName || name.trim() === profile.name}>
				{savingName ? 'Menyimpan...' : 'Simpan Profil'}
			</button>
		</div>
	</div>

	<div class="card p-6 space-y-4">
		<h2 class="font-semibold text-slate-900 flex items-center gap-2"><Icon name="lock" class="w-4 h-4 text-indigo-600" /> Ganti Password</h2>
		<div class="grid sm:grid-cols-3 gap-4">
			<div>
				<label class="label">Password Lama</label>
				<input class="w-full" type="password" bind:value={oldPassword} placeholder="Password saat ini" />
			</div>
			<div>
				<label class="label">Password Baru</label>
				<input class="w-full" type="password" bind:value={newPassword} placeholder="Minimal 6 karakter" />
			</div>
			<div>
				<label class="label">Konfirmasi Password</label>
				<input class="w-full" type="password" bind:value={confirmPassword} placeholder="Ulangi password baru" />
			</div>
		</div>
		<div class="flex justify-end">
			<button class="btn-primary" onclick={changePassword} disabled={savingPass}>
				{savingPass ? 'Menyimpan...' : 'Ganti Password'}
			</button>
		</div>
	</div>
</div>
