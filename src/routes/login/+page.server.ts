import type { PageServerLoad } from './$types';
import { getSchool } from '$lib/server/data';

export const load: PageServerLoad = async () => {
	try {
		const school = await getSchool();
		return { school };
	} catch (e) {
		return { school: null };
	}
};
