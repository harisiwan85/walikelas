import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import type { StudentStatus } from '$lib/types';
import { requireRole, requireUser } from '$lib/server/auth';
import { assertCanManageStudents } from '$lib/server/rbac';
import { createStudent, getStudents } from '$lib/server/data';

export const GET: RequestHandler = async (event) => {
	const user = await requireRole(event, ['admin', 'kepala_sekolah', 'wali_kelas', 'guru_mapel']);
	const url = event.url;
	const class_id = url.searchParams.get('class_id') ? Number(url.searchParams.get('class_id')) : undefined;
	const q = url.searchParams.get('q') ?? undefined;
	const statusParam = url.searchParams.get('status');
	const status = statusParam && ['aktif', 'pindah', 'lulus', 'keluar'].includes(statusParam) ? (statusParam as StudentStatus) : undefined;
	return json(await getStudents({ class_id, q, status, user }));
};

export const POST: RequestHandler = async (event) => {
	const user = await requireUser(event);
	const body = await event.request.json().catch(() => null);
	if (!body?.nama || !body?.class_id) throw error(400, 'Nama siswa dan kelas wajib diisi');
	assertCanManageStudents(user, Number(body.class_id));
	const res = await createStudent(body);
	return json({ id: Number(res.lastInsertRowid) }, { status: 201 });
};
