import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireRole } from '$lib/server/auth';
import { deleteSubject, updateSubject } from '$lib/server/data';

export const PUT: RequestHandler = async (event) => {
	await requireRole(event, ['admin']);
	const body = await event.request.json().catch(() => null);
	if (!body) throw error(400, 'Body tidak valid');
	const teacherIds = Array.isArray(body.teacher_ids)
		? body.teacher_ids.map(Number)
		: body.teacher_id !== undefined
		? (body.teacher_id ? [Number(body.teacher_id)] : [])
		: undefined;
	await updateSubject(Number(event.params.id), {
		kode: body.kode,
		nama: body.nama,
		teacher_id: teacherIds ? (teacherIds[0] ?? null) : undefined,
		teacher_ids: teacherIds,
		class_ids: body.class_ids ? body.class_ids.map(Number) : undefined,
		classes: body.class_ids ? body.class_ids.map((id: number) => ({ id: Number(id), nama: '' })) : undefined
	});
	return json({ ok: true });
};

export const DELETE: RequestHandler = async (event) => {
	await requireRole(event, ['admin']);
	await deleteSubject(Number(event.params.id));
	return json({ ok: true });
};
