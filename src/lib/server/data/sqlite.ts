import { db } from '../db';
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

// ================================================================ AUTH STORE
// Primitif akses tabel users/sessions — dipakai auth.ts (mode lokal maupun Supabase).

function userRowToUser(row: any): (User & { password_hash: string | null }) | null {
	if (!row) return null;
	return {
		id: row.id,
		username: row.username ?? null,
		email: row.email,
		// Nama diambil langsung dari tabel guru (sumber data real)
		name: row.teacher_nama ?? row.name,
		role: row.role,
		teacher_id: row.teacher_id,
		class_id: row.class_id,
		class_name: row.class_name ?? null,
		foto_url: row.foto_url ?? '',
		password_hash: row.password_hash ?? null
	};
}

export function authFindUserByEmail(email: string): (User & { password_hash: string | null }) | null {
	const row = db
		.prepare(
			`SELECT u.id, u.username, u.email, u.name, u.role, u.teacher_id, u.class_id, u.foto_url, u.password_hash,
              c.nama AS class_name, t.nama AS teacher_nama
       FROM users u LEFT JOIN classes c ON c.id = u.class_id LEFT JOIN teachers t ON t.id = u.teacher_id WHERE lower(u.email) = lower(?)`
		)
		.get(email) as any;
	return userRowToUser(row);
}

/** Cari pengguna berdasarkan username ATAU email (untuk login). */
export function authFindUserByIdentifier(identifier: string): (User & { password_hash: string | null }) | null {
	const row = db
		.prepare(
			`SELECT u.id, u.username, u.email, u.name, u.role, u.teacher_id, u.class_id, u.foto_url, u.password_hash,
              c.nama AS class_name, t.nama AS teacher_nama
       FROM users u LEFT JOIN classes c ON c.id = u.class_id LEFT JOIN teachers t ON t.id = u.teacher_id
       WHERE lower(u.email) = lower(?) OR lower(u.username) = lower(?)`
		)
		.get(identifier, identifier) as any;
	return userRowToUser(row);
}

export function authGetUserById(userId: number): User | null {
	const row = db
		.prepare(
			`SELECT u.id, u.username, u.email, u.name, u.role, u.teacher_id, u.class_id, u.foto_url, c.nama AS class_name, t.nama AS teacher_nama
       FROM users u LEFT JOIN classes c ON c.id = u.class_id LEFT JOIN teachers t ON t.id = u.teacher_id WHERE u.id = ?`
		)
		.get(userId) as any;
	const u = userRowToUser(row);
	if (!u) return null;
	const { password_hash: _ph, ...rest } = u;
	return rest as User;
}

export function authGetSession(token: string): { user_id: number; expires_at: string } | null {
	const row = db.prepare('SELECT user_id, expires_at FROM sessions WHERE token = ?').get(token) as any;
	return row ?? null;
}

export function authCreateSession(token: string, userId: number, expiresAt: string) {
	db.prepare('INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)').run(token, userId, expiresAt);
}

export function authDeleteSession(token: string) {
	db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
}

/** Mode Supabase: sinkronkan baris users dari akun Supabase Auth (no-op di lokal). */
export function authUpsertByAuthId(_authId: string, _email: string, _name: string, _role: string, _teacherId: number | null, _classId: number | null): number | null {
	return null;
}

/** Mode lokal: simpan hash password (no-op di Supabase, password dikelola Supabase Auth). */
export function authUpdatePasswordHash(userId: number, hash: string) {
	db.prepare('UPDATE users SET password_hash=? WHERE id=?').run(hash, userId);
}

/** auth_id tidak dipakai di mode lokal. */
export function authGetAuthId(_userId: number): string | null {
	return null;
}

// ---------------------------------------------------------------- kelola akun guru

export function findUserByTeacherId(teacherId: number): (User & { password_hash: string | null }) | null {
	const row = db
		.prepare(
			`SELECT u.id, u.username, u.email, u.name, u.role, u.teacher_id, u.class_id, u.foto_url, u.password_hash,
              c.nama AS class_name, t.nama AS teacher_nama
       FROM users u LEFT JOIN classes c ON c.id = u.class_id LEFT JOIN teachers t ON t.id = u.teacher_id WHERE u.teacher_id = ?`
		)
		.get(teacherId) as any;
	return userRowToUser(row);
}

export function createUserAccount(data: {
	username: string;
	email: string;
	password_hash: string | null;
	name: string;
	role: string;
	teacher_id: number;
	class_id: number | null;
}): number {
	const res = db
		.prepare('INSERT INTO users (username, email, password_hash, name, role, teacher_id, class_id) VALUES (?,?,?,?,?,?,?)')
		.run(data.username, data.email, data.password_hash, data.name, data.role, data.teacher_id, data.class_id);
	return Number(res.lastInsertRowid);
}

export function updateUserAccount(
	userId: number,
	data: { username?: string; email?: string; role?: string; password_hash?: string | null }
) {
	const cur = db.prepare('SELECT username, email, role, password_hash FROM users WHERE id=?').get(userId) as any;
	db.prepare('UPDATE users SET username=?, email=?, role=?, password_hash=? WHERE id=?').run(
		data.username ?? cur?.username ?? null,
		data.email ?? cur?.email ?? '',
		data.role ?? cur?.role ?? 'guru_mapel',
		data.password_hash !== undefined ? data.password_hash : cur?.password_hash ?? null,
		userId
	);
}

export function authSetProfile(userId: number, name: string, fotoUrl: string) {
	db.prepare('UPDATE users SET name=?, foto_url=? WHERE id=?').run(name, fotoUrl, userId);
}

// ---------------------------------------------------------------- school

export function getSchool(): School {
	const row = db
		.prepare(
			`SELECT s.*, COALESCE((SELECT value FROM settings WHERE key='alpa_threshold'), '3') AS alpa_threshold
       FROM schools s WHERE id = 1`
		)
		.get() as any;
	return row as School;
}

