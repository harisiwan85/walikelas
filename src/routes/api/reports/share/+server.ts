import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireUser } from '$lib/server/auth';
import { getClass } from '$lib/server/data';
import { createShareToken, SHARE_TTL_DAYS } from '$lib/server/share';

export const POST: RequestHandler = async (event) => {
	await requireUser(event);
	const body = await event.request.json().catch(() => null);
	if (!body || typeof body.from !== 'string' || typeof body.to !== 'string') {
		return json({ message: 'Parameter periode (from/to) tidak lengkap' }, { status: 400 });
	}
	const classId = body.class_id ? Number(body.class_id) : undefined;
	const cls = classId ? await getClass(classId) : null;
	const expiresAt = new Date(Date.now() + SHARE_TTL_DAYS * 24 * 3600 * 1000).toISOString();
	const token = createShareToken({
		from: body.from,
		to: body.to,
		class_id: classId,
		class_name: cls?.nama ?? undefined,
		wali_kelas: cls?.wali_kelas_nama ?? undefined,
		student_ids:
			Array.isArray(body.student_ids) && body.student_ids.length ? body.student_ids.map(Number) : undefined,
		expires_at: expiresAt
	});
	return json({ url: `${event.url.origin}/laporan/publik/${token}`, expires_at: expiresAt });
};
