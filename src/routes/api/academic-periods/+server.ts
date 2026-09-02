import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireRole } from '$lib/server/auth';
import { addAcademicPeriod, getAcademicPeriods, setActivePeriod } from '$lib/server/data';

export const GET: RequestHandler = async (event) => {
	await requireRole(event, ['admin']);
	return json(await getAcademicPeriods());
};

export const POST: RequestHandler = async (event) => {
	await requireRole(event, ['admin']);
	const body = await event.request.json().catch(() => null);
	const tahun_ajaran = String(body?.tahun_ajaran ?? '').trim();
	const semester = String(body?.semester ?? '').trim();
	if (!/^\d{4}\/\d{4}$/.test(tahun_ajaran)) throw error(400, 'Format tahun ajaran harus YYYY/YYYY');
	if (!['Ganjil', 'Genap'].includes(semester)) throw error(400, 'Semester harus Ganjil atau Genap');
	await addAcademicPeriod(tahun_ajaran, semester);
	return json(await getAcademicPeriods(), { status: 201 });
};

export const PUT: RequestHandler = async (event) => {
	await requireRole(event, ['admin']);
	const body = await event.request.json().catch(() => null);
	const tahun_ajaran = String(body?.tahun_ajaran ?? '').trim();
	const semester = String(body?.semester ?? '').trim();
	if (!tahun_ajaran || !semester) throw error(400, 'Tahun ajaran dan semester wajib diisi');
	await setActivePeriod(tahun_ajaran, semester);
	return json(await getAcademicPeriods());
};
