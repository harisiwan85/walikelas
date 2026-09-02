import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireUser } from '$lib/server/auth';
import { getSubjectAttendanceMatrix } from '$lib/server/data';

export const GET: RequestHandler = async (event) => {
	const user = await requireUser(event);
	const url = event.url;
	const from = url.searchParams.get('from') ?? '';
	const to = url.searchParams.get('to') ?? '';
	const class_id = url.searchParams.get('class_id') ? Number(url.searchParams.get('class_id')) : undefined;
	// subject_id opsional: tanpa subject berarti agregasi semua mapel (kolom = jam ke-1 s/d 8)
	const subject_id = url.searchParams.get('subject_id') ? Number(url.searchParams.get('subject_id')) : undefined;
	return json(await getSubjectAttendanceMatrix({ class_id, subject_id, from, to, user }));
};
