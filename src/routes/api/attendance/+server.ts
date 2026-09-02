import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireRole, requireUser } from '$lib/server/auth';
import { canWriteAttendance } from '$lib/server/rbac';
import { getAttendanceByDate, getClass, getStudents, isHoliday, upsertAttendance } from '$lib/server/data';
import { todayStr } from '$lib/date';

export const GET: RequestHandler = async (event) => {
	const user = await requireRole(event, ['admin', 'kepala_sekolah', 'wali_kelas', 'guru_mapel']);
	const url = event.url;
	const tanggal = url.searchParams.get('tanggal') ?? todayStr();
	const class_id = Number(url.searchParams.get('class_id') ?? '0');

	if (user.role === 'wali_kelas' && user.class_id !== class_id) {
		throw error(403, 'Anda hanya dapat mengakses kelas yang Anda ampu');
	}
	const cls = await getClass(class_id);
	if (!cls) throw error(404, 'Kelas tidak ditemukan');

	const students = await getStudents({ class_id, status: 'aktif' });
	const map = await getAttendanceByDate(tanggal, [class_id]);
	const holiday = await isHoliday(tanggal);

	const records = students.map((s) => {
		const rec = map.get(s.id);
		return {
			student_id: s.id,
			nisn: s.nisn,
			nama: s.nama,
			status: rec?.status ?? 'hadir',
			keterangan: rec?.keterangan ?? '',
			bukti_url: rec?.bukti_url ?? ''
		};
	});

	return json({ tanggal, class_id, class_name: cls.nama, libur: holiday.libur, records });
};

export const POST: RequestHandler = async (event) => {
	const user = await requireUser(event);
	if (!canWriteAttendance(user)) throw error(403, 'Role Anda tidak dapat menginput absensi');
	const body = await event.request.json().catch(() => null);
	if (!body?.tanggal || !body?.class_id || !Array.isArray(body.entries)) {
		throw error(400, 'Parameter tanggal, class_id, dan entries wajib diisi');
	}
	const tanggal = String(body.tanggal);
	const class_id = Number(body.class_id);
	if (user.role === 'wali_kelas' && user.class_id !== class_id) {
		throw error(403, 'Anda hanya dapat menginput absensi kelas yang Anda ampu');
	}
	const holiday = await isHoliday(tanggal);
	if (holiday.libur) throw error(400, 'Tanggal tersebut adalah hari libur, absensi tidak dapat diinput');

	const count = await upsertAttendance(tanggal, class_id, body.entries, user);
	return json({ ok: true, dicatat: count });
};
