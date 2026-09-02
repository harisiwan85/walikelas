import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { env } from '$env/dynamic/private';
import type {
	AlertItem,
	AttendanceEntry,
	AttendanceStatus,
	ClassRow,
	DashboardSummary,
	JournalEntry,
	MatrixReport,
	ReportRow,
	School,
	Student,
	StudentStatus,
	Subject,
	Teacher,
	User
} from '$lib/types';
import { allowedClassIds } from '../rbac';
import { addDays, todayStr } from '$lib/date';

// Client sisi-server dengan service role key (tidak pernah diekspos ke browser).
let _client: SupabaseClient | null = null;
function sb(): SupabaseClient {
	if (!_client) {
		_client = createClient(env.SUPABASE_URL!, env.SUPABASE_SERVICE_ROLE_KEY!, {
			auth: { autoRefreshToken: false, persistSession: false }
		});
	}
	return _client;
}

/** Akses client Supabase (service role) untuk query data. */
export function getSupabase(): SupabaseClient {
	return sb();
}

// Client khusus operasi GoTrue (login/ganti password). Dipisah dari sb()
// karena signInWithPassword menyimpan sesi di memori client; jika dipakai
// pada client yang sama, request data berikutnya memakai JWT pengguna
// (kena RLS) alih-alih service-role — merusak perilaku server.
let _authClient: SupabaseClient | null = null;
export function getSupabaseAuthClient(): SupabaseClient {
	if (!_authClient) {
		_authClient = createClient(env.SUPABASE_URL!, env.SUPABASE_SERVICE_ROLE_KEY!, {
			auth: { autoRefreshToken: false, persistSession: false }
		});
	}
	return _authClient;
}

// ================================================================ AUTH STORE

async function userRowToUser(u: any): Promise<(User & { password_hash: string | null }) | null> {
	if (!u) return null;
	const t: any = Array.isArray(u.teachers) ? u.teachers[0] : u.teachers;
	return {
		id: u.id,
		username: u.username ?? null,
		email: u.email,
		// Nama diambil langsung dari tabel guru (sumber data real)
		name: t?.nama ?? u.name,
		role: u.role,
		teacher_id: u.teacher_id,
		class_id: u.class_id,
		class_name: Array.isArray(u.classes) ? (u.classes[0]?.nama ?? null) : (u.classes?.nama ?? null),
		foto_url: u.foto_url ?? '',
		password_hash: u.password_hash ?? null
	};
}

export async function authFindUserByEmail(email: string): Promise<(User & { password_hash: string | null }) | null> {
	const { data } = await sb()
		.from('users')
		.select('id, username, email, name, role, teacher_id, class_id, foto_url, password_hash, classes!users_class_id_fkey(nama), teachers!users_teacher_id_fkey(nama)')
		.ilike('email', email)
		.limit(1);
	return userRowToUser(data && data[0] ? data[0] : null);
}

/** Cari pengguna berdasarkan username ATAU email (untuk login). */
export async function authFindUserByIdentifier(identifier: string): Promise<(User & { password_hash: string | null }) | null> {
	const { data } = await sb()
		.from('users')
		.select('id, username, email, name, role, teacher_id, class_id, foto_url, password_hash, classes!users_class_id_fkey(nama), teachers!users_teacher_id_fkey(nama)')
		.or(`email.ilike.${identifier},username.ilike.${identifier}`)
		.limit(1);
	return userRowToUser(data && data[0] ? data[0] : null);
}

export async function authGetUserById(userId: number): Promise<User | null> {
	const { data } = await sb()
		.from('users')
		.select('id, username, email, name, role, teacher_id, class_id, foto_url, classes!users_class_id_fkey(nama), teachers!users_teacher_id_fkey(nama)')
		.eq('id', userId)
		.limit(1);
	const u = await userRowToUser(data && data[0] ? data[0] : null);
	if (!u) return null;
	const { password_hash: _ph, ...rest } = u;
	return rest as User;
}

export async function authGetSession(token: string): Promise<{ user_id: number; expires_at: string } | null> {
	const { data } = await sb().from('sessions').select('user_id, expires_at').eq('token', token).limit(1);
	if (!data || data.length === 0) return null;
	return data[0] as { user_id: number; expires_at: string };
}

export async function authCreateSession(token: string, userId: number, expiresAt: string) {
	await sb().from('sessions').insert({ token, user_id: userId, expires_at: expiresAt });
}

export async function authDeleteSession(token: string) {
	await sb().from('sessions').delete().eq('token', token);
}

/** Mode Supabase: pastikan baris users tersambung ke akun Supabase Auth. */
export async function authUpsertByAuthId(
	authId: string,
	email: string,
	name: string,
	role: string,
	teacherId: number | null,
	classId: number | null
): Promise<number | null> {
	const { data: byAuth } = await sb().from('users').select('id').eq('auth_id', authId).limit(1);
	if (byAuth && byAuth.length > 0) return byAuth[0].id;
	const { data: byEmail } = await sb().from('users').select('id').ilike('email', email).limit(1);
	if (byEmail && byEmail.length > 0) {
		const { error } = await sb().from('users').update({ auth_id: authId }).eq('id', byEmail[0].id);
		if (error) throw new Error(error.message);
		return byEmail[0].id;
	}
	const { data, error } = await sb()
		.from('users')
		.insert({ auth_id: authId, email, name, role, teacher_id: teacherId, class_id: classId, foto_url: '' })
		.select('id')
		.single();
	if (error) throw new Error(error.message);
	return data?.id ?? null;
}

/** Password dikelola Supabase Auth — tidak perlu menyimpan hash. */
export async function authUpdatePasswordHash(_userId: number, _hash: string) {}

export async function authGetAuthId(userId: number): Promise<string | null> {
	const { data } = await sb().from('users').select('auth_id').eq('id', userId).limit(1);
	return data && data[0]?.auth_id ? (data[0].auth_id as string) : null;
}

// ---------------------------------------------------------------- kelola akun guru

export async function findUserByTeacherId(teacherId: number): Promise<(User & { password_hash: string | null }) | null> {
	const { data } = await sb()
		.from('users')
		.select('id, username, email, name, role, teacher_id, class_id, foto_url, password_hash, classes!users_class_id_fkey(nama), teachers!users_teacher_id_fkey(nama)')
		.eq('teacher_id', teacherId)
		.limit(1);
	return userRowToUser(data && data[0] ? data[0] : null);
}

export async function createUserAccount(data: {
	username: string;
	email: string;
	password_hash: string | null;
	name: string;
	role: string;
	teacher_id: number;
	class_id: number | null;
}): Promise<number> {
	const { data: row, error } = await sb()
		.from('users')
		.insert({
			username: data.username,
			email: data.email,
			password_hash: data.password_hash,
			name: data.name,
			role: data.role,
			teacher_id: data.teacher_id,
			class_id: data.class_id,
			foto_url: ''
		})
		.select('id')
		.single();
	if (error) throw new Error(error.message);
	return row.id;
}

export async function updateUserAccount(
	userId: number,
	data: { username?: string; email?: string; role?: string; password_hash?: string | null }
) {
	const patch: any = {};
	if (data.username !== undefined) patch.username = data.username;
	if (data.email !== undefined) patch.email = data.email;
	if (data.role !== undefined) patch.role = data.role;
	const { error } = await sb().from('users').update(patch).eq('id', userId);
	if (error) throw new Error(error.message);
}

export async function authSetProfile(userId: number, name: string, fotoUrl: string) {
	const { data: u } = await sb().from('users').select('auth_id').eq('id', userId).limit(1);
	if (u && u[0]?.auth_id) {
		await sb().auth.admin.updateUserById(u[0].auth_id, { user_metadata: { name, foto_url: fotoUrl } });
	}
	const { error } = await sb().from('users').update({ name, foto_url: fotoUrl }).eq('id', userId);
	if (error) throw new Error(error.message);
}

// ---------------------------------------------------------------- school

