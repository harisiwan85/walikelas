import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { changePassword, requireUser } from '$lib/server/auth';

export const POST: RequestHandler = async (event) => {
	const user = await requireUser(event);
	const body = await event.request.json().catch(() => null);
	const oldPassword = String(body?.old_password ?? '');
	const newPassword = String(body?.new_password ?? '');
	if (!oldPassword || !newPassword) throw error(400, 'Password lama dan baru wajib diisi');
	if (newPassword.length < 6) throw error(400, 'Password baru minimal 6 karakter');
	await changePassword(user, oldPassword, newPassword);
	return json({ ok: true });
};
