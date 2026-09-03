import type { PageServerLoad } from './$types';
import { requireRole } from '$lib/server/auth';
import { getAttendanceHistory, getAttendanceLogs, getClasses } from '$lib/server/data';
import { addDays, todayStr } from '$lib/date';

export const load: PageServerLoad = async (event) => {
	const user = await requireRole(event, ['admin', 'kepala_sekolah', 'wali_kelas']);
	const to = todayStr();
	const from = addDays(to, -30);
	const [classes, history, logs] = await Promise.all([
		getClasses(user),
		getAttendanceHistory({ from, to, user }),
		getAttendanceLogs(200)
	]);
	return { user, classes, history, logs, from, to };
};
