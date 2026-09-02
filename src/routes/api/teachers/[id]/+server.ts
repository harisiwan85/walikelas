import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireRole } from '$lib/server/auth';
import { deleteTeacher, updateTeacher } from '$lib/server/data';

export const PUT: RequestHandler = async (event) => {
	await requireRole(event, ['admin']);
	const body = await event.request.json().catch(() => null);
	if (!body) throw error(400, 'Body tidak valid');
	await updateTeacher(Number(event.params.id), body);
	return json({ ok: true });
};

export const DELETE: RequestHandler = async (event) => {
	await requireRole(event, ['admin']);
	await deleteTeacher(Number(event.params.id));
	return json({ ok: true });
};
