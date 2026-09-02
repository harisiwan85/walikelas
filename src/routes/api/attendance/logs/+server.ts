import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireRole } from '$lib/server/auth';
import { getAttendanceLogs } from '$lib/server/data';

export const GET: RequestHandler = async (event) => {
	await requireRole(event, ['admin', 'kepala_sekolah', 'wali_kelas']);
	return json(await getAttendanceLogs(200));
};
