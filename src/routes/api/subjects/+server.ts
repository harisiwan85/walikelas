import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireRole } from '$lib/server/auth';
import { createSubject, getSubjects, getSubjectsForClass } from '$lib/server/data';

export const GET: RequestHandler = async (event) => {
	await requireRole(event, ['admin', 'kepala_sekolah', 'wali_kelas', 'guru_mapel']);
	const class_id = event.url.searchParams.get('class_id') ? Number(event.url.searchParams.get('class_id')) : undefined;
	if (class_id) return json(await getSubjectsForClass(class_id));
	return json(await getSubjects());
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
