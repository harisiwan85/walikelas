import type { PageServerLoad } from './$types';
import { requireRole } from '$lib/server/auth';
import { getHolidays } from '$lib/server/data';

export const load: PageServerLoad = async (event) => {
	await requireRole(event, ['admin']);
	return { holidays: await getHolidays(300) };
};