export async function getSchool(): Promise<School> {
	const { data } = await sb().from('schools').select('*').limit(1);
	const s: any = data && data[0] ? data[0] : {};
	const { data: settings } = await sb().from('settings').select('key, value').eq('key', 'alpa_threshold').limit(1);
	const threshold = settings && settings[0] ? Number(settings[0].value) : 3;
	return {
		id: s.id ?? 1,
		nama: s.nama ?? '',
		npsn: s.npsn ?? '',
		alamat: s.alamat ?? '',
		logo_url: s.logo_url ?? '',
		kepala_sekolah: s.kepala_sekolah ?? '',
		tahun_ajaran_aktif: s.tahun_ajaran_aktif ?? '2026/2027',
		semester_aktif: s.semester_aktif ?? 'Ganjil',
		alpa_threshold: threshold
	};
}

export async function updateSchool(data: Partial<School>) {
	const school = await getSchool();
	const { error } = await sb()
		.from('schools')
		.update({
			nama: data.nama ?? school.nama,
			npsn: data.npsn ?? school.npsn,
			alamat: data.alamat ?? school.alamat,
			logo_url: data.logo_url ?? school.logo_url,
			kepala_sekolah: data.kepala_sekolah ?? school.kepala_sekolah,
			tahun_ajaran_aktif: data.tahun_ajaran_aktif ?? school.tahun_ajaran_aktif,
			semester_aktif: data.semester_aktif ?? school.semester_aktif
		})
		.eq('id', school.id);
	if (error) throw new Error(error.message);
	if (data.alpa_threshold !== undefined) {
		await sb()
			.from('settings')
			.upsert({ key: 'alpa_threshold', value: String(data.alpa_threshold) }, { onConflict: 'key' });
	}
}

export async function getSetting(key: string, def = ''): Promise<string> {
	const { data } = await sb().from('settings').select('value').eq('key', key).limit(1);
	return data && data[0] ? (data[0].value as string) : def;
}

// ---------------------------------------------------------------- classes

async function loadClasses(ids?: number[]): Promise<ClassRow[]> {
	let q = sb()
		.from('classes')
		.select('id, nama, tingkat, tahun_ajaran, wali_kelas_id, teachers!classes_wali_kelas_id_fkey(nama)')
		.order('tingkat', { ascending: true })
		.order('nama', { ascending: true });
	if (ids && ids.length) q = q.in('id', ids);
	const { data } = await q;
	const { data: students } = await sb().from('students').select('class_id').eq('status', 'aktif');
	const counts = new Map<number, number>();
	for (const r of students ?? []) counts.set(r.class_id, (counts.get(r.class_id) ?? 0) + 1);
	return (data ?? []).map((c: any) => ({
		id: c.id,
		nama: c.nama,
		tingkat: c.tingkat,
		tahun_ajaran: c.tahun_ajaran,
		wali_kelas_id: c.wali_kelas_id,
		wali_kelas_nama: Array.isArray(c.teachers) ? (c.teachers[0]?.nama ?? null) : (c.teachers?.nama ?? null),
		jumlah_siswa: counts.get(c.id) ?? 0
	})) as ClassRow[];
}

export async function getClasses(user: User | null = null): Promise<ClassRow[]> {
	const allowed = user ? allowedClassIds(user) : null;
	return loadClasses(allowed ?? undefined);
}

export async function getClass(id: number): Promise<ClassRow | null> {
	const rows = await loadClasses([id]);
	return rows[0] ?? null;
}

/** Sinkronkan role akun & jabatan guru dengan status wali kelas: jadi wali_kelas bila
 *  masih ditunjuk di kelas mana pun, kembali ke guru_mapel bila tidak. Jabatan
 *  admin/kepala_sekolah tidak ditimpa saat guru dilepas dari wali kelas. */
export async function syncWaliKelasRole(teacherId: number | null): Promise<void> {
	if (!teacherId) return;
	const { data: still } = await sb().from('classes').select('id').eq('wali_kelas_id', teacherId).limit(1);
	const isWali = !!(still && still.length > 0);
	const { data: cur } = await sb().from('teachers').select('id, jabatan').eq('id', teacherId).limit(1);
	if (!cur || cur.length === 0) return;
	const c: any = cur[0];
	let jabatan = c.jabatan;
	if (isWali) jabatan = 'wali_kelas';
	else if (c.jabatan === 'wali_kelas') jabatan = 'guru_mapel';
	const role = jabatan;
	if (jabatan !== c.jabatan) {
		await sb().from('teachers').update({ jabatan }).eq('id', teacherId);
	}
	const { data: acc } = await sb().from('users').select('id, auth_id').eq('teacher_id', teacherId).limit(1);
	if (!acc || acc.length === 0) return;
	await sb().from('users').update({ role }).eq('teacher_id', teacherId);
	if (acc[0].auth_id) {
		await sb().auth.admin.updateUserById(acc[0].auth_id, { user_metadata: { role } });
	}
}

export async function createClass(data: { nama: string; tingkat: number; tahun_ajaran: string; wali_kelas_id: number | null }) {
	const school = await getSchool();
	const { data: row, error } = await sb()
		.from('classes')
		.insert({ school_id: school.id, nama: data.nama, tingkat: data.tingkat, tahun_ajaran: data.tahun_ajaran, wali_kelas_id: data.wali_kelas_id })
		.select('id')
		.single();
	if (error) throw new Error(error.message);
	await syncWaliKelasRole(data.wali_kelas_id);
	return { lastInsertRowid: row.id };
}

export async function updateClass(id: number, data: Partial<ClassRow>) {
	const cur = await getClass(id);
	if (!cur) throw new Error('Kelas tidak ditemukan');
	const { error } = await sb()
		.from('classes')
		.update({
			nama: data.nama ?? cur.nama,
			tingkat: data.tingkat ?? cur.tingkat,
			tahun_ajaran: data.tahun_ajaran ?? cur.tahun_ajaran,
			wali_kelas_id: data.wali_kelas_id !== undefined ? data.wali_kelas_id : cur.wali_kelas_id
		})
		.eq('id', id);
	if (error) throw new Error(error.message);
	// Role guru lama & baru disinkronkan setelah kelas tersimpan
	if (data.wali_kelas_id !== undefined && data.wali_kelas_id !== cur.wali_kelas_id) {
		await syncWaliKelasRole(cur.wali_kelas_id);
		await syncWaliKelasRole(data.wali_kelas_id);
	}
}

export async function deleteClass(id: number) {
	const cur = await getClass(id);
	const { error } = await sb().from('classes').delete().eq('id', id);
	if (error) throw new Error(error.message);
	await syncWaliKelasRole(cur?.wali_kelas_id ?? null);
}

// ---------------------------------------------------------------- teachers

/** true bila kolom kode sudah ada di tabel teachers (sebelum migrasi SQL dijalankan). */
let teachersHasKode: boolean | null = null;
let teachersKodeCheck = 0;
async function ensureTeachersKode(): Promise<boolean> {
	const now = Date.now();
	// Dicek ulang berkala agar perubahan kolom di Supabase langsung terdeteksi tanpa restart
	if (teachersHasKode === null || now - teachersKodeCheck > 30_000) {
		const { error } = await sb().from('teachers').select('kode').limit(1);
		teachersHasKode = !error;
		teachersKodeCheck = now;
	}
	return teachersHasKode;
}

export async function getTeachers(): Promise<Teacher[]> {
	const withKode = await ensureTeachersKode();
	const { data } = await sb()
		.from('teachers')
		.select(
			withKode
				? 'id, kode, nip, nuptk, nama, jabatan, kontak, users!users_teacher_id_fkey(id, username, email, role, foto_url)'
				: 'id, nip, nuptk, nama, jabatan, kontak, users!users_teacher_id_fkey(id, username, email, role, foto_url)'
		)
		.order('nama');
	return (data ?? []).map((t: any) => {
		const u: any = Array.isArray(t.users) ? t.users[0] : t.users;
		return {
			id: t.id,
			kode: t.kode ?? '',
			nip: t.nip ?? '',
			nuptk: t.nuptk ?? '',
			nama: t.nama,
			jabatan: t.jabatan ?? 'guru_mapel',
			kontak: t.kontak ?? '',
			foto_url: u?.foto_url ?? '',
			user_id: u?.id ?? null,
			username: u?.username ?? null,
			user_email: u?.email ?? null,
			user_role: u?.role ?? null
		};
	}) as Teacher[];
}

