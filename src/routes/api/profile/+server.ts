import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireUser, updateProfile } from '$lib/server/auth';

export const GET: RequestHandler = async (event) => {
	const user = await requireUser(event);
	return json({
		user: {
			id: user.id,
			username: user.username,
			name: user.name,
			email: user.email,
			role: user.role,
			teacher_id: user.teacher_id,
			class_id: user.class_id,
			foto_url: user.foto_url,
			class_name: user.class_name
		}
	});
};

export const PUT: RequestHandler = async (event) => {
	const user = await requireUser(event);
	const body = await event.request.json().catch(() => null);
	const name = String(body?.name ?? '').trim();
	if (!name) throw error(400, 'Nama tidak boleh kosong');
	await updateProfile(user.id, name, user.foto_url);
	return json({ ok: true, user: { ...user, name } });
};
