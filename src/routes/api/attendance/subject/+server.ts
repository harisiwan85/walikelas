import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireRole } from '$lib/server/auth';
import { canWriteSubjectAttendance } from '$lib/server/rbac';
import {
	getAttendanceSubjectByDate,
	getClass,
	getStudents,
	getTeacherSubjects,
	isHoliday,
	upsertSubjectAttendance
} from '$lib/server/data';
import { todayStr } from '$lib/date';

export const GET: RequestHandler = async (event) => {
	const user = await requireRole(event, ['admin', 'kepala_sekolah', 'wali_kelas', 'guru_mapel']);
	const url = event.url;
	const tanggal = url.searchParams.get('tanggal') ?? todayStr();
	const class_id = Number(url.searchParams.get('class_id') ?? '0');
	const subject_id = Number(url.searchParams.get('subject_id') ?? '0');
	const jam_ke = Number(url.searchParams.get('jam_ke') ?? '1');

	if (user.role === 'wali_kelas' && user.class_id !== class_id) {
		throw error(403, 'Anda hanya dapat mengakses kelas yang Anda ampu');
	}
	if (user.role === 'guru_mapel' && user.teacher_id) {
		const mine = await getTeacherSubjects(user.teacher_id);
		if (!mine.some((s) => s.id === subject_id)) {
			throw error(403, 'Anda hanya dapat mencatat mapel yang Anda ampu');
		}
	}
	const cls = await getClass(class_id);
	if (!cls) throw error(404, 'Kelas tidak ditemukan');
	const holiday = await isHoliday(tanggal);

	const students = await getStudents({ class_id, status: 'aktif' });
	const map = await getAttendanceSubjectByDate(tanggal, class_id, subject_id, jam_ke);

	const records = students.map((s) => {
		const rec = map.get(s.id);
		return {
			student_id: s.id,
			nisn: s.nisn,
			nama: s.nama,
			status: rec?.status ?? 'hadir',
			keterangan: rec?.keterangan ?? ''
		};
	});

	return json({ tanggal, class_id, class_name: cls.nama, subject_id, jam_ke, libur: holiday.libur, records });
};

export const POST: RequestHandler = async (event) => {
	const user = await requireRole(event, ['admin', 'wali_kelas', 'guru_mapel']);
	if (!canWriteSubjectAttendance(user)) throw error(403, 'Role Anda tidak dapat menginput absensi');
	const body = await event.request.json().catch(() => null);
	if (!body?.tanggal || !body?.class_id || !body?.subject_id || !Array.isArray(body.entries)) {
		throw error(400, 'Parameter tanggal, class_id, subject_id, dan entries wajib diisi');
	}
	const tanggal = String(body.tanggal);
	const class_id = Number(body.class_id);
	const subject_id = Number(body.subject_id);
	const jam_ke = Number(body.jam_ke ?? 1);

	if (user.role === 'wali_kelas' && user.class_id !== class_id) {
		throw error(403, 'Anda hanya dapat menginput absensi kelas yang Anda ampu');
	}
	if (user.role === 'guru_mapel' && user.teacher_id) {
		const mine = await getTeacherSubjects(user.teacher_id);
		if (!mine.some((s) => s.id === subject_id)) {
			throw error(403, 'Anda hanya dapat mencatat mapel yang Anda ampu');
		}
	}
	const holiday = await isHoliday(tanggal);
	if (holiday.libur) throw error(400, 'Tanggal tersebut adalah hari libur, absensi tidak dapat diinput');

	const count = await upsertSubjectAttendance(tanggal, class_id, subject_id, jam_ke, body.entries, user);
	return json({ ok: true, dicatat: count });
};