export function updateSchool(data: Partial<School>) {
	const school = getSchool();
	db.prepare(
		`UPDATE schools SET nama=?, npsn=?, alamat=?, logo_url=?, kepala_sekolah=?, tahun_ajaran_aktif=?, semester_aktif=? WHERE id=1`
	).run(
		data.nama ?? school.nama,
		data.npsn ?? school.npsn,
		data.alamat ?? school.alamat,
		data.logo_url ?? school.logo_url,
		data.kepala_sekolah ?? school.kepala_sekolah,
		data.tahun_ajaran_aktif ?? school.tahun_ajaran_aktif,
		data.semester_aktif ?? school.semester_aktif
	);
	if (data.alpa_threshold !== undefined) {
		db.prepare(`INSERT INTO settings (key, value) VALUES ('alpa_threshold', ?)
      ON CONFLICT(key) DO UPDATE SET value=excluded.value`).run(String(data.alpa_threshold));
	}
}

export function getSetting(key: string, def = ''): string {
	const row = db.prepare('SELECT value FROM settings WHERE key=?').get(key) as any;
	return row ? row.value : def;
}

// ---------------------------------------------------------------- classes

export function getClasses(user: User | null = null): ClassRow[] {
	const allowed = user ? allowedClassIds(user) : null;
	let rows: any[];
	if (allowed) {
		const placeholders = allowed.map(() => '?').join(',');
		rows = db
			.prepare(
				`SELECT c.id, c.nama, c.tingkat, c.tahun_ajaran, c.wali_kelas_id, t.nama AS wali_kelas_nama,
                (SELECT COUNT(*) FROM students s WHERE s.class_id = c.id AND s.status='aktif') AS jumlah_siswa
         FROM classes c LEFT JOIN teachers t ON t.id = c.wali_kelas_id
         WHERE c.id IN (${placeholders}) ORDER BY c.tingkat, c.nama`
			)
			.all(...allowed) as any[];
	} else {
		rows = db
			.prepare(
				`SELECT c.id, c.nama, c.tingkat, c.tahun_ajaran, c.wali_kelas_id, t.nama AS wali_kelas_nama,
                (SELECT COUNT(*) FROM students s WHERE s.class_id = c.id AND s.status='aktif') AS jumlah_siswa
         FROM classes c LEFT JOIN teachers t ON t.id = c.wali_kelas_id
         ORDER BY c.tingkat, c.nama`
			)
			.all() as any[];
	}
	return rows as ClassRow[];
}

export function getClass(id: number): ClassRow | null {
	const row = db
		.prepare(
			`SELECT c.id, c.nama, c.tingkat, c.tahun_ajaran, c.wali_kelas_id, t.nama AS wali_kelas_nama,
              (SELECT COUNT(*) FROM students s WHERE s.class_id = c.id AND s.status='aktif') AS jumlah_siswa
       FROM classes c LEFT JOIN teachers t ON t.id = c.wali_kelas_id WHERE c.id=?`
		)
		.get(id) as any;
	return (row as ClassRow) ?? null;
}

/** Sinkronkan role akun & jabatan guru dengan status wali kelas: jadi wali_kelas bila
 *  masih ditunjuk di kelas mana pun, kembali ke guru_mapel bila tidak. Jabatan
 *  admin/kepala_sekolah tidak ditimpa saat guru dilepas dari wali kelas. */
export function syncWaliKelasRole(teacherId: number | null) {
	if (!teacherId) return;
	const row = db.prepare('SELECT COUNT(*) AS n FROM classes WHERE wali_kelas_id=?').get(teacherId) as any;
	const isWali = (row?.n ?? 0) > 0;
	const cur = db.prepare('SELECT jabatan FROM teachers WHERE id=?').get(teacherId) as any;
	if (!cur) return;
	let jabatan = cur.jabatan;
	if (isWali) jabatan = 'wali_kelas';
	else if (cur.jabatan === 'wali_kelas') jabatan = 'guru_mapel';
	// Jabatan di tabel guru ikut disinkronkan (tampil di halaman Data Guru)
	if (jabatan !== cur.jabatan) {
		db.prepare('UPDATE teachers SET jabatan=? WHERE id=?').run(jabatan, teacherId);
	}
	db.prepare('UPDATE users SET role=? WHERE teacher_id=?').run(jabatan, teacherId);
}

export function createClass(data: { nama: string; tingkat: number; tahun_ajaran: string; wali_kelas_id: number | null }) {
	const school = getSchool();
	const res = db
		.prepare('INSERT INTO classes (school_id, nama, tingkat, tahun_ajaran, wali_kelas_id) VALUES (?,?,?,?,?)')
		.run(school.id, data.nama, data.tingkat, data.tahun_ajaran, data.wali_kelas_id);
	syncWaliKelasRole(data.wali_kelas_id);
	return res;
}

export function updateClass(id: number, data: Partial<ClassRow>) {
	const cur = getClass(id);
	db.prepare('UPDATE classes SET nama=?, tingkat=?, tahun_ajaran=?, wali_kelas_id=? WHERE id=?').run(
		data.nama ?? cur?.nama,
		data.tingkat ?? cur?.tingkat,
		data.tahun_ajaran ?? cur?.tahun_ajaran,
		data.wali_kelas_id !== undefined ? data.wali_kelas_id : cur?.wali_kelas_id ?? null,
		id
	);
	// Role guru lama & baru disinkronkan setelah kelas tersimpan
	if (data.wali_kelas_id !== undefined && data.wali_kelas_id !== cur?.wali_kelas_id) {
		syncWaliKelasRole(cur?.wali_kelas_id ?? null);
		syncWaliKelasRole(data.wali_kelas_id);
	}
}

export function deleteClass(id: number) {
	const cur = getClass(id);
	db.prepare('DELETE FROM classes WHERE id=?').run(id);
	syncWaliKelasRole(cur?.wali_kelas_id ?? null);
}

// ---------------------------------------------------------------- teachers

export function getTeachers(): Teacher[] {
	return db
		.prepare(
			`SELECT t.id, t.kode, t.nip, t.nuptk, t.nama, t.jabatan, t.kontak,
              u.id AS user_id, u.username, u.email AS user_email, u.role AS user_role, u.foto_url
       FROM teachers t LEFT JOIN users u ON u.teacher_id = t.id ORDER BY t.nama`
		)
		.all() as Teacher[];
}

