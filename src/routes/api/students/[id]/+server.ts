import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireUser } from '$lib/server/auth';
import { assertCanManageStudents } from '$lib/server/rbac';
import { deleteStudent, getStudent, updateStudent } from '$lib/server/data';

export const GET: RequestHandler = async ({ params }) => {
	const student = await getStudent(Number(params.id));
	if (!student) throw error(404, 'Siswa tidak ditemukan');
	return json(student);
};

export const PUT: RequestHandler = async (event) => {
	const user = await requireUser(event);
	const body = await event.request.json().catch(() => null);
	if (!body) throw error(400, 'Body tidak valid');
	const cur = await getStudent(Number(event.params.id));
	if (!cur) throw error(404, 'Siswa tidak ditemukan');
	assertCanManageStudents(user, body.class_id ?? cur.class_id);
	await updateStudent(Number(event.params.id), body);
	return json(await getStudent(Number(event.params.id)));
};

export const DELETE: RequestHandler = async (event) => {
	const user = await requireUser(event);
	const cur = await getStudent(Number(event.params.id));
	if (!cur) throw error(404, 'Siswa tidak ditemukan');
	assertCanManageStudents(user, cur.class_id);
	await deleteStudent(Number(event.params.id));
	return json({ ok: true });
};
