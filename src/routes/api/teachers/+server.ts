import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireRole } from '$lib/server/auth';
import { createTeacher, getTeachers } from '$lib/server/data';

export const GET: RequestHandler = async (event) => {
	await requireRole(event, ['admin', 'kepala_sekolah', 'wali_kelas', 'guru_mapel']);
	return json(await getTeachers());
};

export const POST: RequestHandler = async (event) => {
	await requireRole(event, ['admin']);
	const body = await event.request.json().catch(() => null);
	if (!body?.nama) throw error(400, 'Nama guru wajib diisi');
	const res = await createTeacher(body);
	return json({ id: Number(res.lastInsertRowid) }, { status: 201 });
};
