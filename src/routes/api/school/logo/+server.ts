import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireRole } from '$lib/server/auth';
import { getSchool, updateSchool } from '$lib/server/data';
import { saveUploadedFile } from '$lib/server/upload';

const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp']);

export const POST: RequestHandler = async (event) => {
	await requireRole(event, ['admin']);

	const form = await event.request.formData().catch(() => null);
	if (!form) throw error(400, 'Form tidak valid');
	const file = form.get('file');
	if (!(file instanceof File)) throw error(400, 'File wajib diunggah');
	if (!ALLOWED.has(file.type)) throw error(400, 'Format logo harus JPG, PNG, atau WEBP');
	if (file.size > 2 * 1024 * 1024) throw error(400, 'Ukuran logo maksimal 2 MB');

	try {
		const url = await saveUploadedFile(file, 'logo');
		const school = await getSchool();
		await updateSchool({ ...school, logo_url: url });
		return json({ url }, { status: 201 });
	} catch (e: any) {
		console.error('[Upload Logo Error]:', e);
		throw error(500, e.message || 'Gagal menyimpan logo sekolah');
	}
};
