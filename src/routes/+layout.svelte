<script lang="ts">
	import '../app.css';
	import { page, navigating } from '$app/stores';
	import Toaster from '$lib/components/Toaster.svelte';
	import Icon from '$lib/components/Icon.svelte';
	import { ROLES } from '$lib/types';
	import type { User } from '$lib/types';

	let { children, data }: { children: import('svelte').Snippet; data: { user: User | null; dbMode?: 'supabase' | 'sqlite'; latencyMs?: number } } = $props();
	const user = data.user;

	const nav = [
		{ href: '/', label: 'Dashboard', icon: 'dashboard', roles: ['admin', 'kepala_sekolah', 'wali_kelas', 'guru_mapel'] },
		{ href: '/absensi', label: 'Input Absensi', icon: 'absensi', roles: ['admin', 'wali_kelas', 'guru_mapel'] },
		{ href: '/siswa', label: 'Data Siswa', icon: 'siswa', roles: ['admin', 'kepala_sekolah', 'wali_kelas'] },
		{ href: '/kelas', label: 'Data Kelas', icon: 'kelas', roles: ['admin'] },
		{ href: '/guru', label: 'Data Guru', icon: 'guru', roles: ['admin'] },
		{ href: '/mapel', label: 'Mata Pelajaran', icon: 'mapel', roles: ['admin'] },
		{ href: '/jurnal', label: 'Jurnal Kelas', icon: 'jurnal', roles: ['admin', 'wali_kelas', 'guru_mapel'] },
		{ href: '/kalender', label: 'Kalender Akademik', icon: 'kalender', roles: ['admin'] },
		{ href: '/laporan', label: 'Laporan', icon: 'laporan', roles: ['admin', 'kepala_sekolah', 'wali_kelas', 'guru_mapel'] },
		{ href: '/sekolah', label: 'Profil Sekolah', icon: 'sekolah', roles: ['admin'] },
		{ href: '/riwayat', label: 'Riwayat & Log', icon: 'riwayat', roles: ['admin', 'kepala_sekolah', 'wali_kelas'] }
	];

	let myNav = $derived(user ? nav.filter((n) => n.roles.includes(user.role)) : []);

	// Prioritas untuk bottom nav mobile (maks 5)
	const bottomOrder = ['/', '/absensi', '/siswa', '/laporan', '/riwayat'];
	let bottomNav = $derived(myNav.filter((n) => bottomOrder.includes(n.href)).slice(0, 5));
	let extraNav = $derived(myNav.filter((n) => !bottomOrder.includes(n.href)));

	let mobileMenu = $state(false);

	let pageTitle = $derived(nav.find((n) => n.href === $page.url.pathname)?.label ?? 'Dashboard');

	function isActive(href: string) {
		return $page.url.pathname === href;
	}

	async function logout() {
		await fetch('/api/auth/logout', { method: 'POST' });
		window.location.href = '/login';
	}
</script>

