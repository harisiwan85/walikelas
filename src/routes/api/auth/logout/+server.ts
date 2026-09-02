import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { clearSessionCookie, deleteSession, getSessionCookie } from '$lib/server/auth';

export const POST: RequestHandler = async (event) => {
	const token = getSessionCookie(event) ?? event.request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
	if (token) await deleteSession(token);
	clearSessionCookie(event);
	return json({ ok: true });
};
