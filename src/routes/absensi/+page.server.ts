import type { PageServerLoad } from './$types';
import { requireRole } from '$lib/server/auth';
import { getClasses, getClassesForTeacher, getSubjectsForClass, getTeacherSubjects } from '$lib/server/data';
import { todayStr } from '$lib/date';

export const load: PageServerLoad = async (event) => {
	const user = await requireRole(event, ['admin', 'wali_kelas', 'guru_mapel']);
	const hasTeacherId = Boolean(user.teacher_id);

	let classes;
	let teacherSubjects: Awaited<ReturnType<typeof getTeacherSubjects>> = [];
	if (user.role === 'guru_mapel' && user.teacher_id) {
		classes = await getClassesForTeacher(user.teacher_id);
		teacherSubjects = await getTeacherSubjects(user.teacher_id);
	} else if (user.role === 'wali_kelas' && user.teacher_id) {
		classes = await getClasses(user);
		teacherSubjects = await getTeacherSubjects(user.teacher_id);
	} else {
		classes = await getClasses(user);
	}

	const selectedClassId = user.role === 'wali_kelas' ? (user.class_id ?? classes[0]?.id ?? null) : (classes[0]?.id ?? null);
	let classSubjects = selectedClassId ? await getSubjectsForClass(selectedClassId) : [];

	// Jika guru memiliki mapel yang diampu (baik guru mapel maupun wali kelas yang juga mengajar mapel), saring daftar mapel hanya yang diampu
	if (teacherSubjects.length > 0 && user.role !== 'admin') {
		const mineIds = new Set(teacherSubjects.map((s) => s.id));
		classSubjects = classSubjects.filter((s) => mineIds.has(s.id));
	}

	return {
		user,
		classes,
		classSubjects,
		teacherSubjects,
		isGuruMapel: user.role === 'guru_mapel',
		selectedClassId,
		today: todayStr()
	};
};
