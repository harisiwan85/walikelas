import type { PageServerLoad } from './$types';
import { requireUser } from '$lib/server/auth';
import { getDashboard } from '$lib/server/data';
import { formatDateId } from '$lib/date';

export const load: PageServerLoad = async (event) => {
	const user = await requireUser(event);
	const summary = await getDashboard(user);
	return { summary, user, tanggalLabel: formatDateId(summary.tanggal) };
};
