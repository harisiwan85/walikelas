import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireRole } from '$lib/server/auth';
import { deleteSubject, updateSubject } from '$lib/server/data';

export const PUT: RequestHandler = async (event) => {
	await requireRole(event, ['admin']);
	const body = await event.request.json().catch(() => null);
	if (!body) throw error(400, 'Body tidak valid');
	await updateSubject(Number(event.params.id), {
		kode: body.kode,
		nama: body.nama,
		teacher_id: body.teacher_id !== undefined ? body.teacher_id : null,
		classes: body.class_ids ? body.class_ids.map((id: number) => ({ id: Number(id), nama: '' })) : undefined
	});
	return json({ ok: true });
};

export const DELETE: RequestHandler = async (event) => {
	await requireRole(event, ['admin']);
	await deleteSubject(Number(event.params.id));
	return json({ ok: true });
};