export async function createTeacher(data: Omit<Teacher, 'id'> & { foto_url?: string }) {
	const school = await getSchool();
	const row: Record<string, unknown> = {
		school_id: school.id,
		nip: data.nip ?? '',
		nuptk: data.nuptk ?? '',
		nama: data.nama,
		jabatan: data.jabatan ?? 'guru_mapel',
		kontak: data.kontak ?? ''
	};
	if (await ensureTeachersKode()) row.kode = data.kode ?? '';
	const { data: created, error } = await sb().from('teachers').insert(row).select('id').single();
	if (error) throw new Error(error.message);

	if (data.foto_url) {
		const { getOrCreateTeacherAccount } = await import('$lib/server/accounts');
		const acc = await getOrCreateTeacherAccount({ id: created.id, ...data } as any);
		await authSetProfile(acc.id, data.nama, data.foto_url);
	}

	return { lastInsertRowid: created.id };
}

export async function updateTeacher(id: number, data: Partial<Teacher> & { foto_url?: string }) {
	const { data: cur } = await sb().from('teachers').select('*').eq('id', id).limit(1);
	if (!cur || cur.length === 0) throw new Error('Guru tidak ditemukan');
	const c: any = cur[0];
	const patch: Record<string, unknown> = {
		nip: data.nip ?? c.nip,
		nuptk: data.nuptk ?? c.nuptk,
		nama: data.nama ?? c.nama,
		jabatan: data.jabatan ?? c.jabatan,
		kontak: data.kontak ?? c.kontak
	};
	if (await ensureTeachersKode()) patch.kode = data.kode ?? c.kode ?? '';
	const { error } = await sb().from('teachers').update(patch).eq('id', id);
	if (error) throw new Error(error.message);

	// Nama, jabatan, dan foto di halaman Data Guru ikut disinkronkan ke akun login
	let { data: account } = await sb().from('users').select('id, auth_id, foto_url').eq('teacher_id', id).limit(1);
	if ((!account || account.length === 0) && data.foto_url) {
		const { getOrCreateTeacherAccount } = await import('$lib/server/accounts');
		await getOrCreateTeacherAccount({ id, ...c, ...data } as any);
		const res = await sb().from('users').select('id, auth_id, foto_url').eq('teacher_id', id).limit(1);
		account = res.data;
	}

	if (account && account.length > 0) {
		const userPatch: any = {};
		if (data.nama) userPatch.name = data.nama;
		if (data.jabatan) userPatch.role = data.jabatan;
		if (data.foto_url !== undefined) userPatch.foto_url = data.foto_url;
		await sb().from('users').update(userPatch).eq('teacher_id', id);
		if (account[0].auth_id) {
			await sb().auth.admin.updateUserById(account[0].auth_id, {
				user_metadata: {
					...(data.nama ? { name: data.nama } : {}),
					...(data.jabatan ? { role: data.jabatan } : {}),
					...(data.foto_url !== undefined ? { foto_url: data.foto_url } : {})
				}
			});
		}
	}
}

export async function deleteTeacher(id: number) {
	await sb().from('classes').update({ wali_kelas_id: null }).eq('wali_kelas_id', id);
	await sb().from('subjects').update({ teacher_id: null }).eq('teacher_id', id);

	// Hapus akun user yang terhubung beserta semua referensinya (agar tidak kena FK constraint)
	const { data: accounts } = await sb().from('users').select('id, auth_id').eq('teacher_id', id);
	for (const u of accounts ?? []) {
		await sb().from('attendance_daily').update({ dicatat_oleh: null }).eq('dicatat_oleh', u.id);
		await sb().from('attendance_subject').update({ dicatat_oleh: null }).eq('dicatat_oleh', u.id);
		await sb().from('class_journals').update({ dicatat_oleh: null }).eq('dicatat_oleh', u.id);
		await sb().from('attendance_logs').update({ user_id: null }).eq('user_id', u.id);
		if (u.auth_id) await sb().auth.admin.deleteUser(u.auth_id);
		await sb().from('users').delete().eq('id', u.id);
	}

	const { error } = await sb().from('teachers').delete().eq('id', id);
	if (error) throw new Error(error.message);
}

// ---------------------------------------------------------------- subjects

export async function getSubjects(): Promise<Subject[]> {
	const { data } = await sb()
		.from('subjects')
		.select('id, kode, nama, teacher_id, teachers!subjects_teacher_id_fkey(nama)')
		.order('nama');
	const { data: sc } = await sb().from('subject_classes').select('subject_id, classes(id, nama)');
	const bySubject = new Map<number, { id: number; nama: string }[]>();
	for (const r of sc ?? []) {
		const cls: any = Array.isArray(r.classes) ? r.classes[0] : r.classes;
		if (!cls) continue;
		if (!bySubject.has(r.subject_id)) bySubject.set(r.subject_id, []);
		bySubject.get(r.subject_id)!.push({ id: cls.id, nama: cls.nama });
	}

	let st: any[] | null = null;
	try {
		const res = await sb().from('subject_teachers').select('subject_id, teachers(id, nama)');
		st = res.data;
	} catch (_) {}

	const teachersBySubj = new Map<number, { id: number; nama: string }[]>();
	for (const r of st ?? []) {
		const tch: any = Array.isArray(r.teachers) ? r.teachers[0] : r.teachers;
		if (!tch) continue;
		if (!teachersBySubj.has(r.subject_id)) teachersBySubj.set(r.subject_id, []);
		teachersBySubj.get(r.subject_id)!.push({ id: tch.id, nama: tch.nama });
	}

	return (data ?? []).map((s: any) => {
		const list = teachersBySubj.get(s.id) ?? (s.teacher_id ? [{ id: s.teacher_id, nama: (Array.isArray(s.teachers) ? s.teachers[0]?.nama : s.teachers?.nama) ?? '' }] : []);
		return {
			id: s.id,
			kode: s.kode,
			nama: s.nama,
			teacher_id: s.teacher_id,
			teacher_ids: list.map((t) => t.id),
			teachers: list,
			teacher_nama: list.map((t) => t.nama).join(', ') || (Array.isArray(s.teachers) ? s.teachers[0]?.nama : s.teachers?.nama) || null,
			classes: bySubject.get(s.id) ?? []
		};
	}) as Subject[];
}

export async function getTeacherSubjects(teacherId: number): Promise<Subject[]> {
	const { data: direct } = await sb()
		.from('subjects')
		.select('id, kode, nama, teacher_id, teachers!subjects_teacher_id_fkey(nama)')
		.eq('teacher_id', teacherId)
		.order('nama');

	let st: any[] | null = null;
	try {
		const res = await sb()
			.from('subject_teachers')
			.select('subject_id, subjects(id, kode, nama, teacher_id, teachers!subjects_teacher_id_fkey(nama))')
			.eq('teacher_id', teacherId);
		st = res.data;
	} catch (_) {}

	const seen = new Map<number, Subject>();
	for (const s of direct ?? []) {
		const tch: any = Array.isArray(s.teachers) ? s.teachers[0] : s.teachers;
		seen.set(s.id, {
			id: s.id,
			kode: s.kode,
			nama: s.nama,
			teacher_id: s.teacher_id,
			teacher_nama: tch?.nama ?? null,
			classes: []
		});
	}
	for (const r of st ?? []) {
		const s: any = r.subjects;
		if (s) {
			const tch: any = Array.isArray(s.teachers) ? s.teachers[0] : s.teachers;
			seen.set(s.id, {
				id: s.id,
				kode: s.kode,
				nama: s.nama,
				teacher_id: s.teacher_id,
				teacher_nama: tch?.nama ?? null,
				classes: []
			});
		}
	}
	return [...seen.values()].sort((a, b) => a.nama.localeCompare(b.nama));
}

