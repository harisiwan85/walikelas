import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireUser } from '$lib/server/auth';
import { getAlerts } from '$lib/server/data';

export const GET: RequestHandler = async (event) => {
	const user = await requireUser(event);
	if (user.role === 'guru_mapel') return json([]);
	return json(await getAlerts());
};
