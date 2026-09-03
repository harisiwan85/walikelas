import type { PageServerLoad } from './$types';
import { requireRole } from '$lib/server/auth';
import { getClasses, getStudents } from '$lib/server/data';

export const load: PageServerLoad = async (event) => {
	const user = await requireRole(event, ['admin', 'kepala_sekolah', 'wali_kelas']);
	const [students, classes] = await Promise.all([getStudents({ user }), getClasses(user)]);
	return { user, students, classes };
};
