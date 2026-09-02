import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireUser } from '$lib/server/auth';
import { getReportSummary } from '$lib/server/data';

export const GET: RequestHandler = async (event) => {
	const user = await requireUser(event);
	const url = event.url;
	const from = url.searchParams.get('from') ?? '';
	const to = url.searchParams.get('to') ?? '';
	const class_id = url.searchParams.get('class_id') ? Number(url.searchParams.get('class_id')) : undefined;
	const result = await getReportSummary({ class_id, from, to, user });
	return json(result);
};
