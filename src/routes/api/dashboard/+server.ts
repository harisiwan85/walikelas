import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireUser } from '$lib/server/auth';
import { getDashboard } from '$lib/server/data';

export const GET: RequestHandler = async (event) => {
	const user = await requireUser(event);
	return json(await getDashboard(user));
};
