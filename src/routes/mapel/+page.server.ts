import type { PageServerLoad } from './$types';
import { requireRole } from '$lib/server/auth';
import { getClasses, getSubjects, getTeachers } from '$lib/server/data';

export const load: PageServerLoad = async (event) => {
	await requireRole(event, ['admin']);
	const [subjects, teachers, classes] = await Promise.all([getSubjects(), getTeachers(), getClasses()]);
	return { subjects, teachers, classes };
};
