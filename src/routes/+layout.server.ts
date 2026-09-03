import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';
import { getCurrentUser } from '$lib/server/auth';
import { seedIfEmpty } from '$lib/server/seed';
import { isSupabase, isMysql } from '$lib/server/data';

export const load: LayoutServerLoad = async (event) => {
	try {
		await seedIfEmpty();
	} catch (e) {
		console.error('[seed error]', e);
	}
	const start = performance.now();
	let user = null;
	try {
		user = await getCurrentUser(event);
	} catch (e) {
		console.error('[auth error]', e);
	}
	const latencyMs = Math.round(performance.now() - start);
	if (
		!user &&
		!event.url.pathname.startsWith('/login') &&
		!event.url.pathname.startsWith('/laporan/publik')
	) {
		throw redirect(302, '/login');
	}
	const dbMode = isMysql ? 'mysql' : isSupabase ? 'supabase' : 'sqlite';
	return { user, dbMode, latencyMs };
};

