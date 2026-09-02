import type { PageServerLoad } from './$types';
import { requireRole } from '$lib/server/auth';
import { getClasses, getClassesForTeacher, getJournals, getSubjects, getTeacherSubjects } from '$lib/server/data';
import { monthRange, todayStr } from '$lib/date';

export const load: PageServerLoad = async (event) => {
	const user = await requireRole(event, ['admin', 'wali_kelas', 'guru_mapel']);
	const isGuru = user.role === 'guru_mapel';

	let classes;
	let teacherSubjects: Awaited<ReturnType<typeof getTeacherSubjects>> = [];
	if (isGuru && user.teacher_id) {
		classes = await getClassesForTeacher(user.teacher_id);
		teacherSubjects = await getTeacherSubjects(user.teacher_id);
	} else {
		classes = await getClasses(user);
	}

	const { from, to } = monthRange(todayStr().slice(0, 7));
	const journals = await getJournals({ from, to, user });
	const subjects = await getSubjects();

	return { user, classes, subjects, teacherSubjects, isGuruMapel: isGuru, journals, from, to };
};
