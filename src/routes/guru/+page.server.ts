import type { PageServerLoad } from './$types';
import { requireRole } from '$lib/server/auth';
import { getTeachers } from '$lib/server/data';

export const load: PageServerLoad = async (event) => {
	await requireRole(event, ['admin']);
	return { teachers: await getTeachers() };
};
