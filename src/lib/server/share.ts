import { createHmac, timingSafeEqual } from 'node:crypto';
import { env } from '$env/dynamic/private';

// Kunci penandatangan link publik. Ganti via env SHARE_SECRET pada produksi.
const SECRET = env.SHARE_SECRET || 'walikelas-share-secret-2026';

export const SHARE_TTL_DAYS = 7;

export interface SharePayload {
	from: string;
	to: string;
	class_id?: number;
	class_name?: string;
	wali_kelas?: string;
	student_ids?: number[];
	/** Batas waktu berlaku (ISO). */
	expires_at: string;
}

export type ShareVerifyResult =
	| { ok: true; payload: SharePayload }
	| { ok: false; reason: 'invalid' | 'expired' };

/** Buat token link publik: base64url(payload) + "." + HMAC-SHA256. */
export function createShareToken(payload: SharePayload): string {
	const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
	const sig = createHmac('sha256', SECRET).update(body).digest('base64url');
	return `${body}.${sig}`;
}

/** Verifikasi token; cek tanda tangan dan masa berlaku. */
export function verifyShareToken(token: string): ShareVerifyResult {
	const [body, sig] = token.split('.');
	if (!body || !sig) return { ok: false, reason: 'invalid' };
	const expected = createHmac('sha256', SECRET).update(body).digest();
	const given = Buffer.from(sig, 'base64url');
	if (given.length !== expected.length || !timingSafeEqual(given, expected)) return { ok: false, reason: 'invalid' };
	try {
		const p = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
		if (typeof p?.from !== 'string' || typeof p?.to !== 'string' || typeof p?.expires_at !== 'string') {
			return { ok: false, reason: 'invalid' };
		}
		const expires = Date.parse(p.expires_at);
		if (Number.isNaN(expires)) return { ok: false, reason: 'invalid' };
		if (expires < Date.now()) return { ok: false, reason: 'expired' };
		return {
			ok: true,
			payload: {
				from: p.from,
				to: p.to,
				class_id: typeof p.class_id === 'number' ? p.class_id : undefined,
				class_name: typeof p.class_name === 'string' ? p.class_name : undefined,
				wali_kelas: typeof p.wali_kelas === 'string' ? p.wali_kelas : undefined,
				student_ids: Array.isArray(p.student_ids) ? p.student_ids.map(Number) : undefined,
				expires_at: p.expires_at
			}
		};
	} catch {
		return { ok: false, reason: 'invalid' };
	}
}