export async function getClassesForTeacher(teacherId: number): Promise<ClassRow[]> {
	const { data: subjectRows } = await sb().from('subjects').select('id').eq('teacher_id', teacherId);
	let stRows: any[] | null = null;
	try {
		const res = await sb().from('subject_teachers').select('subject_id').eq('teacher_id', teacherId);
		stRows = res.data;
	} catch (_) {}
	const subjectIds = [
		...(subjectRows ?? []).map((r: any) => r.id),
		...(stRows ?? []).map((r: any) => r.subject_id)
	];
	if (!subjectIds.length) return [];
	const { data: sc } = await sb().from('subject_classes').select('class_id').in('subject_id', subjectIds);
	const classIds = [...new Set((sc ?? []).map((r) => r.class_id))];
	return loadClasses(classIds);
}

export async function getSubjectsForClass(classId: number): Promise<Subject[]> {
	const { data } = await sb()
		.from('subject_classes')
		.select('subjects(id, kode, nama, teacher_id, teachers!subjects_teacher_id_fkey(nama))')
		.eq('class_id', classId);

	let st: any[] | null = null;
	try {
		const res = await sb().from('subject_teachers').select('subject_id, teachers(id, nama)');
		st = res.data;
	} catch (_) {}

	const teachersBySubj = new Map<number, { id: number; nama: string }[]>();
	for (const r of st ?? []) {
		const tch: any = Array.isArray(r.teachers) ? r.teachers[0] : r.teachers;
		if (!tch) continue;
		if (!teachersBySubj.has(r.subject_id)) teachersBySubj.set(r.subject_id, []);
		teachersBySubj.get(r.subject_id)!.push({ id: tch.id, nama: tch.nama });
	}

	const seen = new Map<number, Subject>();
	for (const r of data ?? []) {
		const s: any = r.subjects;
		if (!s) continue;
		const list = teachersBySubj.get(s.id) ?? (s.teacher_id ? [{ id: s.teacher_id, nama: (Array.isArray(s.teachers) ? s.teachers[0]?.nama : s.teachers?.nama) ?? '' }] : []);
		seen.set(s.id, {
			id: s.id,
			kode: s.kode,
			nama: s.nama,
			teacher_id: s.teacher_id,
			teacher_ids: list.map((t) => t.id),
			teachers: list,
			teacher_nama: list.map((t) => t.nama).join(', ') || (Array.isArray(s.teachers) ? s.teachers[0]?.nama : s.teachers?.nama) || null,
			classes: []
		});
	}
	return [...seen.values()].sort((a, b) => a.nama.localeCompare(b.nama));
}

export async function createSubject(data: { kode: string; nama: string; teacher_id: number | null; teacher_ids?: number[]; class_ids: number[] }) {
	const primaryTeacherId = data.teacher_ids && data.teacher_ids.length ? data.teacher_ids[0] : data.teacher_id;
	const { data: row, error } = await sb()
		.from('subjects')
		.insert({ kode: data.kode ?? '', nama: data.nama, teacher_id: primaryTeacherId })
		.select('id')
		.single();
	if (error) throw new Error(error.message);
	for (const cid of data.class_ids ?? []) {
		await sb().from('subject_classes').insert({ subject_id: row.id, class_id: cid });
	}

	const allTeacherIds = data.teacher_ids && data.teacher_ids.length
		? data.teacher_ids
		: primaryTeacherId
		? [primaryTeacherId]
		: [];
	for (const tid of allTeacherIds) {
		try {
			await sb().from('subject_teachers').insert({ subject_id: row.id, teacher_id: tid });
		} catch (_) {}
	}
	return row.id;
}

export async function updateSubject(id: number, data: Partial<Subject> & { teacher_ids?: number[]; class_ids?: number[] }) {
	const { data: cur } = await sb().from('subjects').select('*').eq('id', id).limit(1);
	if (!cur || cur.length === 0) throw new Error('Mata pelajaran tidak ditemukan');
	const c: any = cur[0];
	const primaryTeacherId = data.teacher_ids !== undefined
		? (data.teacher_ids[0] ?? null)
		: (data.teacher_id !== undefined ? data.teacher_id : c.teacher_id);

	const { error } = await sb()
		.from('subjects')
		.update({
			kode: data.kode ?? c.kode,
			nama: data.nama ?? c.nama,
			teacher_id: primaryTeacherId
		})
		.eq('id', id);
	if (error) throw new Error(error.message);

	if (data.classes || data.class_ids) {
		await sb().from('subject_classes').delete().eq('subject_id', id);
		const cids = data.class_ids ?? (data.classes ?? []).map((c2) => c2.id);
		for (const cid of cids) {
			await sb().from('subject_classes').insert({ subject_id: id, class_id: cid });
		}
	}

	if (data.teacher_ids !== undefined || data.teachers !== undefined) {
		try {
			await sb().from('subject_teachers').delete().eq('subject_id', id);
		} catch (_) {}
		const tids = data.teacher_ids ?? (data.teachers ?? []).map((t) => t.id);
		for (const tid of tids) {
			try {
				await sb().from('subject_teachers').insert({ subject_id: id, teacher_id: tid });
			} catch (_) {}
		}
	}
}

export async function deleteSubject(id: number) {
	const { error } = await sb().from('subjects').delete().eq('id', id);
	if (error) throw new Error(error.message);
}

// ---------------------------------------------------------------- students

export interface StudentFilter {
	class_id?: number;
	q?: string;
	status?: StudentStatus;
	user?: User | null;
}

export async function getStudents(filter: StudentFilter = {}): Promise<Student[]> {
	const allowed = filter.user ? allowedClassIds(filter.user) : null;
	let q = sb()
		.from('students')
		.select('id, class_id, classes!students_class_id_fkey(nama), nisn, nis, nama, jenis_kelamin, tempat_lahir, tanggal_lahir, alamat, no_hp_ortu, foto_url, status');
	if (allowed) q = q.in('class_id', allowed);
	if (filter.class_id) q = q.eq('class_id', filter.class_id);
	if (filter.q) {
		const s = filter.q;
		q = q.or(`nama.ilike.%${s}%,nisn.ilike.%${s}%,nis.ilike.%${s}%`);
	}
	if (filter.status) q = q.eq('status', filter.status);
	q = q.order('classes(nama)').order('nama');
	const { data } = await q;
	return (data ?? []).map((r: any) => ({
		id: r.id,
		class_id: r.class_id,
		class_name: r.classes?.nama ?? '',
		nisn: r.nisn ?? '',
		nis: r.nis ?? '',
		nama: r.nama,
		jenis_kelamin: r.jenis_kelamin as 'L' | 'P',
		tempat_lahir: r.tempat_lahir ?? '',
		tanggal_lahir: r.tanggal_lahir ?? '',
		alamat: r.alamat ?? '',
		no_hp_ortu: r.no_hp_ortu ?? '',
		foto_url: r.foto_url ?? '',
		status: r.status
	})) as Student[];
}

export async function getStudent(id: number): Promise<Student | null> {
	const { data } = await sb()
		.from('students')
		.select('id, class_id, classes!students_class_id_fkey(nama), nisn, nis, nama, jenis_kelamin, tempat_lahir, tanggal_lahir, alamat, no_hp_ortu, foto_url, status')
		.eq('id', id)
		.limit(1);
	if (!data || data.length === 0) return null;
	const r: any = data[0];
	return {
		id: r.id,
		class_id: r.class_id,
		class_name: r.classes?.nama ?? '',
		nisn: r.nisn ?? '',
		nis: r.nis ?? '',
		nama: r.nama,
		jenis_kelamin: r.jenis_kelamin as 'L' | 'P',
		tempat_lahir: r.tempat_lahir ?? '',
		tanggal_lahir: r.tanggal_lahir ?? '',
		alamat: r.alamat ?? '',
		no_hp_ortu: r.no_hp_ortu ?? '',
		foto_url: r.foto_url ?? '',
		status: r.status
	};
}

export async function createStudent(data: Partial<Student>) {
	const { data: row, error } = await sb()
		.from('students')
		.insert({
			class_id: data.class_id,
			nisn: data.nisn ?? '',
			nis: data.nis ?? '',
			nama: data.nama,
			jenis_kelamin: data.jenis_kelamin ?? 'L',
			tempat_lahir: data.tempat_lahir ?? '',
			tanggal_lahir: data.tanggal_lahir ?? '',
			alamat: data.alamat ?? '',
			no_hp_ortu: data.no_hp_ortu ?? '',
			foto_url: data.foto_url ?? '',
			status: data.status ?? 'aktif'
		})
		.select('id')
		.single();
	if (error) throw new Error(error.message);
	return { lastInsertRowid: row.id };
}

