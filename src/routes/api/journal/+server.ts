import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireRole } from '$lib/server/auth';
import { createJournal, getClassesForTeacher, getJournals } from '$lib/server/data';

export const GET: RequestHandler = async (event) => {
	const user = await requireRole(event, ['admin', 'wali_kelas', 'kepala_sekolah', 'guru_mapel']);
	const url = event.url;
	const class_id = url.searchParams.get('class_id') ? Number(url.searchParams.get('class_id')) : undefined;
	const from = url.searchParams.get('from') ?? undefined;
	const to = url.searchParams.get('to') ?? undefined;
	return json(await getJournals({ class_id, from, to, user }));
};

export const POST: RequestHandler = async (event) => {
	const user = await requireRole(event, ['admin', 'wali_kelas', 'guru_mapel']);
	const body = await event.request.json().catch(() => null);
	if (!body?.class_id) throw error(400, 'Kelas wajib diisi');
	if (!String(body.materi ?? '').trim() && !String(body.kegiatan ?? '').trim() && !String(body.catatan ?? '').trim()) {
		throw error(400, 'Isi minimal salah satu: materi, kegiatan, atau catatan');
	}
	const class_id = Number(body.class_id);
	if (user.role === 'guru_mapel' && user.teacher_id) {
		const mine = await getClassesForTeacher(user.teacher_id);
		if (!mine.some((c) => c.id === class_id)) {
			throw error(403, 'Anda hanya dapat menulis jurnal untuk kelas yang Anda ajar');
		}
	}
	const id = await createJournal({
		class_id: Number(body.class_id),
		tanggal: String(body.tanggal ?? ''),
		subject_id: body.subject_id ? Number(body.subject_id) : null,
		materi: String(body.materi ?? ''),
		kegiatan: String(body.kegiatan ?? ''),
		kendala: String(body.kendala ?? ''),
		catatan: String(body.catatan ?? ''),
		user_id: user.id
	});
	return json({ id }, { status: 201 });
};
