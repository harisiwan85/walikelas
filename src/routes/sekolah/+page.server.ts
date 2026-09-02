import type { PageServerLoad } from './$types';
import { requireRole } from '$lib/server/auth';
import { getSchool } from '$lib/server/data';

export const load: PageServerLoad = async (event) => {
	await requireRole(event, ['admin']);
	return { school: await getSchool() };
};