export function createTeacher(data: Omit<Teacher, 'id'>) {
	const school = getSchool();
	return db
		.prepare('INSERT INTO teachers (school_id, kode, nip, nuptk, nama, jabatan, kontak) VALUES (?,?,?,?,?,?,?)')
		.run(school.id, data.kode ?? '', data.nip ?? '', data.nuptk ?? '', data.nama, data.jabatan ?? 'guru_mapel', data.kontak ?? '');
}

export function updateTeacher(id: number, data: Partial<Teacher>) {
	const cur = db.prepare('SELECT * FROM teachers WHERE id=?').get(id) as any;
	if (!cur) throw new Error('Guru tidak ditemukan');
	db.prepare('UPDATE teachers SET kode=?, nip=?, nuptk=?, nama=?, jabatan=?, kontak=? WHERE id=?').run(
		data.kode ?? cur.kode ?? '',
		data.nip ?? cur.nip,
		data.nuptk ?? cur.nuptk,
		data.nama ?? cur.nama,
		data.jabatan ?? cur.jabatan,
		data.kontak ?? cur.kontak,
		id
	);

	// Nama & jabatan di halaman Data Guru ikut disinkronkan ke akun login
	if (data.nama) {
		db.prepare('UPDATE users SET name=? WHERE teacher_id=?').run(data.nama, id);
	}
	if (data.jabatan) {
		db.prepare('UPDATE users SET role=? WHERE teacher_id=?').run(data.jabatan, id);
	}
}

export function deleteTeacher(id: number) {
	db.prepare('UPDATE classes SET wali_kelas_id=NULL WHERE wali_kelas_id=?').run(id);
	db.prepare('UPDATE subjects SET teacher_id=NULL WHERE teacher_id=?').run(id);

	// Hapus akun user yang terhubung beserta referensinya (agar tidak kena FK constraint)
	const accounts = db.prepare('SELECT id FROM users WHERE teacher_id=?').all(id) as { id: number }[];
	for (const u of accounts) {
		db.prepare('UPDATE attendance_daily SET dicatat_oleh=NULL WHERE dicatat_oleh=?').run(u.id);
		db.prepare('UPDATE attendance_subject SET dicatat_oleh=NULL WHERE dicatat_oleh=?').run(u.id);
		db.prepare('UPDATE class_journals SET dicatat_oleh=NULL WHERE dicatat_oleh=?').run(u.id);
		db.prepare('UPDATE attendance_logs SET user_id=NULL WHERE user_id=?').run(u.id);
		db.prepare('DELETE FROM users WHERE id=?').run(u.id);
	}
	db.prepare('DELETE FROM teachers WHERE id=?').run(id);
}

// ---------------------------------------------------------------- subjects

export function getSubjects(): Subject[] {
	const rows = db
		.prepare(
			`SELECT s.id, s.kode, s.nama, s.teacher_id, t.nama AS teacher_nama
       FROM subjects s LEFT JOIN teachers t ON t.id = s.teacher_id ORDER BY s.nama`
		)
		.all() as any[];
	const classRows = db
		.prepare(
			`SELECT sc.subject_id, c.id, c.nama FROM subject_classes sc
       JOIN classes c ON c.id = sc.class_id ORDER BY c.tingkat, c.nama`
		)
		.all() as any[];
	const bySubject = new Map<number, { id: number; nama: string }[]>();
	for (const r of classRows) {
		if (!bySubject.has(r.subject_id)) bySubject.set(r.subject_id, []);
		bySubject.get(r.subject_id)!.push({ id: r.id, nama: r.nama });
	}
	return rows.map((r) => ({ ...r, classes: bySubject.get(r.id) ?? [] })) as Subject[];
}

export function getTeacherSubjects(teacherId: number): Subject[] {
	const rows = db
		.prepare(
			`SELECT s.id, s.kode, s.nama, s.teacher_id, t.nama AS teacher_nama
       FROM subjects s LEFT JOIN teachers t ON t.id = s.teacher_id
       WHERE s.teacher_id = ? ORDER BY s.nama`
		)
		.all(teacherId) as any[];
	return rows.map((r) => ({ ...r, classes: [] })) as Subject[];
}

/** Kelas yang diajar oleh seorang guru (melalui mapel yang diampu). */
export function getClassesForTeacher(teacherId: number): ClassRow[] {
	return db
		.prepare(
			`SELECT DISTINCT c.id, c.nama, c.tingkat, c.tahun_ajaran, c.wali_kelas_id, t.nama AS wali_kelas_nama,
                (SELECT COUNT(*) FROM students s WHERE s.class_id = c.id AND s.status='aktif') AS jumlah_siswa
       FROM subjects s
       JOIN subject_classes sc ON sc.subject_id = s.id
       JOIN classes c ON c.id = sc.class_id
       LEFT JOIN teachers t ON t.id = c.wali_kelas_id
       WHERE s.teacher_id = ? ORDER BY c.tingkat, c.nama`
		)
		.all(teacherId) as ClassRow[];
}

/** Mapel yang diajarkan di sebuah kelas. */
export function getSubjectsForClass(classId: number): Subject[] {
	const rows = db
		.prepare(
			`SELECT s.id, s.kode, s.nama, s.teacher_id, t.nama AS teacher_nama
       FROM subject_classes sc
       JOIN subjects s ON s.id = sc.subject_id
       LEFT JOIN teachers t ON t.id = s.teacher_id
       WHERE sc.class_id = ? ORDER BY s.nama`
		)
		.all(classId) as any[];
	return rows.map((r) => ({ ...r, classes: [] })) as Subject[];
}

export function createSubject(data: { kode: string; nama: string; teacher_id: number | null; class_ids: number[] }) {
	const tx = db.transaction(() => {
		const res = db
			.prepare('INSERT INTO subjects (kode, nama, teacher_id) VALUES (?,?,?)')
			.run(data.kode ?? '', data.nama, data.teacher_id);
		const id = Number(res.lastInsertRowid);
		const ins = db.prepare('INSERT INTO subject_classes (subject_id, class_id) VALUES (?,?)');
		for (const cid of data.class_ids ?? []) ins.run(id, cid);
		return id;
	});
	return tx();
}

