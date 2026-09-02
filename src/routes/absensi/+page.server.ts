import type { PageServerLoad } from './$types';
import { requireRole } from '$lib/server/auth';
import { getClasses, getClassesForTeacher, getSubjectsForClass, getTeacherSubjects } from '$lib/server/data';
import { todayStr } from '$lib/date';

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

	const selectedClassId = user.role === 'wali_kelas' ? (user.class_id ?? classes[0]?.id ?? null) : (classes[0]?.id ?? null);
	const classSubjects = selectedClassId ? await getSubjectsForClass(selectedClassId) : [];

	return {
		user,
		classes,
		classSubjects,
		teacherSubjects,
		isGuruMapel: isGuru,
		selectedClassId,
		today: todayStr()
	};
};
