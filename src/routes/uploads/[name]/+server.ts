import { error } from '@sveltejs/kit';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { RequestHandler } from './$types';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadDir = path.join(__dirname, '../../../../data/uploads');

const MIME: Record<string, string> = {
	'.jpg': 'image/jpeg',
	'.png': 'image/png',
	'.webp': 'image/webp',
	'.pdf': 'application/pdf'
};

export const GET: RequestHandler = async ({ params }) => {
	const name = params.name;
	if (!/^[\w.-]+$/.test(name)) throw error(400, 'Nama file tidak valid');
	const ext = path.extname(name).toLowerCase();
	const mime = MIME[ext];
	if (!mime) throw error(404, 'File tidak ditemukan');
	try {
		const buf = readFileSync(path.join(uploadDir, name));
		return new Response(buf as unknown as BodyInit, {
			headers: {
				'Content-Type': mime,
				'Cache-Control': 'public, max-age=31536000'
			}
		});
	} catch {
		throw error(404, 'File tidak ditemukan');
	}
};