export function updateSubject(id: number, data: Partial<Subject>) {
	const cur = db.prepare('SELECT * FROM subjects WHERE id=?').get(id) as any;
	if (!cur) throw new Error('Mata pelajaran tidak ditemukan');
	const tx = db.transaction(() => {
		db.prepare('UPDATE subjects SET kode=?, nama=?, teacher_id=? WHERE id=?').run(
			data.kode ?? cur.kode,
			data.nama ?? cur.nama,
			data.teacher_id !== undefined ? data.teacher_id : cur.teacher_id,
			id
		);
		if (data.classes) {
			db.prepare('DELETE FROM subject_classes WHERE subject_id=?').run(id);
			const ins = db.prepare('INSERT INTO subject_classes (subject_id, class_id) VALUES (?,?)');
			for (const c of data.classes) ins.run(id, c.id);
		}
	});
	tx();
}

export function deleteSubject(id: number) {
	db.prepare('DELETE FROM subjects WHERE id=?').run(id);
}

// ---------------------------------------------------------------- students

export interface StudentFilter {
	class_id?: number;
	q?: string;
	status?: StudentStatus;
	user?: User | null;
}

export function getStudents(filter: StudentFilter = {}): Student[] {
	const conds: string[] = [];
	const params: any[] = [];
	const allowed = filter.user ? allowedClassIds(filter.user) : null;
	if (allowed) {
		conds.push(`s.class_id IN (${allowed.map(() => '?').join(',')})`);
		params.push(...allowed);
	}
	if (filter.class_id) {
		conds.push('s.class_id = ?');
		params.push(filter.class_id);
	}
	if (filter.q) {
		conds.push('(s.nama LIKE ? OR s.nisn LIKE ? OR s.nis LIKE ?)');
		params.push(`%${filter.q}%`, `%${filter.q}%`, `%${filter.q}%`);
	}
	if (filter.status) {
		conds.push('s.status = ?');
		params.push(filter.status);
	}
	const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
	return db
		.prepare(
			`SELECT s.id, s.class_id, c.nama AS class_name, s.nisn, s.nis, s.nama, s.jenis_kelamin,
              s.tempat_lahir, s.tanggal_lahir, s.alamat, s.no_hp_ortu, s.foto_url, s.status
       FROM students s JOIN classes c ON c.id = s.class_id ${where}
       ORDER BY c.tingkat, c.nama, s.nama`
		)
		.all(...params) as Student[];
}

export function getStudent(id: number): Student | null {
	const row = db
		.prepare(
			`SELECT s.id, s.class_id, c.nama AS class_name, s.nisn, s.nis, s.nama, s.jenis_kelamin,
              s.tempat_lahir, s.tanggal_lahir, s.alamat, s.no_hp_ortu, s.foto_url, s.status
       FROM students s JOIN classes c ON c.id = s.class_id WHERE s.id=?`
		)
		.get(id) as any;
	return (row as Student) ?? null;
}

export function createStudent(data: Partial<Student>) {
	return db
		.prepare(
			`INSERT INTO students (class_id, nisn, nis, nama, jenis_kelamin, tempat_lahir, tanggal_lahir, alamat, no_hp_ortu, foto_url, status)
       VALUES (?,?,?,?,?,?,?,?,?,?,?)`
		)
		.run(
			data.class_id,
			data.nisn ?? '',
			data.nis ?? '',
			data.nama,
			data.jenis_kelamin ?? 'L',
			data.tempat_lahir ?? '',
			data.tanggal_lahir ?? '',
			data.alamat ?? '',
			data.no_hp_ortu ?? '',
			data.foto_url ?? '',
			data.status ?? 'aktif'
		);
}

export function updateStudent(id: number, data: Partial<Student>) {
	const cur = getStudent(id);
	if (!cur) throw new Error('Siswa tidak ditemukan');
	db.prepare(
		`UPDATE students SET class_id=?, nisn=?, nis=?, nama=?, jenis_kelamin=?, tempat_lahir=?,
        tanggal_lahir=?, alamat=?, no_hp_ortu=?, foto_url=?, status=? WHERE id=?`
	).run(
		data.class_id ?? cur.class_id,
		data.nisn ?? cur.nisn,
		data.nis ?? cur.nis,
		data.nama ?? cur.nama,
		data.jenis_kelamin ?? cur.jenis_kelamin,
		data.tempat_lahir ?? cur.tempat_lahir,
		data.tanggal_lahir ?? cur.tanggal_lahir,
		data.alamat ?? cur.alamat,
		data.no_hp_ortu ?? cur.no_hp_ortu,
		data.foto_url ?? cur.foto_url,
		data.status ?? cur.status,
		id
	);
}

export function deleteStudent(id: number) {
	db.prepare('DELETE FROM students WHERE id=?').run(id);
}

export function importStudents(class_id: number, rows: any[]): { inserted: number; skipped: number } {
	const existing = new Set(
		(db.prepare('SELECT nisn FROM students WHERE class_id=?').all(class_id) as any[]).map((r) => r.nisn)
	);
	const ins = db.prepare(
		`INSERT INTO students (class_id, nisn, nis, nama, jenis_kelamin, tempat_lahir, tanggal_lahir, alamat, no_hp_ortu, status)
     VALUES (?,?,?,?,?,?,?,?,?,?)`
	);
	const tx = db.transaction(() => {
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
			ins.run(
				class_id,
				nisn,
				String(r.nis ?? '').trim(),
				nama,
				String(r.jenis_kelamin ?? 'L').trim().toUpperCase() === 'P' ? 'P' : 'L',
				String(r.tempat_lahir ?? '').trim(),
				normalizeDate(String(r.tanggal_lahir ?? '').trim()),
				String(r.alamat ?? '').trim(),
				String(r.no_hp_ortu ?? '').trim(),
				status
			);
			if (nisn) existing.add(nisn);
			inserted++;
		}
		return { inserted, skipped };
	});
	return tx();
}

