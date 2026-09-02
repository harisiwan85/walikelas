import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';
import { getCurrentUser } from '$lib/server/auth';
import { seedIfEmpty } from '$lib/server/seed';
import { isSupabase } from '$lib/server/data';

export const load: LayoutServerLoad = async (event) => {
	await seedIfEmpty();
	const start = performance.now();
	const user = await getCurrentUser(event);
	const latencyMs = Math.round(performance.now() - start);
	if (
		!user &&
		!event.url.pathname.startsWith('/login') &&
		!event.url.pathname.startsWith('/laporan/publik')
	) {
		throw redirect(302, '/login');
	}
	return { user, dbMode: isSupabase ? 'supabase' : 'sqlite', latencyMs };
};
