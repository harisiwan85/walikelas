import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { error } from '@sveltejs/kit';
import type { Role, User } from '$lib/types';
import type { RequestEvent } from '@sveltejs/kit';
import {
	isSupabase,
	checkIsSupabase,
	checkIsMysql,
	authFindUserByEmail,
	authFindUserByIdentifier,
	authGetUserById,
	authGetSession,
	authCreateSession,
	authDeleteSession,
	authUpsertByAuthId,
	authUpdatePasswordHash,
	authSetProfile
} from './data';

const SESSION_COOKIE = 'wk_session';
const SESSION_DAYS = 30;

// Cache sesi di memori untuk mempercepat navigasi (layout + halaman memanggil
// getCurrentUser berulang; di mode Supabase tiap lookup = 2 round-trip).
// TTL pendek (30 dtk) — aman karena sesi hanya berubah saat logout/ganti
// password/edit profil, yang semuanya menginvalidasi cache.
const USER_CACHE_TTL_MS = 30_000;
const userCache = new Map<string, { user: User; expires: number }>();

function cacheGetUser(token: string): User | null {
	const hit = userCache.get(token);
	if (!hit) return null;
	if (Date.now() > hit.expires) {
		userCache.delete(token);
		return null;
	}
	return hit.user;
}

function cacheSetUser(token: string, user: User) {
	userCache.set(token, { user, expires: Date.now() + USER_CACHE_TTL_MS });
}

function cacheInvalidate(userId: number) {
	for (const [token, entry] of userCache) {
		if (entry.user.id === userId) userCache.delete(token);
	}
}

// ---------------------------------------------------------------- password (mode lokal / mysql)

export function hashPassword(password: string): string {
	const salt = randomBytes(16).toString('hex');
	const hash = scryptSync(password, salt, 64).toString('hex');
	return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
	const [salt, hash] = stored.split(':');
	if (!salt || !hash) return false;
	const candidate = scryptSync(password, salt, 64);
	const expected = Buffer.from(hash, 'hex');
	return candidate.length === expected.length && timingSafeEqual(candidate, expected);
}

// ---------------------------------------------------------------- sesi

export async function createSession(userId: number): Promise<string> {
	const token = randomBytes(32).toString('hex');
	const expires = new Date(Date.now() + SESSION_DAYS * 24 * 3600 * 1000)
		.toISOString()
		.replace('T', ' ')
		.slice(0, 19);
	await authCreateSession(token, userId, expires);
	return token;
}

export async function deleteSession(token: string) {
	userCache.delete(token);
	await authDeleteSession(token);
}
export async function getUserByToken(token: string): Promise<User | null> {
	const cached = cacheGetUser(token);
	if (cached) return cached;
	const row = await authGetSession(token);
	if (!row) return null;
	if (new Date(row.expires_at) < new Date()) {
		await authDeleteSession(token);
		return null;
	}
	const user = await authGetUserById(row.user_id);
	if (user) cacheSetUser(token, user);
	return user;
}

export async function getUserByEmail(email: string): Promise<User | null> {
	const found = await authFindUserByEmail(email);
	if (!found) return null;
	const { password_hash: _ph, ...u } = found;
	return u as User;
}

// ---------------------------------------------------------------- login / logout

/**
 * Login — menerima username ATAU email. Mode Supabase memverifikasi via
 * Supabase Auth (email), mode lokal & MySQL via scrypt. Sesi aplikasi (cookie)
 * dikelola sendiri di tabel sessions pada semua mode.
 */
export async function login(identifier: string, password: string): Promise<User> {
	const found = await authFindUserByIdentifier(identifier);
	if (!found) throw error(401, 'Username/email atau password salah');
	const email = found.email;

	if (checkIsSupabase()) {
		const { getSupabaseAuthClient } = await import('./data/supabase');
		const authClient = getSupabaseAuthClient();
		const { data, error: authErr } = await authClient.auth.signInWithPassword({ email, password });
		if (authErr || !data.user) throw error(401, 'Username/email atau password salah');
		const id = await authUpsertByAuthId(data.user.id, email, found.name, found.role, found.teacher_id, found.class_id);
		if (id == null) throw new Error('Akun tidak ditemukan');
		const user = await authGetUserById(id);
		if (!user) throw new Error('Akun tidak ditemukan');
		return user;
	}

	if (!found.password_hash || !verifyPassword(password, found.password_hash)) {
		throw error(401, 'Username/email atau password salah');
	}
	const { password_hash: _ph, ...u } = found;
	return u as User;
}

export async function changePassword(user: User, oldPassword: string, newPassword: string): Promise<void> {
	if (checkIsSupabase()) {
		const { getSupabaseAuthClient } = await import('./data/supabase');
		const authClient = getSupabaseAuthClient();
		const { data, error: authErr } = await authClient.auth.signInWithPassword({ email: user.email, password: oldPassword });
		if (authErr || !data.user) throw error(400, 'Password lama salah');
		const { error: updErr } = await authClient.auth.admin.updateUserById(data.user.id, { password: newPassword });
		if (updErr) throw new Error('Gagal mengganti password: ' + updErr.message);
		return;
	}
	const found = await authFindUserByEmail(user.email);
	if (!found?.password_hash || !verifyPassword(oldPassword, found.password_hash)) {
		throw error(400, 'Password lama salah');
	}
	await authUpdatePasswordHash(user.id, hashPassword(newPassword));
	cacheInvalidate(user.id);
}
	const found = await authFindUserByEmail(user.email);
	if (!found?.password_hash || !verifyPassword(oldPassword, found.password_hash)) {
		throw error(400, 'Password lama salah');
	}
	await authUpdatePasswordHash(user.id, hashPassword(newPassword));
	cacheInvalidate(user.id);
}

export async function updateProfile(userId: number, name: string, fotoUrl = '') {
	cacheInvalidate(userId);
	await authSetProfile(userId, name, fotoUrl);
}

// ---------------------------------------------------------------- cookie & guard

export function getSessionCookie(event: RequestEvent): string | null {
	return event.cookies.get(SESSION_COOKIE) ?? null;
}

export function setSessionCookie(event: RequestEvent, token: string) {
	event.cookies.set(SESSION_COOKIE, token, {
		path: '/',
		httpOnly: true,
		sameSite: 'lax',
		maxAge: SESSION_DAYS * 24 * 3600
	});
}

export function clearSessionCookie(event: RequestEvent) {
	event.cookies.delete(SESSION_COOKIE, { path: '/' });
}

/** Memuat user dari cookie (web) atau header Authorization (API/Android). */
export async function getCurrentUser(event: RequestEvent): Promise<User | null> {
	const token = getSessionCookie(event) ?? event.request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
	if (!token) return null;
	return getUserByToken(token);
}

/** Throw 401 jika belum login, 403 jika role tidak diizinkan. */
export async function requireUser(event: RequestEvent): Promise<User> {
	const user = await getCurrentUser(event);
	if (!user) throw error(401, 'Silakan login terlebih dahulu');
	return user;
}

export async function requireRole(event: RequestEvent, roles: Role[]): Promise<User> {
	const user = await requireUser(event);
	if (!roles.includes(user.role)) throw error(403, 'Anda tidak memiliki akses ke fitur ini');
	return user;
}
