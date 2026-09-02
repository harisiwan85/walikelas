import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireRole } from '$lib/server/auth';
import { deleteHoliday } from '$lib/server/data';

export const DELETE: RequestHandler = async (event) => {
	await requireRole(event, ['admin']);
	await deleteHoliday(Number(event.params.id));
	return json({ ok: true });
};