{#if !user}
	<div class="min-h-screen">
		{@render children()}
		<Toaster />
	</div>
{:else}
	<div class="min-h-screen lg:flex bg-slate-100">
		<!-- Sidebar desktop (nav saja — profil & keluar ada di header) -->
		<aside class="hidden lg:flex lg:w-64 bg-slate-900 text-slate-100 lg:min-h-screen flex-col sticky top-0 h-screen">
			<div class="px-5 py-5 border-b border-slate-800 flex items-center gap-3">
				<div class="w-9 h-9 rounded-lg bg-indigo-600 flex items-center justify-center text-white">
					<Icon name="sekolah" class="w-5 h-5" />
				</div>
				<div>
					<div class="text-sm font-bold text-white leading-tight">Aplikasi Wali Kelas</div>
					<div class="text-xs text-slate-400">{user.class_name ? `Kelas ${user.class_name}` : ROLES[user.role]}</div>
				</div>
			</div>
			<nav class="flex-1 overflow-y-auto py-3">
				{#each myNav as item}
					<a
						href={item.href}
						class="flex items-center gap-3 px-5 py-2.5 text-sm transition-colors
							{isActive(item.href) ? 'bg-indigo-600 text-white font-medium' : 'text-slate-300 hover:bg-slate-800'}"
					>
						<Icon name={item.icon} class="w-4 h-4" />
						{item.label}
					</a>
				{/each}
			</nav>
			<div class="px-5 py-4 border-t border-slate-800 flex items-center gap-3 text-sm">
				<div class="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center overflow-hidden shrink-0">
					{#if user.foto_url}
						<img src={user.foto_url} alt="Foto profil" class="w-full h-full object-cover" />
					{:else}
						<Icon name="user" class="w-4 h-4" />
					{/if}
				</div>
				<div class="min-w-0">
					<div class="font-medium text-white truncate">{user.name}</div>
					<div class="text-xs text-slate-400 truncate">{user.email}</div>
				</div>
			</div>
		</aside>

		<div class="flex-1 flex flex-col min-w-0 min-h-screen">
			<!-- Top bar desktop -->
			<header class="hidden lg:flex sticky top-0 z-30 bg-white/90 backdrop-blur border-b border-slate-200 px-8 py-3 items-center justify-between">
				<div class="text-lg font-bold text-slate-900">{pageTitle}</div>
				<div class="flex items-center gap-3">
					{#if user.role === 'admin' && data.dbMode}
						<div
							class="flex items-center gap-2 rounded-full px-3 py-1.5 text-[11px] font-medium {(data.dbMode as string) === 'mysql' ? 'bg-blue-50 text-blue-700 ring-1 ring-blue-200' : data.dbMode === 'supabase' ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200' : 'bg-slate-100 text-slate-600 ring-1 ring-slate-200'}"
							title="Mode database: {(data.dbMode as string) === 'mysql' ? 'MySQL (Remote 51.79.231.14)' : data.dbMode === 'supabase' ? 'Supabase (online)' : 'SQLite lokal (development)'}"
						>
							<span class={`w-2 h-2 rounded-full ${(data.dbMode as string) === 'mysql' ? 'bg-blue-500 animate-pulse' : data.dbMode === 'supabase' ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`}></span>
							<Icon name="database" class="w-3.5 h-3.5" />
							<span class="font-semibold">{(data.dbMode as string) === 'mysql' ? 'MySQL Remote' : data.dbMode === 'supabase' ? 'Supabase' : 'SQLite lokal'}</span>
							<span class="tabular-nums">{data.latencyMs ?? '-'} ms</span>
						</div>
					{/if}
					<a href="/profil" class="flex items-center gap-2.5 rounded-full py-1.5 pl-1.5 pr-3 hover:bg-slate-100 transition-colors" title="Profil">
						<div class="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center overflow-hidden shrink-0">
							{#if user.foto_url}
								<img src={user.foto_url} alt="Foto profil" class="w-full h-full object-cover" />
							{:else}
								<Icon name="user" class="w-4 h-4 text-white" />
							{/if}
						</div>
						<span class="text-sm font-medium text-slate-700 hidden xl:block">{user.name}</span>
					</a>
					<button
						class="p-2 rounded-full text-slate-500 hover:bg-rose-50 hover:text-rose-600 transition-colors cursor-pointer"
						onclick={logout}
						title="Keluar"
						aria-label="Keluar"
					>
						<Icon name="logout" class="w-5 h-5" />
					</button>
				</div>
			</header>

			<!-- Top bar mobile -->
			<header class="lg:hidden sticky top-0 z-30 bg-slate-900 text-white px-4 py-3 flex items-center justify-between">
				<div class="flex items-center gap-2.5">
					<div class="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center">
						<Icon name="sekolah" class="w-4 h-4" />
					</div>
					<div>
						<div class="text-sm font-bold leading-tight">Aplikasi Wali Kelas</div>
						<div class="text-[11px] text-slate-400">{pageTitle}</div>
					</div>
				</div>
				<div class="flex items-center gap-1">
					<a href="/profil" class="p-1.5 rounded-full hover:bg-slate-800" title="Profil" aria-label="Profil">
						<div class="w-7 h-7 rounded-full bg-indigo-600 flex items-center justify-center overflow-hidden">
							{#if user.foto_url}
								<img src={user.foto_url} alt="Foto profil" class="w-full h-full object-cover" />
							{:else}
								<Icon name="user" class="w-3.5 h-3.5" />
							{/if}
						</div>
					</a>
					<button class="p-2 rounded-full hover:bg-slate-800 cursor-pointer" onclick={logout} title="Keluar" aria-label="Keluar">
						<Icon name="logout" class="w-4 h-4" />
					</button>
					<button
						class="p-2 rounded-lg hover:bg-slate-800 cursor-pointer"
						onclick={() => (mobileMenu = true)}
						aria-label="Buka menu"
					>
						<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" class="w-5 h-5">
							<line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" />
						</svg>
					</button>
				</div>
			</header>

			<main class="flex-1 p-4 lg:p-8 pb-24 lg:pb-8">
				{#if $navigating}
					<!-- Skeleton saat pindah halaman -->
					<div class="space-y-4 animate-pulse" aria-label="Memuat halaman">
						<div class="h-8 w-56 rounded-lg bg-slate-200"></div>
						<div class="h-4 w-40 rounded bg-slate-200"></div>
						<div class="grid grid-cols-2 lg:grid-cols-3 gap-4 pt-4">
							{#each Array(6) as _, i}
								<div class="h-24 rounded-xl bg-slate-200"></div>
							{/each}
						</div>
						<div class="h-64 rounded-xl bg-slate-200"></div>
					</div>
				{:else}
					{@render children()}
				{/if}
			</main>

			<!-- Bottom nav mobile -->
			<nav class="lg:hidden fixed bottom-0 inset-x-0 z-30 bg-white border-t border-slate-200 flex">
				{#each bottomNav as item}
					<a
						href={item.href}
						class="flex-1 flex flex-col items-center gap-0.5 py-2 text-[10px] font-medium
							{isActive(item.href) ? 'text-indigo-600' : 'text-slate-500'}"
					>
						<Icon name={item.icon} class="w-5 h-5" />
						{item.label.split(' ')[0]}
					</a>
				{/each}
				{#if extraNav.length > 0}
					<button
						class="flex-1 flex flex-col items-center gap-0.5 py-2 text-[10px] font-medium text-slate-500 cursor-pointer"
						onclick={() => (mobileMenu = true)}
					>
						<Icon name="plus" class="w-5 h-5" />
						Menu
					</button>
				{/if}
			</nav>
		</div>

			<!-- Drawer menu mobile -->
			{#if mobileMenu}
				<button
					type="button"
					class="lg:hidden fixed inset-0 z-40 bg-black/40 border-0 cursor-default"
					onclick={() => (mobileMenu = false)}
					aria-label="Tutup menu latar"
				></button>
				<div class="lg:hidden fixed inset-y-0 right-0 z-50 w-72 bg-white shadow-xl flex flex-col">
				<div class="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
					<span class="font-bold text-slate-900">Menu</span>
					<button class="p-1.5 text-slate-400 hover:text-slate-600 cursor-pointer" onclick={() => (mobileMenu = false)} aria-label="Tutup menu">
						<Icon name="x" class="w-5 h-5" />
					</button>
				</div>
				<nav class="flex-1 overflow-y-auto py-2">
					{#each myNav as item}
						<a
							href={item.href}
							class="flex items-center gap-3 px-5 py-3 text-sm {isActive(item.href) ? 'bg-indigo-50 text-indigo-700 font-semibold' : 'text-slate-700'}"
							onclick={() => (mobileMenu = false)}
						>
							<Icon name={item.icon} class="w-4 h-4" />
							{item.label}
						</a>
					{/each}
				</nav>
			</div>
		{/if}
	</div>
	<Toaster />
{/if}
