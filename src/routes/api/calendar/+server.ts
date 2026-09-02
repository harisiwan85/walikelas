import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireRole } from '$lib/server/auth';
import { getHolidays, upsertHoliday } from '$lib/server/data';

export const GET: RequestHandler = async (event) => {
	await requireRole(event, ['admin', 'kepala_sekolah', 'wali_kelas', 'guru_mapel']);
	return json(await getHolidays(200));
};

export const POST: RequestHandler = async (event) => {
	await requireRole(event, ['admin']);
	const body = await event.request.json().catch(() => null);
	if (!body?.tanggal) throw error(400, 'Tanggal wajib diisi');
	await upsertHoliday({
		tanggal: String(body.tanggal),
		keterangan: String(body.keterangan ?? ''),
		tipe: body.tipe === 'aktif' ? 'aktif' : 'libur'
	});
	return json({ ok: true }, { status: 201 });
};
