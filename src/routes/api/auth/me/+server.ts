import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getCurrentUser } from '$lib/server/auth';

export const GET: RequestHandler = async (event) => {
	return json({ user: await getCurrentUser(event) });
};
