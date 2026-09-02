import type { PageServerLoad } from './$types';
import { requireUser } from '$lib/server/auth';
import { getAttendanceMatrix, getClasses, getReportSummary, getSchool } from '$lib/server/data';
import { monthRange, todayStr } from '$lib/date';

export const load: PageServerLoad = async (event) => {
	const user = await requireUser(event);
	const school = await getSchool();
	const classes = await getClasses(user);
	const { from, to } = monthRange(todayStr().slice(0, 7));
	const class_id = user.role === 'wali_kelas' ? (user.class_id ?? undefined) : undefined;
	const report = await getReportSummary({ class_id, from, to, user });
	const matrix = await getAttendanceMatrix({ class_id, from, to, user });
	return { user, classes, school, rows: report.rows, matrix, from, to };
};
