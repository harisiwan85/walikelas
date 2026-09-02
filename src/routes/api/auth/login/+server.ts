import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { login, createSession, setSessionCookie } from '$lib/server/auth';

export const POST: RequestHandler = async (event) => {
	const body = await event.request.json().catch(() => null);
	const identifier = String(body?.username ?? body?.email ?? '').trim();
	const password = String(body?.password ?? '');
	if (!identifier || !password) throw error(400, 'Username/email dan password wajib diisi');

	const user = await login(identifier, password);
	const token = await createSession(user.id);
	setSessionCookie(event, token);

	return json({ token, user });
};