function normalizeDate(v: string): string {
	if (!v) return '';
	// d/m/yyyy atau d-m-yyyy (format Excel Indonesia) → yyyy-mm-dd
	const m = v.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
	if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
	const iso = v.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
	if (iso) return `${iso[1]}-${iso[2].padStart(2, '0')}-${iso[3].padStart(2, '0')}`;
	return v;
}

// ---------------------------------------------------------------- attendance

export function isHoliday(dateStr: string): { libur: boolean; keterangan: string | null } {
	const row = db.prepare('SELECT keterangan, tipe FROM academic_calendar WHERE tanggal=?').get(dateStr) as any;
	if (row) return { libur: row.tipe === 'libur', keterangan: row.keterangan };
	return { libur: false, keterangan: null };
}

export function getAttendanceByDate(dateStr: string, classIds: number[] | null = null): Map<number, any> {
	let rows: any[];
	if (classIds) {
		const placeholders = classIds.map(() => '?').join(',');
		rows = db
			.prepare(
				`SELECT a.*, s.nama FROM attendance_daily a
         JOIN students s ON s.id = a.student_id
         WHERE a.tanggal=? AND s.class_id IN (${placeholders})`
			)
			.all(dateStr, ...classIds) as any[];
	} else {
		rows = db.prepare('SELECT a.*, s.nama FROM attendance_daily a JOIN students s ON s.id = a.student_id WHERE a.tanggal=?').all(dateStr) as any[];
	}
	const map = new Map<number, any>();
	for (const r of rows) map.set(r.student_id, r);
	return map;
}

export function upsertAttendance(dateStr: string, classId: number, entries: AttendanceEntry[], user: User) {
	const students = getStudents({ class_id: classId, status: 'aktif' });
	const studentIds = new Set(students.map((s) => s.id));
	const validStatuses: AttendanceStatus[] = ['hadir', 'sakit', 'izin', 'alpa', 'terlambat'];

	const upsert = db.prepare(
		`INSERT INTO attendance_daily (student_id, tanggal, status, keterangan, bukti_url, dicatat_oleh, updated_at)
     VALUES (?,?,?,?,?,?,datetime('now','localtime'))
     ON CONFLICT(student_id, tanggal) DO UPDATE SET
       status=excluded.status, keterangan=excluded.keterangan, bukti_url=excluded.bukti_url,
       dicatat_oleh=excluded.dicatat_oleh, updated_at=excluded.updated_at`
	);
	const log = db.prepare(
		`INSERT INTO attendance_logs (attendance_id, student_id, tanggal, user_id, old_status, new_status)
     VALUES (?,?,?,?,?,?)`
	);

	const tx = db.transaction(() => {
		let count = 0;
		for (const e of entries) {
			if (!studentIds.has(e.student_id)) continue;
			if (!validStatuses.includes(e.status)) continue;
			const old = db
				.prepare('SELECT id, status FROM attendance_daily WHERE student_id=? AND tanggal=?')
				.get(e.student_id, dateStr) as any;
			const res = upsert.run(
				e.student_id,
				dateStr,
				e.status,
				e.keterangan ?? '',
				e.bukti_url ?? '',
				user.id
			);
			const attendanceId = old ? old.id : Number(res.lastInsertRowid);
			if (!old || old.status !== e.status) {
				log.run(attendanceId, e.student_id, dateStr, user.id, old ? old.status : '', e.status);
			}
			count++;
		}
		return count;
	});
	return tx();
}

export interface HistoryFilter {
	student_id?: number;
	class_id?: number;
	from?: string;
	to?: string;
	user?: User | null;
}

export function getAttendanceHistory(filter: HistoryFilter) {
	const conds: string[] = [];
	const params: any[] = [];
	if (filter.student_id) {
		conds.push('a.student_id = ?');
		params.push(filter.student_id);
	}
	const allowed = filter.user ? allowedClassIds(filter.user) : null;
	if (allowed) {
		conds.push(`s.class_id IN (${allowed.map(() => '?').join(',')})`);
		params.push(...allowed);
	} else if (filter.class_id) {
		conds.push('s.class_id = ?');
		params.push(filter.class_id);
	}
	if (filter.from) {
		conds.push('a.tanggal >= ?');
		params.push(filter.from);
	}
	if (filter.to) {
		conds.push('a.tanggal <= ?');
		params.push(filter.to);
	}
	const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
	return db
		.prepare(
			`SELECT a.id, a.student_id, s.nisn, s.nama, s.class_id, c.nama AS class_name, a.tanggal, a.status,
              a.keterangan, a.bukti_url, u.name AS dicatat_oleh, a.updated_at
       FROM attendance_daily a
       JOIN students s ON s.id = a.student_id
       JOIN classes c ON c.id = s.class_id
       LEFT JOIN users u ON u.id = a.dicatat_oleh
       ${where} ORDER BY a.tanggal DESC, s.nama LIMIT 500`
		)
		.all(...params);
}

export function getAttendanceLogs(limit = 100) {
	return db
		.prepare(
			`SELECT l.id, l.student_id, s.nama, l.tanggal, l.old_status, l.new_status, u.name AS user_name, l.changed_at
       FROM attendance_logs l
       JOIN students s ON s.id = l.student_id
       LEFT JOIN users u ON u.id = l.user_id
       ORDER BY l.changed_at DESC, l.id DESC LIMIT ?`
		)
		.all(limit);
}

// ---------------------------------------------------------------- absensi per mapel

export function getAttendanceSubjectByDate(
	dateStr: string,
	classId: number,
	subjectId: number,
	jamKe: number
): Map<number, { id: number; student_id: number; status: AttendanceStatus; keterangan: string }> {
	const rows = db
		.prepare(
			`SELECT id, student_id, status, keterangan FROM attendance_subject
       WHERE tanggal=? AND class_id=? AND subject_id=? AND jam_ke=?`
		)
		.all(dateStr, classId, subjectId, jamKe) as any[];
	const map = new Map<number, { id: number; student_id: number; status: AttendanceStatus; keterangan: string }>();
	for (const r of rows) map.set(r.student_id, r);
	return map;
}