export async function updateStudent(id: number, data: Partial<Student>) {
	const cur = await getStudent(id);
	if (!cur) throw new Error('Siswa tidak ditemukan');
	const { error } = await sb()
		.from('students')
		.update({
			class_id: data.class_id ?? cur.class_id,
			nisn: data.nisn ?? cur.nisn,
			nis: data.nis ?? cur.nis,
			nama: data.nama ?? cur.nama,
			jenis_kelamin: data.jenis_kelamin ?? cur.jenis_kelamin,
			tempat_lahir: data.tempat_lahir ?? cur.tempat_lahir,
			tanggal_lahir: data.tanggal_lahir ?? cur.tanggal_lahir,
			alamat: data.alamat ?? cur.alamat,
			no_hp_ortu: data.no_hp_ortu ?? cur.no_hp_ortu,
			foto_url: data.foto_url ?? cur.foto_url,
			status: data.status ?? cur.status
		})
		.eq('id', id);
	if (error) throw new Error(error.message);
}

export async function deleteStudent(id: number) {
	const { error } = await sb().from('students').delete().eq('id', id);
	if (error) throw new Error(error.message);
}

export async function importStudents(class_id: number, rows: any[]): Promise<{ inserted: number; skipped: number }> {
	const { data: existingRows } = await sb().from('students').select('nisn').eq('class_id', class_id);
	const existing = new Set((existingRows ?? []).map((r) => r.nisn));
	let inserted = 0;
	let skipped = 0;
	for (const r of rows) {
		const nisn = String(r.nisn ?? '').trim();
		const nama = String(r.nama ?? '').trim();
		if (!nama) continue;
		if (nisn && existing.has(nisn)) {
			skipped++;
			continue;
		}
		const statusRaw = String(r.status ?? '').trim();
		const status = ['aktif', 'pindah', 'lulus', 'keluar'].includes(statusRaw) ? statusRaw : 'aktif';
		const { error } = await sb().from('students').insert({
			class_id,
			nisn,
			nis: String(r.nis ?? '').trim(),
			nama,
			jenis_kelamin: String(r.jenis_kelamin ?? 'L').trim().toUpperCase() === 'P' ? 'P' : 'L',
			tempat_lahir: String(r.tempat_lahir ?? '').trim(),
			tanggal_lahir: normalizeDate(String(r.tanggal_lahir ?? '').trim()),
			alamat: String(r.alamat ?? '').trim(),
			no_hp_ortu: String(r.no_hp_ortu ?? '').trim(),
			status
		});
		if (error) throw new Error(error.message);
		if (nisn) existing.add(nisn);
		inserted++;
	}
	return { inserted, skipped };
}

function normalizeDate(v: string): string {
	if (!v) return '';
	const m = v.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
	if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
	const iso = v.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
	if (iso) return `${iso[1]}-${iso[2].padStart(2, '0')}-${iso[3].padStart(2, '0')}`;
	return v;
}

// ---------------------------------------------------------------- attendance

export async function isHoliday(dateStr: string): Promise<{ libur: boolean; keterangan: string | null }> {
	const { data } = await sb().from('academic_calendar').select('keterangan, tipe').eq('tanggal', dateStr).limit(1);
	if (data && data.length > 0) {
		const r: any = data[0];
		return { libur: r.tipe === 'libur', keterangan: r.keterangan };
	}
	return { libur: false, keterangan: null };
}

export async function getAttendanceByDate(dateStr: string, classIds: number[] | null = null): Promise<Map<number, any>> {
	let q = sb().from('attendance_daily').select('*').eq('tanggal', dateStr);
	if (classIds && classIds.length) {
		const { data: students } = await sb().from('students').select('id').in('class_id', classIds);
		const ids = (students ?? []).map((s) => s.id);
		if (ids.length) q = q.in('student_id', ids);
		else return new Map();
	}
	const { data } = await q;
	const map = new Map<number, any>();
	for (const r of data ?? []) map.set(r.student_id, r);
	return map;
}

export async function upsertAttendance(dateStr: string, classId: number, entries: AttendanceEntry[], user: User): Promise<number> {
	const students = await getStudents({ class_id: classId, status: 'aktif' });
	const studentIds = new Set(students.map((s) => s.id));
	const validStatuses: AttendanceStatus[] = ['hadir', 'sakit', 'izin', 'alpa', 'terlambat'];

	const { data: existing } = await sb().from('attendance_daily').select('id, student_id, status').eq('tanggal', dateStr);
	const oldMap = new Map<number, any>((existing ?? []).map((r) => [r.student_id, r]));

	const toUpsert = entries.filter((e) => studentIds.has(e.student_id) && validStatuses.includes(e.status));
	if (!toUpsert.length) return 0;

	const { data: upserted, error } = await sb()
		.from('attendance_daily')
		.upsert(
			toUpsert.map((e) => ({
				student_id: e.student_id,
				tanggal: dateStr,
				status: e.status,
				keterangan: e.keterangan ?? '',
				bukti_url: e.bukti_url ?? '',
				dicatat_oleh: user.id,
				updated_at: new Date().toISOString()
			})),
			{ onConflict: 'student_id,tanggal' }
		)
		.select('id, student_id, status');
	if (error) throw new Error(error.message);

	for (const r of upserted ?? []) {
		const old = oldMap.get(r.student_id);
		if (!old || old.status !== r.status) {
			await sb().from('attendance_logs').insert({
				attendance_id: r.id,
				student_id: r.student_id,
				tanggal: dateStr,
				user_id: user.id,
				old_status: old ? old.status : '',
				new_status: r.status
			});
		}
	}
	return toUpsert.length;
}

export interface HistoryFilter {
	student_id?: number;
	class_id?: number;
	from?: string;
	to?: string;
	user?: User | null;
}

export async function getAttendanceHistory(filter: HistoryFilter) {
	const allowed = filter.user ? allowedClassIds(filter.user) : null;
	let q = sb()
		.from('attendance_daily')
		.select(
			'id, student_id, tanggal, status, keterangan, bukti_url, updated_at, students!attendance_daily_student_id_fkey(nisn, nama, class_id, classes!students_class_id_fkey(nama)), users!attendance_daily_dicatat_oleh_fkey(name)'
		);
	if (filter.student_id) q = q.eq('student_id', filter.student_id);
	if (allowed) {
		const { data: students } = await sb().from('students').select('id').in('class_id', allowed);
		const ids = (students ?? []).map((s) => s.id);
		if (ids.length) q = q.in('student_id', ids);
	}
	if (filter.class_id) {
		const { data: students } = await sb().from('students').select('id').eq('class_id', filter.class_id);
		const ids = (students ?? []).map((s) => s.id);
		if (ids.length) q = q.in('student_id', ids);
	}
	if (filter.from) q = q.gte('tanggal', filter.from);
	if (filter.to) q = q.lte('tanggal', filter.to);
	q = q.order('tanggal', { ascending: false }).limit(500);
	const { data } = await q;
	return (data ?? []).map((r: any) => ({
		id: r.id,
		student_id: r.student_id,
		nisn: r.students?.nisn ?? '',
		nama: r.students?.nama ?? '',
		class_id: r.students?.class_id,
		class_name: r.students?.classes?.nama ?? '',
		tanggal: r.tanggal,
		status: r.status,
		keterangan: r.keterangan ?? '',
		bukti_url: r.bukti_url ?? '',
		dicatat_oleh: r.users?.name ?? null,
		updated_at: r.updated_at
	}));
}

export async function getAttendanceLogs(limit = 100) {
	const { data } = await sb()
		.from('attendance_logs')
		.select(
			'id, student_id, tanggal, old_status, new_status, changed_at, students!attendance_logs_student_id_fkey(nama), users!attendance_logs_user_id_fkey(name)'
		)
		.order('changed_at', { ascending: false })
		.limit(limit);
	return (data ?? []).map((r: any) => ({
		id: r.id,
		student_id: r.student_id,
		nama: r.students?.nama ?? '',
		tanggal: r.tanggal,
		old_status: r.old_status ?? '',
		new_status: r.new_status,
		user_name: r.users?.name ?? null,
		changed_at: r.changed_at
	}));
}

