import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { hashPassword, requireRole } from '$lib/server/auth';
import { isSupabase } from '$lib/server/data';
import { authGetAuthId, authUpdatePasswordHash, findUserByTeacherId } from '$lib/server/data';

export const POST: RequestHandler = async (event) => {
	await requireRole(event, ['admin']);
	const teacher_id = Number(event.params.id);
	const body = await event.request.json().catch(() => null);
	const password = String(body?.password ?? '');
	if (password.length < 6) throw error(400, 'Password minimal 6 karakter');

	try {
		const account = await findUserByTeacherId(teacher_id);
		if (!account) throw error(404, 'Akun guru belum dibuat. Buat akun terlebih dahulu.');

		if (isSupabase) {
			const authId = await authGetAuthId(account.id);
			if (!authId) throw error(400, 'Akun belum terhubung ke Supabase Auth');
			const { getSupabase } = await import('$lib/server/data/supabase');
			const { error: err } = await getSupabase().auth.admin.updateUserById(authId, { password });
			if (err) throw new Error('Gagal reset password: ' + err.message);
		} else {
			await authUpdatePasswordHash(account.id, hashPassword(password));
		}
		return json({ ok: true });
	} catch (e: any) {
		if (e?.status) throw e;
		console.error('Gagal reset password guru:', e);
		throw error(500, e?.message || 'Gagal reset password guru');
	}
};
