import type { PageServerLoad } from './$types';
import { requireRole } from '$lib/server/auth';
import { getClasses, getSubjects, getTeachers } from '$lib/server/data';

export const load: PageServerLoad = async (event) => {
	await requireRole(event, ['admin']);
	return { subjects: await getSubjects(), teachers: await getTeachers(), classes: await getClasses() };
};