// ---------------------------------------------------------------- absensi per mapel

export async function getAttendanceSubjectByDate(
	dateStr: string,
	classId: number,
	subjectId: number,
	jamKe: number
): Promise<Map<number, { id: number; student_id: number; status: AttendanceStatus; keterangan: string }>> {
	const { data } = await sb()
		.from('attendance_subject')
		.select('id, student_id, status, keterangan')
		.eq('tanggal', dateStr)
		.eq('class_id', classId)
		.eq('subject_id', subjectId)
		.eq('jam_ke', jamKe);
	const map = new Map<number, { id: number; student_id: number; status: AttendanceStatus; keterangan: string }>();
	for (const r of data ?? []) map.set(r.student_id, r);
	return map;
}

export async function upsertSubjectAttendance(
	dateStr: string,
	classId: number,
	subjectId: number,
	jamKe: number,
	entries: AttendanceEntry[],
	user: User
): Promise<number> {
	const students = await getStudents({ class_id: classId, status: 'aktif' });
	const studentIds = new Set(students.map((s) => s.id));
	const validStatuses: AttendanceStatus[] = ['hadir', 'sakit', 'izin', 'alpa', 'terlambat'];
	const toUpsert = entries.filter((e) => studentIds.has(e.student_id) && validStatuses.includes(e.status));
	if (!toUpsert.length) return 0;
	const { error } = await sb()
		.from('attendance_subject')
		.upsert(
			toUpsert.map((e) => ({
				student_id: e.student_id,
				subject_id: subjectId,
				class_id: classId,
				tanggal: dateStr,
				jam_ke: jamKe,
				status: e.status,
				keterangan: e.keterangan ?? '',
				dicatat_oleh: user.id,
				updated_at: new Date().toISOString()
			})),
			{ onConflict: 'student_id,subject_id,tanggal,jam_ke' }
		);
	if (error) throw new Error(error.message);
	return toUpsert.length;
}

// ---------------------------------------------------------------- jurnal kelas (jurnal harian guru)

export interface JournalFilter {
	class_id?: number;
	from?: string;
	to?: string;
	user?: User | null;
}

export async function getJournals(filter: JournalFilter = {}): Promise<JournalEntry[]> {
	const allowed = filter.user ? allowedClassIds(filter.user) : null;
	let q = sb()
		.from('class_journals')
		.select(
			'id, class_id, tanggal, subject_id, materi, kegiatan, kendala, catatan, classes!class_journals_class_id_fkey(nama), subjects!class_journals_subject_id_fkey(nama), users!class_journals_dicatat_oleh_fkey(name)'
		);
	if (allowed) q = q.in('class_id', allowed);
	if (filter.class_id) q = q.eq('class_id', filter.class_id);
	if (filter.from) q = q.gte('tanggal', filter.from);
	if (filter.to) q = q.lte('tanggal', filter.to);
	q = q.order('tanggal', { ascending: false }).limit(300);
	const { data } = await q;
	return (data ?? []).map((r: any) => ({
		id: r.id,
		class_id: r.class_id,
		class_name: r.classes?.nama ?? '',
		tanggal: r.tanggal,
		subject_id: r.subject_id,
		subject_name: r.subjects?.nama ?? null,
		materi: r.materi ?? '',
		kegiatan: r.kegiatan ?? '',
		kendala: r.kendala ?? '',
		catatan: r.catatan ?? '',
		dicatat_oleh: r.users?.name ?? null
	})) as JournalEntry[];
}

export async function createJournal(data: {
	class_id: number;
	tanggal: string;
	subject_id: number | null;
	materi: string;
	kegiatan: string;
	kendala: string;
	catatan: string;
	user_id: number;
}): Promise<number> {
	const { data: row, error } = await sb()
		.from('class_journals')
		.insert({
			class_id: data.class_id,
			tanggal: data.tanggal ?? todayStr(),
			subject_id: data.subject_id,
			materi: data.materi,
			kegiatan: data.kegiatan,
			kendala: data.kendala,
			catatan: data.catatan,
			dicatat_oleh: data.user_id
		})
		.select('id')
		.single();
	if (error) throw new Error(error.message);
	return row.id;
}

export async function updateJournal(id: number, data: Partial<Omit<JournalEntry, 'id'>>, user_id: number) {
	const { data: cur } = await sb().from('class_journals').select('*').eq('id', id).limit(1);
	if (!cur || cur.length === 0) throw new Error('Jurnal tidak ditemukan');
	const c: any = cur[0];
	const { error } = await sb()
		.from('class_journals')
		.update({
			class_id: data.class_id ?? c.class_id,
			tanggal: data.tanggal ?? c.tanggal,
			subject_id: data.subject_id !== undefined ? data.subject_id : c.subject_id,
			materi: data.materi ?? c.materi,
			kegiatan: data.kegiatan ?? c.kegiatan,
			kendala: data.kendala ?? c.kendala,
			catatan: data.catatan ?? c.catatan,
			dicatat_oleh: user_id,
			updated_at: new Date().toISOString()
		})
		.eq('id', id);
	if (error) throw new Error(error.message);
}

export async function deleteJournal(id: number) {
	const { error } = await sb().from('class_journals').delete().eq('id', id);
	if (error) throw new Error(error.message);
}

// ---------------------------------------------------------------- kalender akademik

export async function getHolidays(limit = 50): Promise<import('$lib/types').Holiday[]> {
	const { data } = await sb().from('academic_calendar').select('id, tanggal, keterangan, tipe').order('tanggal', { ascending: false }).limit(limit);
	return (data ?? []) as import('$lib/types').Holiday[];
}

export async function getUpcomingHolidays(limit = 5): Promise<import('$lib/types').Holiday[]> {
	const { data } = await sb()
		.from('academic_calendar')
		.select('id, tanggal, keterangan, tipe')
		.gte('tanggal', todayStr())
		.eq('tipe', 'libur')
		.order('tanggal', { ascending: true })
		.limit(limit);
	return (data ?? []) as import('$lib/types').Holiday[];
}

export async function upsertHoliday(data: { tanggal: string; keterangan: string; tipe: string }) {
	const { error } = await sb()
		.from('academic_calendar')
		.upsert({ tanggal: data.tanggal, keterangan: data.keterangan, tipe: data.tipe }, { onConflict: 'tanggal' });
	if (error) throw new Error(error.message);
}

export async function deleteHoliday(id: number) {
	const { error } = await sb().from('academic_calendar').delete().eq('id', id);
	if (error) throw new Error(error.message);
}

// ---------------------------------------------------------------- reports

export async function getReportSummary(opts: { class_id?: number; from: string; to: string; user?: User | null }): Promise<{
	rows: ReportRow[];
	class_name: string | null;
}> {
	const matrix = await getAttendanceMatrix(opts);
	const rows: ReportRow[] = matrix.rows.map((r) => ({
		student_id: r.student_id,
		nisn: r.nisn,
		nis: '',
		nama: r.nama,
		hadir: r.hadir,
		sakit: r.sakit,
		izin: r.izin,
		alpa: r.alpa,
		terlambat: r.terlambat,
		total: r.total,
		persentase: r.total > 0 ? Math.round(((r.total - r.alpa) / r.total) * 1000) / 10 : 0
	}));
	return { rows, class_name: matrix.class_name };
}

