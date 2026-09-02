<script lang="ts">
	import type { School } from '$lib/types';
	import { toast } from '$lib/client/toast';
	import Icon from '$lib/components/Icon.svelte';

	let { data }: { data: { school: School | null } } = $props();
	const school = $derived(data?.school);
	const schoolName = $derived(school?.nama || 'Aplikasi Wali Kelas');

	let identifier = $state('');
	let password = $state('');
	let showPassword = $state(false);
	let loading = $state(false);
	let errorMsg = $state('');

	const demo = [
		{ label: 'Admin', username: 'admin', password: 'admin123', icon: 'shield', desc: 'Kelola data & akun' },
		{ label: 'Wali Kelas', username: 'siti', password: 'wali123', icon: 'siswa', desc: 'Input absensi 7A' },
		{ label: 'Kepala Sekolah', username: 'kepala', password: 'kepala123', icon: 'sekolah', desc: 'Pantau semua kelas' },
		{ label: 'Guru Mapel', username: 'anto', password: 'guru123', icon: 'mapel', desc: 'Absensi per jam' }
	];

	function fill(d: (typeof demo)[number]) {
		identifier = d.username;
		password = d.password;
		errorMsg = '';
	}

	async function submit() {
		loading = true;
		errorMsg = '';
		try {
			const res = await fetch('/api/auth/login', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ username: identifier, password })
			});
			const body = await res.json().catch(() => null);
			if (!res.ok) throw new Error(body?.message ?? 'Login gagal');
			toast(`Selamat datang, ${body.user?.name ?? ''}`);
			window.location.href = '/';
		} catch (e: any) {
			errorMsg = e.message;
		} finally {
			loading = false;
		}
	}
</script>

	<div class="min-h-screen flex bg-slate-100">
		<!-- Panel branding -->
		<div class="hidden lg:flex lg:w-[46%] bg-gradient-to-br from-indigo-900 via-indigo-700 to-sky-600 text-white flex-col justify-between p-12">
			<div class="flex items-center gap-3">
				<div class="w-11 h-11 rounded-2xl bg-white/15 backdrop-blur flex items-center justify-center overflow-hidden">
					{#if school?.logo_url}
						<img src={school.logo_url} alt="Logo" class="w-full h-full object-cover" />
					{:else}
						<Icon name="sekolah" class="w-6 h-6" />
					{/if}
				</div>
				<div>
					<div class="font-bold text-lg leading-tight">{schoolName}</div>
					<div class="text-xs text-indigo-200">{school?.npsn ? `NPSN: ${school.npsn}` : 'Sistem absensi & laporan sekolah'}</div>
				</div>
			</div>
			<div class="space-y-6">
				<h1 class="text-3xl font-bold leading-snug">Kelola absensi, jurnal, dan laporan kelas dalam satu tempat.</h1>
				<ul class="space-y-3 text-sm text-indigo-100">
					<li class="flex items-center gap-3"><span class="w-6 h-6 rounded-lg bg-white/15 flex items-center justify-center"><Icon name="check" class="w-3.5 h-3.5" /></span> Input absensi harian & per mata pelajaran</li>
					<li class="flex items-center gap-3"><span class="w-6 h-6 rounded-lg bg-white/15 flex items-center justify-center"><Icon name="check" class="w-3.5 h-3.5" /></span> Jurnal harian guru & surat panggilan otomatis</li>
					<li class="flex items-center gap-3"><span class="w-6 h-6 rounded-lg bg-white/15 flex items-center justify-center"><Icon name="check" class="w-3.5 h-3.5" /></span> Laporan per tanggal siap cetak PDF/Excel</li>
				</ul>
			</div>
			<div class="text-xs text-indigo-200">© {new Date().getFullYear()} • {schoolName}</div>
		</div>

		<!-- Panel form -->
		<div class="flex-1 flex items-center justify-center p-4 lg:p-8">
			<div class="w-full max-w-md">
				<div class="lg:hidden flex items-center justify-center gap-3 mb-6">
					<div class="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center overflow-hidden">
						{#if school?.logo_url}
							<img src={school.logo_url} alt="Logo" class="w-full h-full object-cover" />
						{:else}
							<Icon name="sekolah" class="w-7 h-7" />
						{/if}
					</div>
					<div>
						<h1 class="text-xl font-bold text-slate-900">{schoolName}</h1>
						<p class="text-sm text-slate-500">Sistem absensi & laporan sekolah</p>
					</div>
				</div>

			<div class="card p-8">
				<h2 class="text-xl font-bold text-slate-900">Masuk</h2>
				<p class="text-sm text-slate-500 mt-1 mb-6">Gunakan username atau email akun Anda.</p>

				{#if errorMsg}
					<div class="bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded-lg px-4 py-3 mb-4">{errorMsg}</div>
				{/if}

				<form
					onsubmit={(e) => {
						e.preventDefault();
						submit();
					}}
					class="space-y-4"
				>
					<div>
						<label class="label" for="identifier">Username</label>
						<div class="relative">
							<span class="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"><Icon name="user" class="w-4 h-4" /></span>
							<input id="identifier" type="text" bind:value={identifier} placeholder="username atau email" class="w-full pl-10" required autocomplete="username" />
						</div>
					</div>
					<div>
						<label class="label" for="password">Password</label>
						<div class="relative">
							<span class="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"><Icon name="lock" class="w-4 h-4" /></span>
							<input id="password" type={showPassword ? 'text' : 'password'} bind:value={password} placeholder="••••••••" class="w-full pl-10 pr-11" required autocomplete="current-password" />
							<button
								type="button"
								class="absolute right-2.5 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 cursor-pointer"
								onclick={() => (showPassword = !showPassword)}
								aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
								title={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
							>
								<Icon name={showPassword ? 'eye-off' : 'eye'} class="w-4 h-4" />
							</button>
						</div>
					</div>
					<button type="submit" class="btn-primary w-full justify-center" disabled={loading}>
						{#if loading}Memproses...{:else}<Icon name="logout" class="w-4 h-4" /> Masuk{/if}
					</button>
				</form>

				<div class="mt-6 pt-5 border-t border-slate-200">
					<div class="text-xs font-semibold text-slate-600 mb-2">Akun demo — klik untuk mengisi:</div>
					<div class="grid grid-cols-2 gap-2">
						{#each demo as d}
							<button
								type="button"
								class="text-left bg-slate-50 hover:bg-indigo-50 hover:ring-1 hover:ring-indigo-200 rounded-xl p-2.5 transition-colors cursor-pointer"
								onclick={() => fill(d)}
							>
								<div class="flex items-center gap-2">
									<span class="w-6 h-6 rounded-md bg-indigo-100 text-indigo-600 flex items-center justify-center"><Icon name={d.icon} class="w-3.5 h-3.5" /></span>
									<span class="text-xs font-semibold text-slate-800">{d.label}</span>
								</div>
								<div class="text-[11px] text-slate-500 mt-1">{d.desc}</div>
								<div class="text-[10px] text-slate-400 font-mono mt-0.5">{d.username} • {d.password}</div>
							</button>
						{/each}
					</div>
				</div>
			</div>
		</div>
	</div>
</div>