export function upsertSubjectAttendance(
	dateStr: string,
	classId: number,
	subjectId: number,
	jamKe: number,
	entries: AttendanceEntry[],
	user: User
) {
	const students = getStudents({ class_id: classId, status: 'aktif' });
	const studentIds = new Set(students.map((s) => s.id));
	const validStatuses: AttendanceStatus[] = ['hadir', 'sakit', 'izin', 'alpa', 'terlambat'];

	const upsert = db.prepare(
		`INSERT INTO attendance_subject (student_id, subject_id, class_id, tanggal, jam_ke, status, keterangan, dicatat_oleh, updated_at)
     VALUES (?,?,?,?,?,?,?,?,datetime('now','localtime'))
     ON CONFLICT(student_id, subject_id, tanggal, jam_ke) DO UPDATE SET
       status=excluded.status, keterangan=excluded.keterangan,
       dicatat_oleh=excluded.dicatat_oleh, updated_at=excluded.updated_at`
	);
	const tx = db.transaction(() => {
		let count = 0;
		for (const e of entries) {
			if (!studentIds.has(e.student_id)) continue;
			if (!validStatuses.includes(e.status)) continue;
			upsert.run(e.student_id, subjectId, classId, dateStr, jamKe, e.status, e.keterangan ?? '', user.id);
			count++;
		}
		return count;
	});
	return tx();
}

// ---------------------------------------------------------------- jurnal kelas (jurnal harian guru)

export interface JournalFilter {
	class_id?: number;
	from?: string;
	to?: string;
	user?: User | null;
}

export function getJournals(filter: JournalFilter = {}): JournalEntry[] {
	const conds: string[] = [];
	const params: any[] = [];
	const allowed = filter.user ? allowedClassIds(filter.user) : null;
	if (allowed) {
		conds.push(`j.class_id IN (${allowed.map(() => '?').join(',')})`);
		params.push(...allowed);
	}
	if (filter.class_id) {
		conds.push('j.class_id = ?');
		params.push(filter.class_id);
	}
	if (filter.from) {
		conds.push('j.tanggal >= ?');
		params.push(filter.from);
	}
	if (filter.to) {
		conds.push('j.tanggal <= ?');
		params.push(filter.to);
	}
	const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
	return db
		.prepare(
			`SELECT j.id, j.class_id, c.nama AS class_name, j.tanggal, j.subject_id, sb.nama AS subject_name,
              j.materi, j.kegiatan, j.kendala, j.catatan, u.name AS dicatat_oleh
       FROM class_journals j
       JOIN classes c ON c.id = j.class_id
       LEFT JOIN subjects sb ON sb.id = j.subject_id
       LEFT JOIN users u ON u.id = j.dicatat_oleh
       ${where} ORDER BY j.tanggal DESC, j.id DESC LIMIT 300`
		)
		.all(...params) as JournalEntry[];
}

export function createJournal(data: {
	class_id: number;
	tanggal: string;
	subject_id: number | null;
	materi: string;
	kegiatan: string;
	kendala: string;
	catatan: string;
	user_id: number;
}) {
	const res = db
		.prepare(
			`INSERT INTO class_journals (class_id, tanggal, subject_id, materi, kegiatan, kendala, catatan, dicatat_oleh)
       VALUES (?,?,?,?,?,?,?,?)`
		)
		.run(data.class_id, data.tanggal ?? todayStr(), data.subject_id, data.materi, data.kegiatan, data.kendala, data.catatan, data.user_id);
	return Number(res.lastInsertRowid);
}

export function updateJournal(id: number, data: Partial<Omit<JournalEntry, 'id'>>, user_id: number) {
	const cur = db.prepare('SELECT * FROM class_journals WHERE id=?').get(id) as any;
	if (!cur) throw new Error('Jurnal tidak ditemukan');
	db.prepare(
		`UPDATE class_journals SET class_id=?, tanggal=?, subject_id=?, materi=?, kegiatan=?, kendala=?, catatan=?, dicatat_oleh=?, updated_at=datetime('now','localtime') WHERE id=?`
	).run(
		data.class_id ?? cur.class_id,
		data.tanggal ?? cur.tanggal,
		data.subject_id !== undefined ? data.subject_id : cur.subject_id,
		data.materi ?? cur.materi,
		data.kegiatan ?? cur.kegiatan,
		data.kendala ?? cur.kendala,
		data.catatan ?? cur.catatan,
		user_id,
		id
	);
}

export function deleteJournal(id: number) {
	db.prepare('DELETE FROM class_journals WHERE id=?').run(id);
}

// ---------------------------------------------------------------- kalender akademik

export function getHolidays(limit = 50): import('$lib/types').Holiday[] {
	return db
		.prepare('SELECT id, tanggal, keterangan, tipe FROM academic_calendar ORDER BY tanggal DESC LIMIT ?')
		.all(limit) as import('$lib/types').Holiday[];
}

export function getUpcomingHolidays(limit = 5): import('$lib/types').Holiday[] {
	return db
		.prepare(
			`SELECT id, tanggal, keterangan, tipe FROM academic_calendar
       WHERE tanggal >= ? AND tipe='libur' ORDER BY tanggal ASC LIMIT ?`
		)
		.all(todayStr(), limit) as import('$lib/types').Holiday[];
}

export function upsertHoliday(data: { tanggal: string; keterangan: string; tipe: string }) {
	return db
		.prepare(
			`INSERT INTO academic_calendar (tanggal, keterangan, tipe) VALUES (?,?,?)
       ON CONFLICT(tanggal) DO UPDATE SET keterangan=excluded.keterangan, tipe=excluded.tipe`
		)
		.run(data.tanggal, data.keterangan, data.tipe);
}

export function deleteHoliday(id: number) {
	db.prepare('DELETE FROM academic_calendar WHERE id=?').run(id);
}

// ---------------------------------------------------------------- reports