export async function getAttendanceMatrix(opts: {
	class_id?: number;
	from: string;
	to: string;
	user?: User | null;
	student_ids?: number[];
}): Promise<MatrixReport> {
	const allowed = opts.user ? allowedClassIds(opts.user) : null;
	let q = sb()
		.from('attendance_daily')
		.select('student_id, tanggal, status, students!attendance_daily_student_id_fkey(id, nisn, nama, class_id, classes!students_class_id_fkey(nama))')
		.gte('tanggal', opts.from)
		.lte('tanggal', opts.to);
	if (allowed) {
		const { data: students } = await sb().from('students').select('id').in('class_id', allowed);
		const ids = (students ?? []).map((s) => s.id);
		if (ids.length) q = q.in('student_id', ids);
	}
	if (opts.class_id) {
		const { data: students } = await sb().from('students').select('id').eq('class_id', opts.class_id);
		const ids = (students ?? []).map((s) => s.id);
		if (ids.length) q = q.in('student_id', ids);
	}
	if (opts.student_ids?.length) {
		q = q.in('student_id', opts.student_ids);
	}
	q = q.order('tanggal', { ascending: true });
	const { data } = await q;
	const attRows = data ?? [];

	const dates = [...new Set(attRows.map((r) => r.tanggal as string))].sort();
	const byStudent = new Map<number, Record<string, AttendanceStatus>>();
	for (const r of attRows) {
		if (!byStudent.has(r.student_id)) byStudent.set(r.student_id, {});
		byStudent.get(r.student_id)![r.tanggal] = r.status as AttendanceStatus;
	}

	const studentFilter: StudentFilter = {};
	if (opts.class_id) studentFilter.class_id = opts.class_id;
	if (allowed) studentFilter.user = opts.user;
	const allStudents = await getStudents({ ...studentFilter, status: 'aktif' });
	const students = opts.student_ids?.length
		? allStudents.filter((s) => opts.student_ids!.includes(s.id))
		: allStudents;

	const rows = students.map((s) => {
		const per_date = byStudent.get(s.id) ?? {};
		const hitung = (st: AttendanceStatus) => Object.values(per_date).filter((v) => v === st).length;
		const hadir = hitung('hadir');
		const sakit = hitung('sakit');
		const izin = hitung('izin');
		const alpa = hitung('alpa');
		const terlambat = hitung('terlambat');
		const total = Object.keys(per_date).length;
		return {
			student_id: s.id,
			class_name: s.class_name,
			nisn: s.nisn,
			nama: s.nama,
			per_date,
			hadir,
			sakit,
			izin,
			alpa,
			terlambat,
			total,
			persentase: total > 0 ? Math.round(((total - alpa) / total) * 1000) / 10 : 0
		};
	});

	const perDateStats: Record<string, { hadir: number; sakit: number; izin: number; alpa: number; terlambat: number; total: number; persentase: number }> = {};
	for (const r of attRows) {
		const st = perDateStats[r.tanggal] ?? { hadir: 0, sakit: 0, izin: 0, alpa: 0, terlambat: 0, total: 0, persentase: 0 };
		st[r.status as AttendanceStatus]++;
		st.total++;
		perDateStats[r.tanggal] = st;
	}
	for (const d of dates) {
		const st = perDateStats[d];
		if (st) st.persentase = st.total > 0 ? Math.round((st.hadir / st.total) * 1000) / 10 : 0;
	}

	const className = opts.class_id ? ((await getClass(opts.class_id))?.nama ?? null) : null;
	return { dates, rows, per_date: perDateStats, class_name: className };
}

/** Matriks absensi per mata pelajaran: baris = siswa, kolom = Jam 1 s/d 8 (dari attendance_subject). */
export async function getSubjectAttendanceMatrix(opts: {
	class_id?: number;
	subject_id?: number;
	from: string;
	to: string;
	user?: User | null;
}): Promise<MatrixReport> {
	const allowed = opts.user ? allowedClassIds(opts.user) : null;
	let q = sb()
		.from('attendance_subject')
		.select('student_id, tanggal, jam_ke, status')
		.gte('tanggal', opts.from)
		.lte('tanggal', opts.to);
	if (opts.subject_id) q = q.eq('subject_id', opts.subject_id);
	if (opts.class_id) q = q.eq('class_id', opts.class_id);
	if (allowed) q = q.in('class_id', allowed);
	q = q.order('tanggal', { ascending: true });
	const { data } = await q;
	const attRows = data ?? [];

	// Kolom tetap Jam 1..8; status tiap jam = catatan terbaru pada jam tersebut dalam periode
	const dates = ['1', '2', '3', '4', '5', '6', '7', '8'];
	const byStudent = new Map<number, Record<string, AttendanceStatus>>();
	for (const r of attRows) {
		const j = Number(r.jam_ke);
		if (!Number.isInteger(j) || j < 1 || j > 8) continue;
		const jam = String(j);
		if (!byStudent.has(r.student_id)) byStudent.set(r.student_id, {});
		byStudent.get(r.student_id)![jam] = r.status as AttendanceStatus;
	}

	const studentFilter: StudentFilter = {};
	if (opts.class_id) studentFilter.class_id = opts.class_id;
	if (allowed) studentFilter.user = opts.user;
	const students = await getStudents({ ...studentFilter, status: 'aktif' });

	const rows = students.map((s) => {
		const per_date = byStudent.get(s.id) ?? {};
		const hitung = (st: AttendanceStatus) => Object.values(per_date).filter((v) => v === st).length;
		const hadir = hitung('hadir');
		const sakit = hitung('sakit');
		const izin = hitung('izin');
		const alpa = hitung('alpa');
		const terlambat = hitung('terlambat');
		const total = Object.keys(per_date).length;
		return {
			student_id: s.id,
			class_name: s.class_name,
			nisn: s.nisn,
			nama: s.nama,
			per_date,
			hadir,
			sakit,
			izin,
			alpa,
			terlambat,
			total,
			persentase: total > 0 ? Math.round(((total - alpa) / total) * 1000) / 10 : 0
		};
	});	const perDateStats: Record<string, { hadir: number; sakit: number; izin: number; alpa: number; terlambat: number; total: number; persentase: number }> = {};
	for (const r of attRows) {
		const j = Number(r.jam_ke);
		if (!Number.isInteger(j) || j < 1 || j > 8) continue;
		const jam = String(j);
		const st = perDateStats[jam] ?? { hadir: 0, sakit: 0, izin: 0, alpa: 0, terlambat: 0, total: 0, persentase: 0 };
		st[r.status as AttendanceStatus]++;
		st.total++;
		perDateStats[jam] = st;
	}
	for (const d of dates) {
		const st = perDateStats[d];
		if (st) st.persentase = st.total > 0 ? Math.round((st.hadir / st.total) * 1000) / 10 : 0;
	}


	const className = opts.class_id ? ((await getClass(opts.class_id))?.nama ?? null) : null;
	let subjectName: string | null = null;
	if (opts.subject_id) {
		const { data: subj } = await sb().from('subjects').select('nama').eq('id', opts.subject_id).limit(1);
		subjectName = subj && subj[0] ? (subj[0].nama as string) : null;
	}
	return { dates, rows, per_date: perDateStats, class_name: className, subject_name: subjectName };
}

// ---------------------------------------------------------------- tahun ajaran & semester

export async function getAcademicPeriods(): Promise<import('$lib/types').AcademicPeriod[]> {
	const { data } = await sb()
		.from('academic_periods')
		.select('id, tahun_ajaran, semester, aktif')
		.order('tahun_ajaran', { ascending: false })
		.order('semester', { ascending: false });
	return (data ?? []).map((r: any) => ({ id: r.id, tahun_ajaran: r.tahun_ajaran, semester: r.semester, aktif: !!r.aktif }));
}

export async function addAcademicPeriod(tahun_ajaran: string, semester: string) {
	const { error } = await sb()
		.from('academic_periods')
		.upsert({ tahun_ajaran, semester, aktif: false }, { onConflict: 'tahun_ajaran,semester' });
	if (error) throw new Error(error.message);
}

export async function setActivePeriod(tahun_ajaran: string, semester: string) {
	await sb().from('academic_periods').update({ aktif: false }).neq('id', 0);
	await sb()
		.from('academic_periods')
		.update({ aktif: true })
		.eq('tahun_ajaran', tahun_ajaran)
		.eq('semester', semester);
	await sb().from('schools').update({ tahun_ajaran_aktif: tahun_ajaran, semester_aktif: semester }).eq('id', 1);
}

