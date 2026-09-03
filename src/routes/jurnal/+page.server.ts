import type { PageServerLoad } from './$types';
import { requireRole } from '$lib/server/auth';
import { getClasses, getClassesForTeacher, getJournals, getSubjects, getTeacherSubjects } from '$lib/server/data';
import { monthRange, todayStr } from '$lib/date';

export const load: PageServerLoad = async (event) => {
	const user = await requireRole(event, ['admin', 'wali_kelas', 'guru_mapel']);
	const isGuru = user.role === 'guru_mapel';

	const { from, to } = monthRange(todayStr().slice(0, 7));

	let classesPromise = (isGuru && user.teacher_id) ? getClassesForTeacher(user.teacher_id) : getClasses(user);
	let teacherSubjectsPromise = (isGuru && user.teacher_id) ? getTeacherSubjects(user.teacher_id) : Promise.resolve([]);

	const [classes, teacherSubjects, journals, subjects] = await Promise.all([
		classesPromise,
		teacherSubjectsPromise,
		getJournals({ from, to, user }),
		getSubjects()
	]);

	return { user, classes, subjects, teacherSubjects, isGuruMapel: isGuru, journals, from, to };
};
