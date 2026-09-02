import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireUser } from '$lib/server/auth';
import { canWriteAttendance } from '$lib/server/rbac';
import { saveUploadedFile } from '$lib/server/upload';

const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp', 'application/pdf']);

export const POST: RequestHandler = async (event) => {
	const user = await requireUser(event);
	if (!canWriteAttendance(user)) throw error(403, 'Role Anda tidak dapat mengunggah bukti');

	const form = await event.request.formData().catch(() => null);
	if (!form) throw error(400, 'Form tidak valid');
	const file = form.get('file');
	if (!(file instanceof File)) throw error(400, 'File wajib diunggah');
	if (!ALLOWED.has(file.type)) throw error(400, 'Format file harus JPG, PNG, WEBP, atau PDF');
	if (file.size > 2 * 1024 * 1024) throw error(400, 'Ukuran file maksimal 2 MB');

	try {
		const url = await saveUploadedFile(file, `bukti-${user.id}`);
		return json({ url }, { status: 201 });
	} catch (e: any) {
		console.error('[Upload Attendance Bukti Error]:', e);
		throw error(500, e.message || 'Gagal menyimpan bukti surat');
	}
};