export async function getAlerts(): Promise<AlertItem[]> {
	const threshold = Number(await getSetting('alpa_threshold', '3')) || 3;
	const year = new Date().getFullYear();
	const { data } = await sb()
		.from('attendance_daily')
		.select('student_id, students!attendance_daily_student_id_fkey(nama, nisn, status, classes!students_class_id_fkey(nama))')
		.eq('status', 'alpa')
		.gte('tanggal', `${year}-01-01`);
	const counts = new Map<number, { nama: string; nisn: string; class_name: string; count: number }>();
	for (const r of data ?? []) {
		const s: any = r.students;
		if (!s || s.status !== 'aktif') continue;
		const cur = counts.get(r.student_id) ?? { nama: s.nama, nisn: s.nisn, class_name: s.classes?.nama ?? '', count: 0 };
		cur.count++;
		counts.set(r.student_id, cur);
	}
	return [...counts.entries()]
		.filter(([, v]) => v.count >= threshold)
		.map(([student_id, v]) => ({
			student_id,
			nama: v.nama,
			nisn: v.nisn,
			class_name: v.class_name,
			alpa_count: v.count,
			threshold
		}))
		.sort((a, b) => b.alpa_count - a.alpa_count);
}

export async function getDashboard(user: User): Promise<DashboardSummary> {
	const tanggal = todayStr();

	// 1. Eksekusi query data dasar secara paralel
	const [
		holiday,
		classes,
		allActiveStudents,
		alerts,
		holidays
	] = await Promise.all([
		isHoliday(tanggal),
		getClasses(user),
		getStudents({ user, status: 'aktif' }),
		user.role === 'guru_mapel' ? Promise.resolve([]) : getAlerts(),
		getUpcomingHolidays(5)
	]);

	const classIds = classes.map((c) => c.id);

	// Siapkan tanggal-tanggal hari efektif untuk tren 7 hari (maksimal 10 hari mundur)
	const candidateDates: string[] = [];
	for (let i = 10; i >= 0; i--) {
		const d = addDays(tanggal, -i);
		if (d > tanggal) continue;
		const dow = new Date(`${d}T00:00:00`).getDay();
		if (dow === 0 || dow === 6) continue;
		candidateDates.push(d);
	}

	const monthStart = `${tanggal.slice(0, 7)}-01`;
	const minDate = candidateDates.length ? candidateDates[0] : tanggal;
	const queryStartDate = minDate < monthStart ? minDate : monthStart;

	// 2. Satu query batch absensi untuk seluruh kebutuhan dashboard (hari ini, bulan ini, & tren 7 hari)
	let attQuery = sb()
		.from('attendance_daily')
		.select('student_id, tanggal, status, keterangan, students!attendance_daily_student_id_fkey(class_id)')
		.gte('tanggal', queryStartDate)
		.lte('tanggal', tanggal);

	if (classIds.length) {
		const activeStudentIds = allActiveStudents.map((s) => s.id);
		if (activeStudentIds.length) {
			attQuery = attQuery.in('student_id', activeStudentIds);
		}
	}

	// Parallel fetch batch absensi & kalender libur
	const [
		{ data: allAttRows },
		{ data: holidayRows }
	] = await Promise.all([
		attQuery,
		sb().from('academic_calendar').select('tanggal, tipe').in('tanggal', candidateDates).eq('tipe', 'libur')
	]);

	const holidayDateSet = new Set((holidayRows ?? []).map((h: any) => h.tanggal));
	const attRows = allAttRows ?? [];

	// Indexing data absensi di memori: [tanggal][student_id]
	const attByDateAndStudent = new Map<string, Map<number, { status: AttendanceStatus; keterangan: string }>>();
	for (const r of attRows) {
		let dateMap = attByDateAndStudent.get(r.tanggal);
		if (!dateMap) {
			dateMap = new Map();
			attByDateAndStudent.set(r.tanggal, dateMap);
		}
		dateMap.set(r.student_id, { status: r.status as AttendanceStatus, keterangan: r.keterangan ?? '' });
	}

	// 3. Hitung ringkasan hari ini per kelas & total
	const todayMap = attByDateAndStudent.get(tanggal) ?? new Map();
	const counts: Record<string, number> = { hadir: 0, sakit: 0, izin: 0, alpa: 0, terlambat: 0 };
	let dicatat = 0;

	const studentsByClass = new Map<number, Student[]>();
	for (const s of allActiveStudents) {
		let list = studentsByClass.get(s.class_id);
		if (!list) {
			list = [];
			studentsByClass.set(s.class_id, list);
		}
		list.push(s);
	}

	const perKelas = classes.map((c) => {
		const classStudents = studentsByClass.get(c.id) ?? [];
		const k = { class_id: c.id, class_name: c.nama, hadir: 0, sakit: 0, izin: 0, alpa: 0, terlambat: 0, belum_dicatat: 0, total: 0 };
		for (const s of classStudents) {
			const rec = todayMap.get(s.id);
			k.total++;
			if (rec) {
				k[rec.status as keyof typeof k]++;
				counts[rec.status as keyof typeof counts]++;
				dicatat++;
			} else {
				k.belum_dicatat++;
			}
		}
		return k;
	});

	const totalSiswa = allActiveStudents.length;

	// 4. Hitung statistik bulan berjalan
	const bulanIni = { hadir: 0, sakit: 0, izin: 0, alpa: 0, terlambat: 0, total: 0 };
	const perKelasMonth = new Map<number, { hadir: number; sakit: number; izin: number; alpa: number; terlambat: number; total: number }>();

	for (const r of attRows) {
		if (r.tanggal < monthStart) continue;
		if (r.status in bulanIni) bulanIni[r.status as keyof typeof bulanIni]++;
		bulanIni.total++;
		const stu: any = Array.isArray(r.students) ? r.students[0] : r.students;
		const cid = stu?.class_id as number | undefined;
		if (cid == null) continue;
		const k = perKelasMonth.get(cid) ?? { hadir: 0, sakit: 0, izin: 0, alpa: 0, terlambat: 0, total: 0 };
		if (r.status in k) k[r.status as keyof typeof k]++;
		k.total++;
		perKelasMonth.set(cid, k);
	}

	const bulanIniPerKelas = classes.map((c) => {
		const k = perKelasMonth.get(c.id) ?? { hadir: 0, sakit: 0, izin: 0, alpa: 0, terlambat: 0, total: 0 };
		return { class_id: c.id, class_name: c.nama, ...k };
	});

	// 5. Hitung tren 7 hari
	const trend: { tanggal: string; hadir: number; sakit: number; izin: number; alpa: number; terlambat: number; total: number }[] = [];
	for (const d of candidateDates) {
		if (holidayDateSet.has(d)) continue;
		const t = { tanggal: d, hadir: 0, sakit: 0, izin: 0, alpa: 0, terlambat: 0, total: 0 };
		const dateMap = attByDateAndStudent.get(d);
		if (dateMap) {
			for (const s of allActiveStudents) {
				const rec = dateMap.get(s.id);
				if (rec) {
					t[rec.status as keyof typeof t]++;
					t.total++;
				}
			}
		}
		trend.push(t);
		if (trend.length === 7) break;
	}

	// 6. Daftar siswa tidak hadir hari ini
	const hariIniAbsen: { student_id: number; nama: string; class_name: string; status: AttendanceStatus; keterangan: string }[] = [];
	for (const s of allActiveStudents) {
		const rec = todayMap.get(s.id);
		if (rec && rec.status !== 'hadir') {
			hariIniAbsen.push({
				student_id: s.id,
				nama: s.nama,
				class_name: s.class_name,
				status: rec.status,
				keterangan: rec.keterangan ?? ''
			});
		}
	}

	return {
		tanggal,
		libur: holiday.libur,
		keterangan_libur: holiday.keterangan,
		hadir: counts.hadir,
		sakit: counts.sakit,
		izin: counts.izin,
		alpa: counts.alpa,
		terlambat: counts.terlambat,
		belum_dicatat: totalSiswa - dicatat,
		total_siswa: totalSiswa,
		bulan_ini: bulanIni,
		bulan_ini_per_kelas: bulanIniPerKelas,
		per_kelas: perKelas,
		alerts,
		trend,
		hariIniAbsen,
		holidays
	};
}
