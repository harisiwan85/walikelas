import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireRole } from '$lib/server/auth';
import { createClass, getClasses } from '$lib/server/data';

export const GET: RequestHandler = async (event) => {
	const user = await requireRole(event, ['admin', 'kepala_sekolah', 'wali_kelas', 'guru_mapel']);
	return json(await getClasses(user));
};

export const POST: RequestHandler = async (event) => {
	await requireRole(event, ['admin']);
	const body = await event.request.json().catch(() => null);
	if (!body?.nama || !body?.tingkat) throw error(400, 'Nama kelas dan tingkat wajib diisi');
	const res = await createClass({
		nama: String(body.nama),
		tingkat: Number(body.tingkat),
		tahun_ajaran: String(body.tahun_ajaran ?? '2026/2027'),
		wali_kelas_id: body.wali_kelas_id ? Number(body.wali_kelas_id) : null
	});
	return json({ id: Number(res.lastInsertRowid) }, { status: 201 });
};
