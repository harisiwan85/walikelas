import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireUser } from '$lib/server/auth';
import { getAttendanceHistory } from '$lib/server/data';

export const GET: RequestHandler = async (event) => {
	const user = await requireUser(event);
	const url = event.url;
	const rows = await getAttendanceHistory({
		student_id: url.searchParams.get('student_id') ? Number(url.searchParams.get('student_id')) : undefined,
		class_id: url.searchParams.get('class_id') ? Number(url.searchParams.get('class_id')) : undefined,
		from: url.searchParams.get('from') ?? undefined,
		to: url.searchParams.get('to') ?? undefined,
		user
	});
	return json(rows);
};
