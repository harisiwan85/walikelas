import type { PageServerLoad } from './$types';
import { requireUser } from '$lib/server/auth';

export const load: PageServerLoad = async (event) => {
	const user = await requireUser(event);
	return { user };
};
