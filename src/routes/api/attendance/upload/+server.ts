import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { randomBytes } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { requireUser } from '$lib/server/auth';
import { canWriteAttendance } from '$lib/server/rbac';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadDir = path.join(__dirname, '../../../../../data/uploads');

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

	mkdirSync(uploadDir, { recursive: true });
	const ext = file.type === 'application/pdf' ? 'pdf' : file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
	const name = `${Date.now()}-${randomBytes(4).toString('hex')}.${ext}`;
	writeFileSync(path.join(uploadDir, name), Buffer.from(await file.arrayBuffer()));

	return json({ url: `/uploads/${name}` }, { status: 201 });
};
