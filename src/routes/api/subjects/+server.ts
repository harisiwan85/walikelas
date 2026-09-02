import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireRole } from '$lib/server/auth';
import { createSubject, getSubjects, getSubjectsForClass, getTeacherSubjects } from '$lib/server/data';

export const GET: RequestHandler = async (event) => {
	const user = await requireRole(event, ['admin', 'kepala_sekolah', 'wali_kelas', 'guru_mapel']);
	const class_id = event.url.searchParams.get('class_id') ? Number(event.url.searchParams.get('class_id')) : undefined;

	let subjects = class_id ? await getSubjectsForClass(class_id) : await getSubjects();

	// Jika pengguna adalah guru mapel atau guru yang memiliki mapel ampuannya, hanya tampilkan mapel yang diampunya
	if (user.role === 'guru_mapel' && user.teacher_id) {
		const mine = await getTeacherSubjects(user.teacher_id);
		const mineIds = new Set(mine.map((s) => s.id));
		subjects = subjects.filter((s) => mineIds.has(s.id));
	}

	return json(subjects);
};

export const POST: RequestHandler = async (event) => {
	await requireRole(event, ['admin']);
	const body = await event.request.json().catch(() => null);
	if (!body?.nama) throw error(400, 'Nama mata pelajaran wajib diisi');
	const id = await createSubject({
		kode: String(body.kode ?? ''),
		nama: String(body.nama),
		teacher_id: body.teacher_id ? Number(body.teacher_id) : null,
		class_ids: Array.isArray(body.class_ids) ? body.class_ids.map(Number) : []
	});
	return json({ id }, { status: 201 });
};
