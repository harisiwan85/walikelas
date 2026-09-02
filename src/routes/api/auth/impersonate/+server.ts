import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createSession, requireRole, setSessionCookie } from '$lib/server/auth';
import { getTeachers } from '$lib/server/data';
import { getOrCreateTeacherAccount } from '$lib/server/accounts';

export const POST: RequestHandler = async (event) => {
	await requireRole(event, ['admin']);
	const body = await event.request.json().catch(() => null);
	const teacher_id = Number(body?.teacher_id ?? 0);
	if (!teacher_id) throw error(400, 'Pilih guru terlebih dahulu');

	const teachers = await getTeachers();
	const teacher = teachers.find((t) => t.id === teacher_id);
	if (!teacher) throw error(404, 'Guru tidak ditemukan');

	const user = await getOrCreateTeacherAccount(teacher);
	const token = await createSession(user.id);
	setSessionCookie(event, token);

	return json({ ok: true, user });
};
