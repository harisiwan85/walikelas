import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireRole } from '$lib/server/auth';
import { deleteClass, getClass, updateClass } from '$lib/server/data';

export const GET: RequestHandler = async ({ params }) => {
	const cls = await getClass(Number(params.id));
	if (!cls) throw error(404, 'Kelas tidak ditemukan');
	return json(cls);
};

export const PUT: RequestHandler = async (event) => {
	await requireRole(event, ['admin']);
	const body = await event.request.json().catch(() => null);
	if (!body) throw error(400, 'Body tidak valid');
	await updateClass(Number(event.params.id), body);
	return json(await getClass(Number(event.params.id)));
};

export const DELETE: RequestHandler = async (event) => {
	await requireRole(event, ['admin']);
	await deleteClass(Number(event.params.id));
	return json({ ok: true });
};
