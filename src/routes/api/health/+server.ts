import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { isSupabase, isMysql, getSetting } from '$lib/server/data';

/**
 * Cek status koneksi database — dipakai untuk mengukur latensi
 * (mis. membandingkan SQLite lokal vs Supabase vs Remote MySQL).
 *
 *   GET /api/health
 *   → { status: 'ok', mode: 'mysql' | 'supabase' | 'sqlite', latencyMs, time }
 */
export const GET: RequestHandler = async () => {
	const start = performance.now();
	const mode = isMysql ? 'mysql' : isSupabase ? 'supabase' : 'sqlite';
	try {
		await getSetting('alpa_threshold');
	} catch {
		return json(
			{ status: 'error', mode, latencyMs: null, message: 'Database tidak bisa diakses' },
			{ status: 503 }
		);
	}
	const latencyMs = Math.round(performance.now() - start);
	return json({
		status: 'ok',
		mode,
		latencyMs,
		time: new Date().toISOString()
	});
};

