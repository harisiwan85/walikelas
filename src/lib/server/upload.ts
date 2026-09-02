import { isSupabase } from '$lib/server/data';
import { getSupabase } from '$lib/server/data/supabase';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const localUploadDir = path.join(__dirname, '../../../../data/uploads');

const BUCKET_NAME = 'uploads';

/**
 * Upload file ke Supabase Storage (jika mode Supabase) atau filesystem lokal (jika SQLite).
 * Mengembalikan URL publik file yang dapat diakses browser.
 */
export async function saveUploadedFile(file: File, prefix: string): Promise<string> {
	const ext = file.type === 'application/pdf'
		? 'pdf'
		: file.type === 'image/png'
		? 'png'
		: file.type === 'image/webp'
		? 'webp'
		: 'jpg';

	const fileName = `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
	const buffer = Buffer.from(await file.arrayBuffer());

	if (isSupabase) {
		const client = getSupabase();
		// Pastikan bucket ada (jika belum dibuat di Supabase Storage)
		try {
			await client.storage.createBucket(BUCKET_NAME, { public: true });
		} catch (_) {}

		const { error } = await client.storage
			.from(BUCKET_NAME)
			.upload(fileName, buffer, {
				contentType: file.type,
				upsert: true
			});

		if (error) {
			console.error('[Supabase Storage Upload Error]:', error);
			// Jika error storage, fallback gunakan Data URL (base64) agar tetap tersimpan
			const b64 = buffer.toString('base64');
			return `data:${file.type};base64,${b64}`;
		}

		const { data } = client.storage.from(BUCKET_NAME).getPublicUrl(fileName);
		return data.publicUrl;
	}

	// Mode lokal filesystem
	mkdirSync(localUploadDir, { recursive: true });
	writeFileSync(path.join(localUploadDir, fileName), buffer);
	return `/uploads/${fileName}`;
}
