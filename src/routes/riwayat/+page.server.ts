import type { PageServerLoad } from './$types';
import { requireRole } from '$lib/server/auth';
import { getAttendanceHistory, getAttendanceLogs, getClasses } from '$lib/server/data';
import { addDays, todayStr } from '$lib/date';

export const load: PageServerLoad = async (event) => {
	const user = await requireRole(event, ['admin', 'kepala_sekolah', 'wali_kelas']);
	const classes = await getClasses(user);
	const to = todayStr();
	const from = addDays(to, -30);
	const history = await getAttendanceHistory({ from, to, user });
	const logs = await getAttendanceLogs(200);
	return { user, classes, history, logs, from, to };
};
