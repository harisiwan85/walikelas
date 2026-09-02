import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { isSupabase, getSetting } from '$lib/server/data';

/**
 * Cek status koneksi database — dipakai untuk mengukur latensi
 * (mis. membandingkan SQLite lokal vs Supabase online).
 *
 *   GET /api/health
 *   → { status: 'ok', mode: 'supabase' | 'sqlite', latencyMs, time }
 */
export const GET: RequestHandler = async () => {
	const start = performance.now();
	try {
		await getSetting('alpa_threshold');
	} catch {
		return json(
			{ status: 'error', mode: isSupabase ? 'supabase' : 'sqlite', latencyMs: null, message: 'Database tidak bisa diakses' },
			{ status: 503 }
		);
	}
	const latencyMs = Math.round(performance.now() - start);
	return json({
		status: 'ok',
		mode: isSupabase ? 'supabase' : 'sqlite',
		latencyMs,
		time: new Date().toISOString()
	});
};
