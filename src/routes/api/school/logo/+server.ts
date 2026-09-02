import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { randomBytes } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { requireRole } from '$lib/server/auth';
import { getSchool, updateSchool } from '$lib/server/data';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadDir = path.join(__dirname, '../../../../../data/uploads');

const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp']);

export const POST: RequestHandler = async (event) => {
	await requireRole(event, ['admin']);

	const form = await event.request.formData().catch(() => null);
	if (!form) throw error(400, 'Form tidak valid');
	const file = form.get('file');
	if (!(file instanceof File)) throw error(400, 'File wajib diunggah');
	if (!ALLOWED.has(file.type)) throw error(400, 'Format logo harus JPG, PNG, atau WEBP');
	if (file.size > 2 * 1024 * 1024) throw error(400, 'Ukuran logo maksimal 2 MB');

	mkdirSync(uploadDir, { recursive: true });
	const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
	const name = `logo-${Date.now()}-${randomBytes(4).toString('hex')}.${ext}`;
	writeFileSync(path.join(uploadDir, name), Buffer.from(await file.arrayBuffer()));
	const url = `/uploads/${name}`;

	const school = await getSchool();
	await updateSchool({ ...school, logo_url: url });
	return json({ url }, { status: 201 });
};