export function getReportSummary(opts: { class_id?: number; from: string; to: string; user?: User | null }): {
	rows: ReportRow[];
	class_name: string | null;
} {
	const conds: string[] = ['a.tanggal BETWEEN ? AND ?'];
	const params: any[] = [opts.from, opts.to];
	const allowed = opts.user ? allowedClassIds(opts.user) : null;
	if (allowed) {
		conds.push(`s.class_id IN (${allowed.map(() => '?').join(',')})`);
		params.push(...allowed);
	} else if (opts.class_id) {
		conds.push('s.class_id = ?');
		params.push(opts.class_id);
	}
	const where = conds.join(' AND ');
	const rows = db
		.prepare(
			`SELECT s.id AS student_id, s.nisn, s.nis, s.nama, s.class_id, c.nama AS class_name,
              SUM(CASE WHEN a.status='hadir' THEN 1 ELSE 0 END) AS hadir,
              SUM(CASE WHEN a.status='sakit' THEN 1 ELSE 0 END) AS sakit,
              SUM(CASE WHEN a.status='izin' THEN 1 ELSE 0 END) AS izin,
              SUM(CASE WHEN a.status='alpa' THEN 1 ELSE 0 END) AS alpa,
              SUM(CASE WHEN a.status='terlambat' THEN 1 ELSE 0 END) AS terlambat,
              COUNT(*) AS total
       FROM attendance_daily a JOIN students s ON s.id = a.student_id JOIN classes c ON c.id = s.class_id
       WHERE ${where} GROUP BY s.id ORDER BY c.tingkat, c.nama, s.nama`
		)
		.all(...params) as any[];
	const result: ReportRow[] = rows.map((r) => ({
		student_id: r.student_id,
		nisn: r.nisn,
		nis: r.nis,
		nama: r.nama,
		hadir: r.hadir,
		sakit: r.sakit,
		izin: r.izin,
		alpa: r.alpa,
		terlambat: r.terlambat,
		total: r.total,
		persentase: r.total > 0 ? Math.round(((r.total - r.alpa) / r.total) * 1000) / 10 : 0
	}));
	const className = opts.class_id ? (getClass(opts.class_id)?.nama ?? null) : null;
	return { rows: result, class_name: className };
}

/** Laporan per tanggal: baris = siswa, kolom = tanggal yang pernah diinput (memanjang ke kanan). */
export function getAttendanceMatrix(opts: {
	class_id?: number;
	from: string;
	to: string;
	user?: User | null;
	student_ids?: number[];
}): MatrixReport {
	const conds: string[] = ['a.tanggal BETWEEN ? AND ?'];
	const params: any[] = [opts.from, opts.to];
	const allowed = opts.user ? allowedClassIds(opts.user) : null;
	if (opts.student_ids?.length) {
		conds.push(`a.student_id IN (${opts.student_ids.map(() => '?').join(',')})`);
		params.push(...opts.student_ids);
	} else if (allowed) {
		conds.push(`s.class_id IN (${allowed.map(() => '?').join(',')})`);
		params.push(...allowed);
	} else if (opts.class_id) {
		conds.push('s.class_id = ?');
		params.push(opts.class_id);
	}
	const where = conds.join(' AND ');

	const dateRows = db
		.prepare(
			`SELECT DISTINCT a.tanggal FROM attendance_daily a
       JOIN students s ON s.id = a.student_id
       WHERE ${where} ORDER BY a.tanggal ASC`
		)
		.all(...params) as any[];
	const dates = dateRows.map((r) => r.tanggal as string);

	const attRows = db
		.prepare(
			`SELECT a.student_id, a.tanggal, a.status FROM attendance_daily a
       JOIN students s ON s.id = a.student_id
       WHERE ${where} ORDER BY s.nama`
		)
		.all(...params) as any[];
	const byStudent = new Map<number, Record<string, AttendanceStatus>>();
	for (const r of attRows) {
		if (!byStudent.has(r.student_id)) byStudent.set(r.student_id, {});
		byStudent.get(r.student_id)![r.tanggal] = r.status;
	}

	const studentFilter: StudentFilter = {};
	if (opts.class_id) studentFilter.class_id = opts.class_id;
	if (allowed) studentFilter.user = opts.user;
	const allStudents = getStudents({ ...studentFilter, status: 'aktif' });
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

	// statistik agregat per tanggal (untuk baris % kehadiran per tanggal)
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

	const className = opts.class_id ? (getClass(opts.class_id)?.nama ?? null) : null;
	return { dates, rows, per_date: perDateStats, class_name: className };
}

/** Matriks absensi per mata pelajaran: baris = siswa, kolom = tanggal (dari attendance_subject). */
export function getSubjectAttendanceMatrix(opts: {
	class_id?: number;
	subject_id?: number;
	from: string;
	to: string;
	user?: User | null;
}): MatrixReport {
	const conds: string[] = ['a.tanggal BETWEEN ? AND ?'];
	const params: any[] = [opts.from, opts.to];
	if (opts.subject_id) {
		conds.push('a.subject_id = ?');
		params.push(opts.subject_id);
	}
	const allowed = opts.user ? allowedClassIds(opts.user) : null;
	if (opts.class_id) {
		conds.push('a.class_id = ?');
		params.push(opts.class_id);
	} else if (allowed) {
		conds.push(`a.class_id IN (${allowed.map(() => '?').join(',')})`);
		params.push(...allowed);
	}
	const where = conds.join(' AND ');

	// Kolom tetap Jam 1..8; status tiap jam = catatan terbaru pada jam tersebut dalam periode
	const dates = ['1', '2', '3', '4', '5', '6', '7', '8'];

	const attRows = db
		.prepare(
			`SELECT a.student_id, a.tanggal, a.jam_ke, a.status FROM attendance_subject a WHERE ${where} ORDER BY a.tanggal ASC`
		)
		.all(...params) as any[];
	const byStudent = new Map<number, Record<string, AttendanceStatus>>();
	for (const r of attRows) {
		const j = Number(r.jam_ke);
		if (!Number.isInteger(j) || j < 1 || j > 8) continue;
		const jam = String(j);
		if (!byStudent.has(r.student_id)) byStudent.set(r.student_id, {});
		byStudent.get(r.student_id)![jam] = r.status;
	}

	const studentFilter: StudentFilter = {};
	if (opts.class_id) studentFilter.class_id = opts.class_id;
	if (allowed) studentFilter.user = opts.user;
	const students = getStudents({ ...studentFilter, status: 'aktif' });

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

	const className = opts.class_id ? (getClass(opts.class_id)?.nama ?? null) : null;
	let subjectName: string | null = null;
	if (opts.subject_id) {
		const subj = db.prepare('SELECT nama FROM subjects WHERE id = ?').get(opts.subject_id) as any;
		subjectName = subj?.nama ?? null;
	}
	return { dates, rows, per_date: perDateStats, class_name: className, subject_name: subjectName };
}

