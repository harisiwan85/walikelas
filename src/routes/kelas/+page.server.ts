import type { PageServerLoad } from './$types';
import { requireRole } from '$lib/server/auth';
import { getAcademicPeriods, getClasses, getSchool, getTeachers } from '$lib/server/data';

export const load: PageServerLoad = async (event) => {
	await requireRole(event, ['admin']);
	const [classes, teachers, school, periods] = await Promise.all([
		getClasses(),
		getTeachers(),
		getSchool(),
		getAcademicPeriods()
	]);
	return { classes, teachers, school, periods };
};
