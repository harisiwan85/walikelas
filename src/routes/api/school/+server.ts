import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireRole } from '$lib/server/auth';
import { getSchool, updateSchool } from '$lib/server/data';

export const GET: RequestHandler = async (event) => {
	await requireRole(event, ['admin', 'kepala_sekolah', 'wali_kelas', 'guru_mapel']);
	return json(await getSchool());
};

export const PUT: RequestHandler = async (event) => {
	await requireRole(event, ['admin']);
	const body = await event.request.json().catch(() => null);
	if (!body) throw error(400, 'Body tidak valid');
	await updateSchool(body);
	return json(await getSchool());
};
