import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireRole } from '$lib/server/auth';
import { deleteJournal, updateJournal } from '$lib/server/data';

export const PUT: RequestHandler = async (event) => {
	const user = await requireRole(event, ['admin', 'wali_kelas']);
	const body = await event.request.json().catch(() => null);
	if (!body) throw error(400, 'Body tidak valid');
	await updateJournal(
		Number(event.params.id),
		{
			class_id: body.class_id ? Number(body.class_id) : undefined,
			tanggal: body.tanggal ? String(body.tanggal) : undefined,
			subject_id: body.subject_id !== undefined ? (body.subject_id ? Number(body.subject_id) : null) : undefined,
			materi: body.materi !== undefined ? String(body.materi) : undefined,
			kegiatan: body.kegiatan !== undefined ? String(body.kegiatan) : undefined,
			kendala: body.kendala !== undefined ? String(body.kendala) : undefined,
			catatan: body.catatan !== undefined ? String(body.catatan) : undefined
		},
		user.id
	);
	return json({ ok: true });
};

export const DELETE: RequestHandler = async (event) => {
	await requireRole(event, ['admin', 'wali_kelas']);
	await deleteJournal(Number(event.params.id));
	return json({ ok: true });
};