// ---------------------------------------------------------------- tahun ajaran & semester

export function getAcademicPeriods(): import('$lib/types').AcademicPeriod[] {
	return db
		.prepare('SELECT id, tahun_ajaran, semester, aktif FROM academic_periods ORDER BY tahun_ajaran DESC, semester DESC')
		.all()
		.map((r: any) => ({ id: r.id, tahun_ajaran: r.tahun_ajaran, semester: r.semester, aktif: !!r.aktif })) as import('$lib/types').AcademicPeriod[];
}

export function addAcademicPeriod(tahun_ajaran: string, semester: string) {
	db.prepare('INSERT OR IGNORE INTO academic_periods (tahun_ajaran, semester, aktif) VALUES (?,?,0)').run(
		tahun_ajaran,
		semester
	);
}

export function setActivePeriod(tahun_ajaran: string, semester: string) {
	db.prepare('UPDATE academic_periods SET aktif=0').run();
	db.prepare('UPDATE academic_periods SET aktif=1 WHERE tahun_ajaran=? AND semester=?').run(tahun_ajaran, semester);
	db.prepare('UPDATE schools SET tahun_ajaran_aktif=?, semester_aktif=? WHERE id=1').run(tahun_ajaran, semester);
}

export function getAlerts(): AlertItem[] {
	const threshold = Number(getSetting('alpa_threshold', '3')) || 3;
	const year = new Date().getFullYear();
	const rows = db
		.prepare(
			`SELECT s.id AS student_id, s.nama, s.nisn, c.nama AS class_name, COUNT(*) AS alpa_count
       FROM attendance_daily a JOIN students s ON s.id = a.student_id JOIN classes c ON c.id = s.class_id
       WHERE a.status='alpa' AND a.tanggal >= ? AND s.status='aktif'
       GROUP BY s.id HAVING alpa_count >= ? ORDER BY alpa_count DESC`
		)
		.all(`${year}-01-01`, threshold) as any[];
	return rows.map((r) => ({ ...r, threshold }));
}

export function getDashboard(user: User): DashboardSummary {
	const tanggal = todayStr();
	const holiday = isHoliday(tanggal);
	const allowed = allowedClassIds(user);
	const classes = getClasses(user);
	const classIds = classes.map((c) => c.id);

	const counts: Record<string, number> = { hadir: 0, sakit: 0, izin: 0, alpa: 0, terlambat: 0 };
	let dicatat = 0;

	const perKelas = classes.map((c) => {
		const map = getAttendanceByDate(tanggal, [c.id]);
		const k = { class_id: c.id, class_name: c.nama, hadir: 0, sakit: 0, izin: 0, alpa: 0, terlambat: 0, belum_dicatat: 0, total: 0 };
		for (const s of getStudents({ class_id: c.id, status: 'aktif' })) {
			const rec = map.get(s.id);
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

	const totalSiswa = perKelas.reduce((sum, k) => sum + k.total, 0);
	const alerts = user.role === 'guru_mapel' ? [] : getAlerts();

	// statistik absensi bulan berjalan (untuk chart donat + mini donat per kelas)
	const monthStart = `${tanggal.slice(0, 7)}-01`;
	const bulanIni = { hadir: 0, sakit: 0, izin: 0, alpa: 0, terlambat: 0, total: 0 };
	const monthRows = db
		.prepare(
			`SELECT a.status, s.class_id FROM attendance_daily a
       JOIN students s ON s.id = a.student_id
       WHERE a.tanggal BETWEEN ? AND ?${classIds.length ? ` AND s.class_id IN (${classIds.map(() => '?').join(',')})` : ''}`
		)
		.all(monthStart, tanggal, ...classIds) as any[];
	const perKelasMonth = new Map<number, { hadir: number; sakit: number; izin: number; alpa: number; terlambat: number; total: number }>();
	for (const r of monthRows) {
		if (r.status in bulanIni) bulanIni[r.status as keyof typeof bulanIni]++;
		bulanIni.total++;
		const cid = r.class_id as number;
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

	// tren 7 hari terakhir (hari efektif)
	const trend: { tanggal: string; hadir: number; sakit: number; izin: number; alpa: number; terlambat: number; total: number }[] = [];
	for (let i = 10; i >= 0; i--) {
		const d = addDays(tanggal, -i);
		if (d > tanggal) continue;
		const dow = new Date(`${d}T00:00:00`).getDay();
		if (dow === 0 || dow === 6) continue;
		if (isHoliday(d).libur) continue;
		const t = { tanggal: d, hadir: 0, sakit: 0, izin: 0, alpa: 0, terlambat: 0, total: 0 };
		const map = getAttendanceByDate(d, classIds.length ? classIds : null);
		for (const s of getStudents({ user, status: 'aktif' })) {
			const rec = map.get(s.id);
			if (rec) {
				t[rec.status as keyof typeof t]++;
				t.total++;
			}
		}
		trend.push(t);
		if (trend.length === 7) break;
	}

	// siswa yang tidak hadir hari ini
	const hariIniAbsen: { student_id: number; nama: string; class_name: string; status: AttendanceStatus; keterangan: string }[] = [];
	const todayMap = getAttendanceByDate(tanggal, classIds.length ? classIds : null);
	for (const s of getStudents({ user, status: 'aktif' })) {
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

	const holidays = getUpcomingHolidays(5);

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
