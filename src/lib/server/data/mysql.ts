import { getMysqlPool, initMysqlTables } from '../mysql';
import type {
	AcademicPeriod,
	AlertItem,
	AttendanceEntry,
	AttendanceRecord,
	AttendanceStatus,
	ClassRow,
	DashboardSummary,
	Holiday,
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

async function pool() {
	await initMysqlTables();
	return getMysqlPool();
}

function userRowToUser(row: any): (User & { password_hash: string | null }) | null {
	if (!row) return null;
	return {
		id: Number(row.id),
		username: row.username ?? null,
		email: row.email,
		name: row.teacher_nama ?? row.name,
		role: row.role,
		teacher_id: row.teacher_id ? Number(row.teacher_id) : null,
		class_id: row.class_id ? Number(row.class_id) : null,
		class_name: row.class_name ?? null,
		foto_url: row.foto_url ?? '',
		password_hash: row.password_hash ?? null
	};
}

// ================================================================ AUTH STORE

export async function authFindUserByEmail(email: string): Promise<(User & { password_hash: string | null }) | null> {
	const p = await pool();
	const [rows] = await p.query<any[]>(
		`SELECT u.id, u.username, u.email, u.name, u.role, u.teacher_id, u.class_id, u.foto_url, u.password_hash,
              c.nama AS class_name, t.nama AS teacher_nama
       FROM users u LEFT JOIN classes c ON c.id = u.class_id LEFT JOIN teachers t ON t.id = u.teacher_id
       WHERE LOWER(u.email) = LOWER(?)`,
		[email]
	);
	return userRowToUser(rows[0]);
}

export async function authFindUserByIdentifier(identifier: string): Promise<(User & { password_hash: string | null }) | null> {
	const p = await pool();
	const [rows] = await p.query<any[]>(
		`SELECT u.id, u.username, u.email, u.name, u.role, u.teacher_id, u.class_id, u.foto_url, u.password_hash,
              c.nama AS class_name, t.nama AS teacher_nama
       FROM users u LEFT JOIN classes c ON c.id = u.class_id LEFT JOIN teachers t ON t.id = u.teacher_id
       WHERE LOWER(u.email) = LOWER(?) OR LOWER(u.username) = LOWER(?)`,
		[identifier, identifier]
	);
	return userRowToUser(rows[0]);
}

export async function authGetUserById(userId: number): Promise<User | null> {
	const p = await pool();
	const [rows] = await p.query<any[]>(
		`SELECT u.id, u.username, u.email, u.name, u.role, u.teacher_id, u.class_id, u.foto_url,
              c.nama AS class_name, t.nama AS teacher_nama
       FROM users u LEFT JOIN classes c ON c.id = u.class_id LEFT JOIN teachers t ON t.id = u.teacher_id
       WHERE u.id = ?`,
		[userId]
	);
	const u = userRowToUser(rows[0]);
	if (!u) return null;
	const { password_hash: _ph, ...rest } = u;
	return rest as User;
}

export async function authGetSession(token: string): Promise<{ user_id: number; expires_at: string } | null> {
	const p = await pool();
	const [rows] = await p.query<any[]>('SELECT user_id, expires_at FROM sessions WHERE token = ?', [token]);
	if (!rows[0]) return null;
	return { user_id: Number(rows[0].user_id), expires_at: rows[0].expires_at };
}

export async function authCreateSession(token: string, userId: number, expiresAt: string): Promise<void> {
	const p = await pool();
	await p.query('INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)', [token, userId, expiresAt]);
}

export async function authDeleteSession(token: string): Promise<void> {
	const p = await pool();
	await p.query('DELETE FROM sessions WHERE token = ?', [token]);
}

export async function authUpsertByAuthId(): Promise<number | null> {
	return null;
}

export async function authUpdatePasswordHash(userId: number, hash: string): Promise<void> {
	const p = await pool();
	await p.query('UPDATE users SET password_hash=? WHERE id=?', [hash, userId]);
}

export async function authGetAuthId(): Promise<string | null> {
	return null;
}

export async function authSetProfile(userId: number, name: string, fotoUrl = ''): Promise<void> {
	const p = await pool();
	await p.query('UPDATE users SET name=?, foto_url=? WHERE id=?', [name, fotoUrl, userId]);
}

export async function findUserByTeacherId(teacherId: number): Promise<{ id: number; name: string; role: string; class_id: number | null } | null> {
	const p = await pool();
	const [rows] = await p.query<any[]>('SELECT id, name, role, class_id FROM users WHERE teacher_id = ?', [teacherId]);
	if (!rows[0]) return null;
	return {
		id: Number(rows[0].id),
		name: rows[0].name,
		role: rows[0].role,
		class_id: rows[0].class_id ? Number(rows[0].class_id) : null
	};
}

export async function createUserAccount(
	teacherId: number,
	username: string,
	email: string,
	passwordHash: string,
	name: string,
	role: string,
	classId: number | null
): Promise<number> {
	const p = await pool();
	const [res] = await p.query<any>(
		'INSERT INTO users (username, email, password_hash, name, role, teacher_id, class_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
		[username || null, email, passwordHash, name, role, teacherId, classId]
	);
	return Number(res.insertId);
}

export async function updateUserAccount(
	userId: number,
	role: string,
	classId: number | null,
	passwordHash?: string
): Promise<void> {
	const p = await pool();
	if (passwordHash) {
		await p.query('UPDATE users SET role=?, class_id=?, password_hash=? WHERE id=?', [role, classId, passwordHash, userId]);
	} else {
		await p.query('UPDATE users SET role=?, class_id=? WHERE id=?', [role, classId, userId]);
	}
}

// ================================================================ SCHOOL

export async function getSchool(): Promise<School> {
	const p = await pool();
	const [rows] = await p.query<any[]>(
		`SELECT s.*, COALESCE((SELECT value FROM settings WHERE \`key\`='alpa_threshold'), '3') AS alpa_threshold
		 FROM schools s WHERE id = 1`
	);
	if (!rows[0]) {
		return {
			id: 1,
			nama: 'SMP Negeri 1 Harapan Jaya',
			npsn: '20219876',
			alamat: 'Jl. Pendidikan No. 1, Kec. Sukamaju, Kota Harapan',
			logo_url: '',
			kepala_sekolah: 'Drs. Bambang Sutrisno, M.Pd.',
			tahun_ajaran_aktif: '2026/2027',
			semester_aktif: 'Ganjil',
			alpa_threshold: 3
		};
	}
	return {
		id: Number(rows[0].id),
		nama: rows[0].nama ?? '',
		npsn: rows[0].npsn ?? '',
		alamat: rows[0].alamat ?? '',
		logo_url: rows[0].logo_url ?? '',
		kepala_sekolah: rows[0].kepala_sekolah ?? '',
		tahun_ajaran_aktif: rows[0].tahun_ajaran_aktif ?? '2026/2027',
		semester_aktif: rows[0].semester_aktif ?? 'Ganjil',
		alpa_threshold: Number(rows[0].alpa_threshold ?? 3)
	};
}

export async function updateSchool(data: Partial<School>): Promise<void> {
	const p = await pool();
	const school = await getSchool();
	await p.query(
		`UPDATE schools SET nama=?, npsn=?, alamat=?, logo_url=?, kepala_sekolah=?, tahun_ajaran_aktif=?, semester_aktif=? WHERE id=1`,
		[
			data.nama ?? school.nama,
			data.npsn ?? school.npsn,
			data.alamat ?? school.alamat,
			data.logo_url ?? school.logo_url,
			data.kepala_sekolah ?? school.kepala_sekolah,
			data.tahun_ajaran_aktif ?? school.tahun_ajaran_aktif,
			data.semester_aktif ?? school.semester_aktif
		]
	);
	if (data.alpa_threshold !== undefined) {
		await p.query(
			`INSERT INTO settings (\`key\`, \`value\`) VALUES ('alpa_threshold', ?)
			 ON DUPLICATE KEY UPDATE \`value\`=VALUES(\`value\`)`,
			[String(data.alpa_threshold)]
		);
	}
}

export async function getSetting(key: string, def = ''): Promise<string> {
	const p = await pool();
	const [rows] = await p.query<any[]>('SELECT value FROM settings WHERE `key` = ?', [key]);
	return rows[0] ? rows[0].value : def;
}

// ================================================================ CLASSES

export async function getClasses(user?: User | null): Promise<ClassRow[]> {
	const p = await pool();
	const allowed = user ? allowedClassIds(user) : null;

	let sql = `
		SELECT c.id, c.nama, c.tingkat, c.tahun_ajaran, c.wali_kelas_id,
		       t.nama AS wali_kelas_nama,
		       (SELECT COUNT(*) FROM students s WHERE s.class_id = c.id AND s.status = 'aktif') AS jumlah_siswa
		FROM classes c
		LEFT JOIN teachers t ON t.id = c.wali_kelas_id
	`;
	const params: any[] = [];
	if (allowed) {
		if (allowed.length === 0) return [];
		sql += ` WHERE c.id IN (${allowed.map(() => '?').join(',')})`;
		params.push(...allowed);
	}
	sql += ' ORDER BY c.tingkat, c.nama';

	const [rows] = await p.query<any[]>(sql, params);
	return rows.map((r) => ({
		id: Number(r.id),
		nama: r.nama,
		tingkat: Number(r.tingkat),
		tahun_ajaran: r.tahun_ajaran,
		wali_kelas_id: r.wali_kelas_id ? Number(r.wali_kelas_id) : null,
		wali_kelas_nama: r.wali_kelas_nama ?? null,
		jumlah_siswa: Number(r.jumlah_siswa ?? 0)
	}));
}

export async function getClass(id: number): Promise<ClassRow | null> {
	const p = await pool();
	const [rows] = await p.query<any[]>(
		`SELECT c.id, c.nama, c.tingkat, c.tahun_ajaran, c.wali_kelas_id,
		        t.nama AS wali_kelas_nama,
		        (SELECT COUNT(*) FROM students s WHERE s.class_id = c.id AND s.status = 'aktif') AS jumlah_siswa
		 FROM classes c
		 LEFT JOIN teachers t ON t.id = c.wali_kelas_id
		 WHERE c.id = ?`,
		[id]
	);
	if (!rows[0]) return null;
	const r = rows[0];
	return {
		id: Number(r.id),
		nama: r.nama,
		tingkat: Number(r.tingkat),
		tahun_ajaran: r.tahun_ajaran,
		wali_kelas_id: r.wali_kelas_id ? Number(r.wali_kelas_id) : null,
		wali_kelas_nama: r.wali_kelas_nama ?? null,
		jumlah_siswa: Number(r.jumlah_siswa ?? 0)
	};
}

export async function syncWaliKelasRole(teacherId: number | null): Promise<void> {
	if (!teacherId) return;
	const p = await pool();
	const [countRows] = await p.query<any[]>('SELECT COUNT(*) AS n FROM classes WHERE wali_kelas_id=?', [teacherId]);
	const isWali = Number(countRows[0]?.n ?? 0) > 0;
	const [curRows] = await p.query<any[]>('SELECT jabatan FROM teachers WHERE id=?', [teacherId]);
	if (!curRows[0]) return;
	let jabatan = curRows[0].jabatan;
	if (isWali) jabatan = 'wali_kelas';
	else if (curRows[0].jabatan === 'wali_kelas') jabatan = 'guru_mapel';

	if (jabatan !== curRows[0].jabatan) {
		await p.query('UPDATE teachers SET jabatan=? WHERE id=?', [jabatan, teacherId]);
	}
	await p.query('UPDATE users SET role=? WHERE teacher_id=?', [jabatan, teacherId]);
}

export async function createClass(data: { nama: string; tingkat: number; tahun_ajaran: string; wali_kelas_id: number | null }) {
	const p = await pool();
	const school = await getSchool();
	const [res] = await p.query<any>(
		'INSERT INTO classes (school_id, nama, tingkat, tahun_ajaran, wali_kelas_id) VALUES (?, ?, ?, ?, ?)',
		[school.id, data.nama, data.tingkat, data.tahun_ajaran, data.wali_kelas_id]
	);
	await syncWaliKelasRole(data.wali_kelas_id);
	return res;
}

export async function updateClass(id: number, data: Partial<ClassRow>) {
	const p = await pool();
	const cur = await getClass(id);
	await p.query('UPDATE classes SET nama=?, tingkat=?, tahun_ajaran=?, wali_kelas_id=? WHERE id=?', [
		data.nama ?? cur?.nama,
		data.tingkat ?? cur?.tingkat,
		data.tahun_ajaran ?? cur?.tahun_ajaran,
		data.wali_kelas_id !== undefined ? data.wali_kelas_id : cur?.wali_kelas_id ?? null,
		id
	]);
	if (data.wali_kelas_id !== undefined && data.wali_kelas_id !== cur?.wali_kelas_id) {
		await syncWaliKelasRole(cur?.wali_kelas_id ?? null);
		await syncWaliKelasRole(data.wali_kelas_id);
	}
}

export async function deleteClass(id: number): Promise<void> {
	const p = await pool();
	const cur = await getClass(id);
	await p.query('DELETE FROM classes WHERE id = ?', [id]);
	await syncWaliKelasRole(cur?.wali_kelas_id ?? null);
}

// ================================================================ TEACHERS

export async function getTeachers(): Promise<Teacher[]> {
	const p = await pool();
	const [rows] = await p.query<any[]>(
		`SELECT t.id, t.kode, t.nip, t.nuptk, t.nama, t.jabatan, t.kontak,
		        u.id AS user_id, u.username, u.email AS user_email, u.role AS user_role, u.foto_url
		 FROM teachers t
		 LEFT JOIN users u ON u.teacher_id = t.id
		 ORDER BY t.nama`
	);
	return rows.map((r) => ({
		id: Number(r.id),
		kode: r.kode ?? '',
		nip: r.nip ?? '',
		nuptk: r.nuptk ?? '',
		nama: r.nama,
		jabatan: r.jabatan,
		kontak: r.kontak ?? '',
		foto_url: r.foto_url ?? undefined,
		user_id: r.user_id ? Number(r.user_id) : null,
		username: r.username ?? null,
		user_email: r.user_email ?? null,
		user_role: r.user_role ?? null
	}));
}

export async function createTeacher(data: Omit<Teacher, 'id'> & { foto_url?: string }) {
	const p = await pool();
	const school = await getSchool();
	const [res] = await p.query<any>(
		'INSERT INTO teachers (school_id, kode, nip, nuptk, nama, jabatan, kontak) VALUES (?, ?, ?, ?, ?, ?, ?)',
		[school.id, data.kode ?? '', data.nip ?? '', data.nuptk ?? '', data.nama, data.jabatan ?? 'guru_mapel', data.kontak ?? '']
	);
	const id = Number(res.insertId);
	if (data.foto_url) {
		import('$lib/server/accounts').then(({ getOrCreateTeacherAccount }) => {
			getOrCreateTeacherAccount({ id, ...data } as any).then((acc) => {
				authSetProfile(acc.id, data.nama, data.foto_url!);
			});
		});
	}
	return res;
}

export async function updateTeacher(id: number, data: Partial<Teacher> & { foto_url?: string }) {
	const p = await pool();
	const [rows] = await p.query<any[]>('SELECT * FROM teachers WHERE id = ?', [id]);
	const cur = rows[0];
	if (!cur) throw new Error('Guru tidak ditemukan');

	await p.query(
		'UPDATE teachers SET kode=?, nip=?, nuptk=?, nama=?, jabatan=?, kontak=? WHERE id=?',
		[
			data.kode ?? cur.kode ?? '',
			data.nip ?? cur.nip,
			data.nuptk ?? cur.nuptk,
			data.nama ?? cur.nama,
			data.jabatan ?? cur.jabatan,
			data.kontak ?? cur.kontak,
			id
		]
	);

	if (data.nama) {
		await p.query('UPDATE users SET name=? WHERE teacher_id=?', [data.nama, id]);
	}
	if (data.jabatan) {
		await p.query('UPDATE users SET role=? WHERE teacher_id=?', [data.jabatan, id]);
	}
	if (data.foto_url !== undefined) {
		await p.query('UPDATE users SET foto_url=? WHERE teacher_id=?', [data.foto_url, id]);
	}
}

export async function deleteTeacher(id: number): Promise<void> {
	const p = await pool();
	await p.query('UPDATE classes SET wali_kelas_id=NULL WHERE wali_kelas_id=?', [id]);
	await p.query('UPDATE subjects SET teacher_id=NULL WHERE teacher_id=?', [id]);

	const [accounts] = await p.query<any[]>('SELECT id FROM users WHERE teacher_id=?', [id]);
	for (const u of accounts) {
		const uid = Number(u.id);
		await p.query('UPDATE attendance_daily SET dicatat_oleh=NULL WHERE dicatat_oleh=?', [uid]);
		await p.query('UPDATE attendance_subject SET dicatat_oleh=NULL WHERE dicatat_oleh=?', [uid]);
		await p.query('UPDATE class_journals SET dicatat_oleh=NULL WHERE dicatat_oleh=?', [uid]);
		await p.query('UPDATE attendance_logs SET user_id=NULL WHERE user_id=?', [uid]);
		await p.query('DELETE FROM users WHERE id=?', [uid]);
	}
	await p.query('DELETE FROM teachers WHERE id=?', [id]);
}

// ================================================================ SUBJECTS

export async function getSubjects(): Promise<Subject[]> {
	const p = await pool();
	const [rows] = await p.query<any[]>(
		`SELECT s.id, s.kode, s.nama, s.teacher_id, t.nama AS teacher_nama
		 FROM subjects s LEFT JOIN teachers t ON t.id = s.teacher_id ORDER BY s.nama`
	);
	const [classRows] = await p.query<any[]>(
		`SELECT sc.subject_id, c.id, c.nama FROM subject_classes sc
		 JOIN classes c ON c.id = sc.class_id ORDER BY c.tingkat, c.nama`
	);
	const bySubject = new Map<number, { id: number; nama: string }[]>();
	for (const r of classRows) {
		const sid = Number(r.subject_id);
		if (!bySubject.has(sid)) bySubject.set(sid, []);
		bySubject.get(sid)!.push({ id: Number(r.id), nama: r.nama });
	}

	const [teacherRows] = await p.query<any[]>(
		`SELECT st.subject_id, t.id, t.nama FROM subject_teachers st
		 JOIN teachers t ON t.id = st.teacher_id ORDER BY t.nama`
	);
	const teachersBySubj = new Map<number, { id: number; nama: string }[]>();
	for (const r of teacherRows) {
		const sid = Number(r.subject_id);
		if (!teachersBySubj.has(sid)) teachersBySubj.set(sid, []);
		teachersBySubj.get(sid)!.push({ id: Number(r.id), nama: r.nama });
	}

	return rows.map((r) => {
		const sid = Number(r.id);
		const list = teachersBySubj.get(sid) ?? (r.teacher_id ? [{ id: Number(r.teacher_id), nama: r.teacher_nama ?? '' }] : []);
		return {
			id: sid,
			kode: r.kode ?? '',
			nama: r.nama,
			teacher_id: r.teacher_id ? Number(r.teacher_id) : null,
			teacher_ids: list.map((t) => t.id),
			teachers: list,
			teacher_nama: list.map((t) => t.nama).join(', ') || r.teacher_nama || null,
			classes: bySubject.get(sid) ?? []
		};
	});
}

export async function getTeacherSubjects(teacherId: number): Promise<Subject[]> {
	const p = await pool();
	const [rows] = await p.query<any[]>(
		`SELECT DISTINCT s.id, s.kode, s.nama, s.teacher_id, t.nama AS teacher_nama
		 FROM subjects s
		 LEFT JOIN teachers t ON t.id = s.teacher_id
		 LEFT JOIN subject_teachers st ON st.subject_id = s.id
		 WHERE s.teacher_id = ? OR st.teacher_id = ?
		 ORDER BY s.nama`,
		[teacherId, teacherId]
	);
	return rows.map((r) => ({
		id: Number(r.id),
		kode: r.kode ?? '',
		nama: r.nama,
		teacher_id: r.teacher_id ? Number(r.teacher_id) : null,
		teacher_nama: r.teacher_nama ?? null,
		classes: []
	}));
}

export async function getClassesForTeacher(teacherId: number): Promise<ClassRow[]> {
	const p = await pool();
	const [rows] = await p.query<any[]>(
		`SELECT DISTINCT c.id, c.nama, c.tingkat, c.tahun_ajaran, c.wali_kelas_id, t.nama AS wali_kelas_nama,
		        (SELECT COUNT(*) FROM students s WHERE s.class_id = c.id AND s.status='aktif') AS jumlah_siswa
		 FROM subjects s
		 JOIN subject_classes sc ON sc.subject_id = s.id
		 JOIN classes c ON c.id = sc.class_id
		 LEFT JOIN subject_teachers st ON st.subject_id = s.id
		 LEFT JOIN teachers t ON t.id = c.wali_kelas_id
		 WHERE s.teacher_id = ? OR st.teacher_id = ? ORDER BY c.tingkat, c.nama`,
		[teacherId, teacherId]
	);
	return rows.map((r) => ({
		id: Number(r.id),
		nama: r.nama,
		tingkat: Number(r.tingkat),
		tahun_ajaran: r.tahun_ajaran,
		wali_kelas_id: r.wali_kelas_id ? Number(r.wali_kelas_id) : null,
		wali_kelas_nama: r.wali_kelas_nama ?? null,
		jumlah_siswa: Number(r.jumlah_siswa ?? 0)
	}));
}

export async function getSubjectsForClass(classId: number): Promise<Subject[]> {
	const p = await pool();
	const [rows] = await p.query<any[]>(
		`SELECT s.id, s.kode, s.nama, s.teacher_id, t.nama AS teacher_nama
		 FROM subject_classes sc
		 JOIN subjects s ON s.id = sc.subject_id
		 LEFT JOIN teachers t ON t.id = s.teacher_id
		 WHERE sc.class_id = ? ORDER BY s.nama`,
		[classId]
	);

	const [teacherRows] = await p.query<any[]>(
		`SELECT st.subject_id, t.id, t.nama FROM subject_teachers st
		 JOIN teachers t ON t.id = st.teacher_id ORDER BY t.nama`
	);
	const teachersBySubj = new Map<number, { id: number; nama: string }[]>();
	for (const r of teacherRows) {
		const sid = Number(r.subject_id);
		if (!teachersBySubj.has(sid)) teachersBySubj.set(sid, []);
		teachersBySubj.get(sid)!.push({ id: Number(r.id), nama: r.nama });
	}

	return rows.map((r) => {
		const sid = Number(r.id);
		const list = teachersBySubj.get(sid) ?? (r.teacher_id ? [{ id: Number(r.teacher_id), nama: r.teacher_nama ?? '' }] : []);
		return {
			id: sid,
			kode: r.kode ?? '',
			nama: r.nama,
			teacher_id: r.teacher_id ? Number(r.teacher_id) : null,
			teacher_ids: list.map((t) => t.id),
			teachers: list,
			teacher_nama: list.map((t) => t.nama).join(', ') || r.teacher_nama || null,
			classes: []
		};
	});
}

export async function createSubject(data: { kode: string; nama: string; teacher_id: number | null; teacher_ids?: number[]; class_ids: number[] }): Promise<number> {
	const p = await pool();
	const primaryTeacherId = data.teacher_ids && data.teacher_ids.length ? data.teacher_ids[0] : data.teacher_id;
	const [res] = await p.query<any>('INSERT INTO subjects (kode, nama, teacher_id) VALUES (?,?,?)', [data.kode ?? '', data.nama, primaryTeacherId]);
	const id = Number(res.insertId);

	for (const cid of data.class_ids ?? []) {
		await p.query('INSERT INTO subject_classes (subject_id, class_id) VALUES (?,?)', [id, cid]);
	}

	const allTeacherIds = data.teacher_ids && data.teacher_ids.length ? data.teacher_ids : primaryTeacherId ? [primaryTeacherId] : [];
	for (const tid of allTeacherIds) {
		await p.query('INSERT IGNORE INTO subject_teachers (subject_id, teacher_id) VALUES (?,?)', [id, tid]);
	}
	return id;
}

export async function updateSubject(id: number, data: Partial<Subject> & { teacher_ids?: number[]; class_ids?: number[] }) {
	const p = await pool();
	const [rows] = await p.query<any[]>('SELECT * FROM subjects WHERE id=?', [id]);
	const cur = rows[0];
	if (!cur) throw new Error('Mata pelajaran tidak ditemukan');

	const primaryTeacherId = data.teacher_ids !== undefined ? (data.teacher_ids[0] ?? null) : data.teacher_id !== undefined ? data.teacher_id : cur.teacher_id;

	await p.query('UPDATE subjects SET kode=?, nama=?, teacher_id=? WHERE id=?', [data.kode ?? cur.kode, data.nama ?? cur.nama, primaryTeacherId, id]);

	if (data.classes || data.class_ids) {
		await p.query('DELETE FROM subject_classes WHERE subject_id=?', [id]);
		const cids = data.class_ids ?? (data.classes ?? []).map((c) => c.id);
		for (const cid of cids) {
			await p.query('INSERT INTO subject_classes (subject_id, class_id) VALUES (?,?)', [id, cid]);
		}
	}

	if (data.teacher_ids !== undefined || data.teachers !== undefined) {
		await p.query('DELETE FROM subject_teachers WHERE subject_id=?', [id]);
		const tids = data.teacher_ids ?? (data.teachers ?? []).map((t) => t.id);
		for (const tid of tids) {
			await p.query('INSERT IGNORE INTO subject_teachers (subject_id, teacher_id) VALUES (?,?)', [id, tid]);
		}
	}
}

export async function deleteSubject(id: number): Promise<void> {
	const p = await pool();
	await p.query('DELETE FROM subjects WHERE id = ?', [id]);
}

// ================================================================ STUDENTS

export interface StudentFilter {
	class_id?: number;
	status?: StudentStatus;
	user?: User | null;
	q?: string;
}

export async function getStudents(filter: StudentFilter = {}): Promise<Student[]> {
	const p = await pool();
	const conds: string[] = [];
	const params: any[] = [];
	const allowed = filter.user ? allowedClassIds(filter.user) : null;

	if (allowed) {
		if (allowed.length === 0) return [];
		conds.push(`s.class_id IN (${allowed.map(() => '?').join(',')})`);
		params.push(...allowed);
	}
	if (filter.class_id) {
		conds.push('s.class_id = ?');
		params.push(filter.class_id);
	}
	if (filter.status) {
		conds.push('s.status = ?');
		params.push(filter.status);
	}
	if (filter.q) {
		conds.push('(LOWER(s.nama) LIKE LOWER(?) OR LOWER(s.nisn) LIKE LOWER(?) OR LOWER(s.nis) LIKE LOWER(?))');
		params.push(`%${filter.q}%`, `%${filter.q}%`, `%${filter.q}%`);
	}

	const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
	const [rows] = await p.query<any[]>(
		`SELECT s.id, s.class_id, c.nama AS class_name, s.nisn, s.nis, s.nama, s.jenis_kelamin,
		        s.tempat_lahir, s.tanggal_lahir, s.alamat, s.no_hp_ortu, s.foto_url, s.status
		 FROM students s JOIN classes c ON c.id = s.class_id
		 ${where} ORDER BY c.tingkat, c.nama, s.nama`,
		params
	);

	return rows.map((r) => ({
		id: Number(r.id),
		class_id: Number(r.class_id),
		class_name: r.class_name,
		nisn: r.nisn ?? '',
		nis: r.nis ?? '',
		nama: r.nama,
		jenis_kelamin: r.jenis_kelamin,
		tempat_lahir: r.tempat_lahir ?? '',
		tanggal_lahir: r.tanggal_lahir ?? '',
		alamat: r.alamat ?? '',
		no_hp_ortu: r.no_hp_ortu ?? '',
		foto_url: r.foto_url ?? '',
		status: r.status
	}));
}

export async function getStudent(id: number): Promise<Student | null> {
	const p = await pool();
	const [rows] = await p.query<any[]>(
		`SELECT s.id, s.class_id, c.nama AS class_name, s.nisn, s.nis, s.nama, s.jenis_kelamin,
		        s.tempat_lahir, s.tanggal_lahir, s.alamat, s.no_hp_ortu, s.foto_url, s.status
		 FROM students s JOIN classes c ON c.id = s.class_id WHERE s.id=?`,
		[id]
	);
	if (!rows[0]) return null;
	const r = rows[0];
	return {
		id: Number(r.id),
		class_id: Number(r.class_id),
		class_name: r.class_name,
		nisn: r.nisn ?? '',
		nis: r.nis ?? '',
		nama: r.nama,
		jenis_kelamin: r.jenis_kelamin,
		tempat_lahir: r.tempat_lahir ?? '',
		tanggal_lahir: r.tanggal_lahir ?? '',
		alamat: r.alamat ?? '',
		no_hp_ortu: r.no_hp_ortu ?? '',
		foto_url: r.foto_url ?? '',
		status: r.status
	};
}

export async function createStudent(data: Omit<Student, 'id' | 'class_name'>) {
	const p = await pool();
	const [res] = await p.query<any>(
		`INSERT INTO students (class_id, nisn, nis, nama, jenis_kelamin, tempat_lahir, tanggal_lahir, alamat, no_hp_ortu, foto_url, status)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		[
			data.class_id,
			data.nisn ?? '',
			data.nis ?? '',
			data.nama,
			data.jenis_kelamin,
			data.tempat_lahir ?? '',
			data.tanggal_lahir ?? '',
			data.alamat ?? '',
			data.no_hp_ortu ?? '',
			data.foto_url ?? '',
			data.status ?? 'aktif'
		]
	);
	return res;
}

export async function updateStudent(id: number, data: Partial<Student>) {
	const p = await pool();
	const existing = await getStudent(id);
	if (!existing) throw new Error('Siswa tidak ditemukan');
	const next = { ...existing, ...data };

	await p.query(
		`UPDATE students SET class_id=?, nisn=?, nis=?, nama=?, jenis_kelamin=?, tempat_lahir=?, tanggal_lahir=?, alamat=?, no_hp_ortu=?, foto_url=?, status=?
		 WHERE id=?`,
		[
			next.class_id,
			next.nisn,
			next.nis,
			next.nama,
			next.jenis_kelamin,
			next.tempat_lahir,
			next.tanggal_lahir,
			next.alamat,
			next.no_hp_ortu,
			next.foto_url,
			next.status,
			id
		]
	);
}

export async function deleteStudent(id: number): Promise<void> {
	const p = await pool();
	await p.query('DELETE FROM students WHERE id = ?', [id]);
}

export async function importStudents(
	classId: number,
	students: Array<{ nisn?: string; nis?: string; nama: string; jenis_kelamin: 'L' | 'P'; tempat_lahir?: string; tanggal_lahir?: string; alamat?: string; no_hp_ortu?: string }>
): Promise<number> {
	const p = await pool();
	let count = 0;
	for (const s of students) {
		await p.query(
			`INSERT INTO students (class_id, nisn, nis, nama, jenis_kelamin, tempat_lahir, tanggal_lahir, alamat, no_hp_ortu, status)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'aktif')`,
			[classId, s.nisn ?? '', s.nis ?? '', s.nama, s.jenis_kelamin, s.tempat_lahir ?? '', s.tanggal_lahir ?? '', s.alamat ?? '', s.no_hp_ortu ?? '']
		);
		count++;
	}
	return count;
}

// ================================================================ ATTENDANCE

export async function isHoliday(date: string): Promise<{ libur: boolean; keterangan: string | null }> {
	const p = await pool();
	const [rows] = await p.query<any[]>('SELECT keterangan, tipe FROM academic_calendar WHERE tanggal = ?', [date]);
	if (!rows[0]) return { libur: false, keterangan: null };
	return { libur: rows[0].tipe === 'libur', keterangan: rows[0].keterangan ?? null };
}

export async function getAttendanceByDate(dateStr: string, classIds?: number[] | null): Promise<Map<number, AttendanceRecord>> {
	const p = await pool();
	let sql = `
		SELECT a.id, a.student_id, s.nisn, s.nama, a.tanggal, a.status, a.keterangan, a.bukti_url,
		       COALESCE(u.name, 'Sistem') AS dictatat_oleh, a.updated_at
		FROM attendance_daily a
		JOIN students s ON s.id = a.student_id
		LEFT JOIN users u ON u.id = a.dicatat_oleh
		WHERE a.tanggal = ?
	`;
	const params: any[] = [dateStr];

	if (classIds && classIds.length > 0) {
		sql += ` AND s.class_id IN (${classIds.map(() => '?').join(',')})`;
		params.push(...classIds);
	}

	const [rows] = await p.query<any[]>(sql, params);
	const map = new Map<number, AttendanceRecord>();
	for (const r of rows) {
		map.set(Number(r.student_id), {
			id: Number(r.id),
			student_id: Number(r.student_id),
			nisn: r.nisn ?? '',
			nama: r.nama,
			tanggal: r.tanggal,
			status: r.status,
			keterangan: r.keterangan ?? '',
			bukti_url: r.bukti_url ?? '',
			dictatat_oleh: r.dictatat_oleh,
			updated_at: r.updated_at ? new Date(r.updated_at).toISOString() : ''
		});
	}
	return map;
}

export async function upsertAttendance(dateStr: string, classId: number, entries: AttendanceEntry[], user: User): Promise<number> {
	const p = await pool();
	const students = await getStudents({ class_id: classId, status: 'aktif' });
	const studentIds = new Set(students.map((s) => s.id));
	const validStatuses: AttendanceStatus[] = ['hadir', 'sakit', 'izin', 'alpa', 'terlambat'];

	let count = 0;
	for (const e of entries) {
		if (!studentIds.has(e.student_id)) continue;
		if (!validStatuses.includes(e.status)) continue;

		const [existingRows] = await p.query<any[]>('SELECT id, status FROM attendance_daily WHERE student_id = ? AND tanggal = ?', [e.student_id, dateStr]);
		const old = existingRows[0];

		await p.query(
			`INSERT INTO attendance_daily (student_id, tanggal, status, keterangan, bukti_url, dicatat_oleh)
			 VALUES (?, ?, ?, ?, ?, ?)
			 ON DUPLICATE KEY UPDATE status=VALUES(status), keterangan=VALUES(keterangan), bukti_url=VALUES(bukti_url), dicatat_oleh=VALUES(dicatat_oleh)`,
			[e.student_id, dateStr, e.status, e.keterangan ?? '', e.bukti_url ?? '', user.id]
		);

		if (!old || old.status !== e.status) {
			const [current] = await p.query<any[]>('SELECT id FROM attendance_daily WHERE student_id = ? AND tanggal = ?', [e.student_id, dateStr]);
			const attId = current[0] ? Number(current[0].id) : null;
			await p.query(
				`INSERT INTO attendance_logs (attendance_id, student_id, tanggal, user_id, old_status, new_status)
				 VALUES (?, ?, ?, ?, ?, ?)`,
				[attId, e.student_id, dateStr, user.id, old ? old.status : '', e.status]
			);
		}
		count++;
	}
	return count;
}

export async function getAttendanceHistory(user: User, filters: { class_id?: number; startDate?: string; endDate?: string; status?: AttendanceStatus; student_name?: string }): Promise<any[]> {
	const p = await pool();
	const allowed = allowedClassIds(user);

	let sql = `
		SELECT a.id, a.student_id, a.tanggal, a.status, a.keterangan, a.bukti_url, a.created_at,
		       s.nama AS student_name, s.nisn, c.nama AS class_name
		FROM attendance_daily a
		JOIN students s ON s.id = a.student_id
		JOIN classes c ON c.id = s.class_id
	`;
	const whereClauses: string[] = [];
	const params: any[] = [];

	if (filters.class_id) {
		whereClauses.push('s.class_id = ?');
		params.push(filters.class_id);
	}
	if (filters.startDate) {
		whereClauses.push('a.tanggal >= ?');
		params.push(filters.startDate);
	}
	if (filters.endDate) {
		whereClauses.push('a.tanggal <= ?');
		params.push(filters.endDate);
	}
	if (filters.status) {
		whereClauses.push('a.status = ?');
		params.push(filters.status);
	}
	if (filters.student_name) {
		whereClauses.push('LOWER(s.nama) LIKE LOWER(?)');
		params.push(`%${filters.student_name}%`);
	}
	if (allowed !== null) {
		if (allowed.length === 0) return [];
		whereClauses.push(`s.class_id IN (${allowed.map(() => '?').join(',')})`);
		params.push(...allowed);
	}

	if (whereClauses.length > 0) {
		sql += ' WHERE ' + whereClauses.join(' AND ');
	}
	sql += ' ORDER BY a.tanggal DESC, s.nama LIMIT 500';

	const [rows] = await p.query<any[]>(sql, params);
	return rows.map((r) => ({
		id: Number(r.id),
		student_id: Number(r.student_id),
		student_name: r.student_name,
		nisn: r.nisn ?? '',
		class_name: r.class_name,
		tanggal: r.tanggal,
		status: r.status,
		keterangan: r.keterangan ?? '',
		bukti_url: r.bukti_url ?? ''
	}));
}

export async function getAttendanceLogs(user: User, filters: { class_id?: number; startDate?: string; endDate?: string }): Promise<any[]> {
	const p = await pool();
	const allowed = allowedClassIds(user);

	let sql = `
		SELECT l.id, l.attendance_id, l.student_id, l.tanggal, l.user_id, l.old_status, l.new_status, l.changed_at,
		       s.nama AS student_name, u.name AS user_name
		FROM attendance_logs l
		JOIN students s ON s.id = l.student_id
		LEFT JOIN users u ON u.id = l.user_id
	`;
	const whereClauses: string[] = [];
	const params: any[] = [];

	if (filters.class_id) {
		whereClauses.push('s.class_id = ?');
		params.push(filters.class_id);
	}
	if (filters.startDate) {
		whereClauses.push('l.tanggal >= ?');
		params.push(filters.startDate);
	}
	if (filters.endDate) {
		whereClauses.push('l.tanggal <= ?');
		params.push(filters.endDate);
	}
	if (allowed !== null) {
		if (allowed.length === 0) return [];
		whereClauses.push(`s.class_id IN (${allowed.map(() => '?').join(',')})`);
		params.push(...allowed);
	}

	if (whereClauses.length > 0) {
		sql += ' WHERE ' + whereClauses.join(' AND ');
	}
	sql += ' ORDER BY l.changed_at DESC LIMIT 200';

	const [rows] = await p.query<any[]>(sql, params);
	return rows.map((r) => ({
		id: Number(r.id),
		student_id: Number(r.student_id),
		student_name: r.student_name,
		user_name: r.user_name ?? 'Sistem',
		tanggal: r.tanggal,
		old_status: r.old_status ?? '',
		new_status: r.new_status,
		changed_at: r.changed_at ? new Date(r.changed_at).toISOString() : ''
	}));
}

// ================================================================ SUBJECT ATTENDANCE

export async function getAttendanceSubjectByDate(dateStr: string, classId: number, subjectId: number, jamKe: number): Promise<Map<number, { id: number; student_id: number; status: AttendanceStatus; keterangan: string }>> {
	const p = await pool();
	const [rows] = await p.query<any[]>(
		`SELECT id, student_id, status, keterangan FROM attendance_subject
		 WHERE tanggal=? AND class_id=? AND subject_id=? AND jam_ke=?`,
		[dateStr, classId, subjectId, jamKe]
	);
	const map = new Map<number, { id: number; student_id: number; status: AttendanceStatus; keterangan: string }>();
	for (const r of rows) {
		const sid = Number(r.student_id);
		map.set(sid, { id: Number(r.id), student_id: sid, status: r.status, keterangan: r.keterangan ?? '' });
	}
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
	const p = await pool();
	const students = await getStudents({ class_id: classId, status: 'aktif' });
	const studentIds = new Set(students.map((s) => s.id));
	const validStatuses: AttendanceStatus[] = ['hadir', 'sakit', 'izin', 'alpa', 'terlambat'];

	let count = 0;
	for (const e of entries) {
		if (!studentIds.has(e.student_id)) continue;
		if (!validStatuses.includes(e.status)) continue;
		await p.query(
			`INSERT INTO attendance_subject (student_id, subject_id, class_id, tanggal, jam_ke, status, keterangan, dicatat_oleh)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?)
			 ON DUPLICATE KEY UPDATE status=VALUES(status), keterangan=VALUES(keterangan), dicatat_oleh=VALUES(dicatat_oleh)`,
			[e.student_id, subjectId, classId, dateStr, jamKe, e.status, e.keterangan ?? '', user.id]
		);
		count++;
	}
	return count;
}

// ================================================================ JOURNALS

export interface JournalFilter {
	class_id?: number;
	from?: string;
	to?: string;
	user?: User | null;
}

export async function getJournals(filter: JournalFilter = {}): Promise<JournalEntry[]> {
	const p = await pool();
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
	const [rows] = await p.query<any[]>(
		`SELECT j.id, j.class_id, c.nama AS class_name, j.tanggal, j.subject_id, sb.nama AS subject_name,
		        j.materi, j.kegiatan, j.kendala, j.catatan, u.name AS dicatat_oleh
		 FROM class_journals j
		 JOIN classes c ON c.id = j.class_id
		 LEFT JOIN subjects sb ON sb.id = j.subject_id
		 LEFT JOIN users u ON u.id = j.dicatat_oleh
		 ${where} ORDER BY j.tanggal DESC, j.id DESC LIMIT 300`,
		params
	);

	return rows.map((r) => ({
		id: Number(r.id),
		class_id: Number(r.class_id),
		class_name: r.class_name,
		tanggal: r.tanggal,
		subject_id: r.subject_id ? Number(r.subject_id) : null,
		subject_name: r.subject_name ?? null,
		materi: r.materi ?? '',
		kegiatan: r.kegiatan ?? '',
		kendala: r.kendala ?? '',
		catatan: r.catatan ?? '',
		dicatat_oleh: r.dicatat_oleh ?? null
	}));
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
	const p = await pool();
	const [res] = await p.query<any>(
		`INSERT INTO class_journals (class_id, tanggal, subject_id, materi, kegiatan, kendala, catatan, dicatat_oleh)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
		[data.class_id, data.tanggal ?? todayStr(), data.subject_id, data.materi, data.kegiatan, data.kendala, data.catatan, data.user_id]
	);
	return Number(res.insertId);
}

export async function updateJournal(id: number, data: Partial<Omit<JournalEntry, 'id'>>, user_id: number): Promise<void> {
	const p = await pool();
	const [rows] = await p.query<any[]>('SELECT * FROM class_journals WHERE id=?', [id]);
	const cur = rows[0];
	if (!cur) throw new Error('Jurnal tidak ditemukan');

	await p.query(
		`UPDATE class_journals SET class_id=?, tanggal=?, subject_id=?, materi=?, kegiatan=?, kendala=?, catatan=?, dicatat_oleh=? WHERE id=?`,
		[
			data.class_id ?? cur.class_id,
			data.tanggal ?? cur.tanggal,
			data.subject_id !== undefined ? data.subject_id : cur.subject_id,
			data.materi ?? cur.materi,
			data.kegiatan ?? cur.kegiatan,
			data.kendala ?? cur.kendala,
			data.catatan ?? cur.catatan,
			user_id,
			id
		]
	);
}

export async function deleteJournal(id: number): Promise<void> {
	const p = await pool();
	await p.query('DELETE FROM class_journals WHERE id = ?', [id]);
}

// ================================================================ HOLIDAYS

export async function getHolidays(limit = 50): Promise<Holiday[]> {
	const p = await pool();
	const [rows] = await p.query<any[]>('SELECT id, tanggal, keterangan, tipe FROM academic_calendar ORDER BY tanggal DESC LIMIT ?', [limit]);
	return rows.map((r) => ({
		id: Number(r.id),
		tanggal: r.tanggal,
		keterangan: r.keterangan ?? '',
		tipe: r.tipe
	}));
}

export async function getUpcomingHolidays(limit = 5): Promise<Holiday[]> {
	const p = await pool();
	const [rows] = await p.query<any[]>(
		`SELECT id, tanggal, keterangan, tipe FROM academic_calendar
		 WHERE tanggal >= ? AND tipe='libur' ORDER BY tanggal ASC LIMIT ?`,
		[todayStr(), limit]
	);
	return rows.map((r) => ({
		id: Number(r.id),
		tanggal: r.tanggal,
		keterangan: r.keterangan ?? '',
		tipe: r.tipe
	}));
}

export async function upsertHoliday(data: { tanggal: string; keterangan: string; tipe: string }) {
	const p = await pool();
	await p.query(
		`INSERT INTO academic_calendar (tanggal, keterangan, tipe) VALUES (?, ?, ?)
		 ON DUPLICATE KEY UPDATE keterangan=VALUES(keterangan), tipe=VALUES(tipe)`,
		[data.tanggal, data.keterangan, data.tipe]
	);
}

export async function deleteHoliday(id: number): Promise<void> {
	const p = await pool();
	await p.query('DELETE FROM academic_calendar WHERE id = ?', [id]);
}

// ================================================================ REPORTS

export async function getReportSummary(opts: { class_id?: number; from: string; to: string; user?: User | null }): Promise<{
	rows: ReportRow[];
	class_name: string | null;
}> {
	const p = await pool();
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
	const [rows] = await p.query<any[]>(
		`SELECT s.id AS student_id, s.nisn, s.nis, s.nama, s.class_id, c.nama AS class_name,
		        SUM(CASE WHEN a.status='hadir' THEN 1 ELSE 0 END) AS hadir,
		        SUM(CASE WHEN a.status='sakit' THEN 1 ELSE 0 END) AS sakit,
		        SUM(CASE WHEN a.status='izin' THEN 1 ELSE 0 END) AS izin,
		        SUM(CASE WHEN a.status='alpa' THEN 1 ELSE 0 END) AS alpa,
		        SUM(CASE WHEN a.status='terlambat' THEN 1 ELSE 0 END) AS terlambat,
		        COUNT(*) AS total
		 FROM attendance_daily a JOIN students s ON s.id = a.student_id JOIN classes c ON c.id = s.class_id
		 WHERE ${where} GROUP BY s.id ORDER BY c.tingkat, c.nama, s.nama`,
		params
	);

	const result: ReportRow[] = rows.map((r) => {
		const tot = Number(r.total);
		const alpa = Number(r.alpa);
		return {
			student_id: Number(r.student_id),
			nisn: r.nisn ?? '',
			nis: r.nis ?? '',
			nama: r.nama,
			hadir: Number(r.hadir),
			sakit: Number(r.sakit),
			izin: Number(r.izin),
			alpa: Number(r.alpa),
			terlambat: Number(r.terlambat),
			total: tot,
			persentase: tot > 0 ? Math.round(((tot - alpa) / tot) * 1000) / 10 : 0
		};
	});

	const className = opts.class_id ? (await getClass(opts.class_id))?.nama ?? null : null;
	return { rows: result, class_name: className };
}

export async function getAttendanceMatrix(opts: {
	class_id?: number;
	from: string;
	to: string;
	user?: User | null;
	student_ids?: number[];
}): Promise<MatrixReport> {
	const p = await pool();
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

	const [dateRows] = await p.query<any[]>(
		`SELECT DISTINCT a.tanggal FROM attendance_daily a
		 JOIN students s ON s.id = a.student_id
		 WHERE ${where} ORDER BY a.tanggal ASC`,
		params
	);
	const dates = dateRows.map((r) => r.tanggal as string);

	const [attRows] = await p.query<any[]>(
		`SELECT a.student_id, a.tanggal, a.status FROM attendance_daily a
		 JOIN students s ON s.id = a.student_id
		 WHERE ${where} ORDER BY s.nama`,
		params
	);

	const byStudent = new Map<number, Record<string, AttendanceStatus>>();
	for (const r of attRows) {
		const sid = Number(r.student_id);
		if (!byStudent.has(sid)) byStudent.set(sid, {});
		byStudent.get(sid)![r.tanggal] = r.status;
	}

	const studentFilter: StudentFilter = {};
	if (opts.class_id) studentFilter.class_id = opts.class_id;
	if (allowed) studentFilter.user = opts.user;
	const allStudents = await getStudents({ ...studentFilter, status: 'aktif' });
	const students = opts.student_ids?.length ? allStudents.filter((s) => opts.student_ids!.includes(s.id)) : allStudents;

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

	const className = opts.class_id ? (await getClass(opts.class_id))?.nama ?? null : null;
	return { dates, rows, per_date: perDateStats, class_name: className };
}

export async function getSubjectAttendanceMatrix(opts: {
	class_id?: number;
	subject_id?: number;
	from: string;
	to: string;
	user?: User | null;
}): Promise<MatrixReport> {
	const p = await pool();
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

	const dates = ['1', '2', '3', '4', '5', '6', '7', '8'];
	const [attRows] = await p.query<any[]>(
		`SELECT a.student_id, a.tanggal, a.jam_ke, a.status FROM attendance_subject a WHERE ${where} ORDER BY a.tanggal ASC`,
		params
	);
	const byStudent = new Map<number, Record<string, AttendanceStatus>>();
	for (const r of attRows) {
		const j = Number(r.jam_ke);
		if (!Number.isInteger(j) || j < 1 || j > 8) continue;
		const jam = String(j);
		const sid = Number(r.student_id);
		if (!byStudent.has(sid)) byStudent.set(sid, {});
		byStudent.get(sid)![jam] = r.status;
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

	const className = opts.class_id ? (await getClass(opts.class_id))?.nama ?? null : null;
	let subjectName: string | null = null;
	if (opts.subject_id) {
		const [subjRows] = await p.query<any[]>('SELECT nama FROM subjects WHERE id = ?', [opts.subject_id]);
		subjectName = subjRows[0]?.nama ?? null;
	}
	return { dates, rows, per_date: perDateStats, class_name: className, subject_name: subjectName };
}

// ================================================================ DASHBOARD & ALERTS

export async function getAlerts(): Promise<AlertItem[]> {
	const p = await pool();
	const thresholdStr = await getSetting('alpa_threshold', '3');
	const threshold = Number(thresholdStr) || 3;
	const year = new Date().getFullYear();

	const [rows] = await p.query<any[]>(
		`SELECT s.id AS student_id, s.nama, s.nisn, c.nama AS class_name, COUNT(*) AS alpa_count
		 FROM attendance_daily a
		 JOIN students s ON s.id = a.student_id
		 JOIN classes c ON c.id = s.class_id
		 WHERE a.status='alpa' AND a.tanggal >= ? AND s.status='aktif'
		 GROUP BY s.id, s.nama, s.nisn, c.nama
		 HAVING alpa_count >= ?
		 ORDER BY alpa_count DESC`,
		[`${year}-01-01`, threshold]
	);
	return rows.map((r) => ({
		student_id: Number(r.student_id),
		nama: r.nama,
		nisn: r.nisn ?? '',
		class_name: r.class_name,
		alpa_count: Number(r.alpa_count),
		threshold
	}));
}

export async function getDashboard(user: User): Promise<DashboardSummary> {
	const p = await pool();
	const tanggal = todayStr();
	const holiday = await isHoliday(tanggal);
	const classes = await getClasses(user);
	const classIds = classes.map((c) => c.id);

	const counts: Record<string, number> = { hadir: 0, sakit: 0, izin: 0, alpa: 0, terlambat: 0 };
	let dicatat = 0;

	const perKelas: DashboardSummary['per_kelas'] = [];
	for (const c of classes) {
		const map = await getAttendanceByDate(tanggal, [c.id]);
		const students = await getStudents({ class_id: c.id, status: 'aktif' });
		const k = { class_id: c.id, class_name: c.nama, hadir: 0, sakit: 0, izin: 0, alpa: 0, terlambat: 0, belum_dicatat: 0, total: 0 };
		for (const s of students) {
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
		perKelas.push(k);
	}

	const totalSiswa = perKelas.reduce((sum, k) => sum + k.total, 0);
	const alerts = user.role === 'guru_mapel' ? [] : await getAlerts();

	const monthStart = `${tanggal.slice(0, 7)}-01`;
	const bulanIni = { hadir: 0, sakit: 0, izin: 0, alpa: 0, terlambat: 0, total: 0 };
	let monthRows: any[] = [];
	if (classIds.length > 0) {
		const [mRows] = await p.query<any[]>(
			`SELECT a.status, s.class_id FROM attendance_daily a
			 JOIN students s ON s.id = a.student_id
			 WHERE a.tanggal BETWEEN ? AND ? AND s.class_id IN (${classIds.map(() => '?').join(',')})`,
			[monthStart, tanggal, ...classIds]
		);
		monthRows = mRows;
	}

	const perKelasMonth = new Map<number, { hadir: number; sakit: number; izin: number; alpa: number; terlambat: number; total: number }>();
	for (const r of monthRows) {
		if (r.status in bulanIni) bulanIni[r.status as keyof typeof bulanIni]++;
		bulanIni.total++;
		const cid = Number(r.class_id);
		if (!cid) continue;
		const k = perKelasMonth.get(cid) ?? { hadir: 0, sakit: 0, izin: 0, alpa: 0, terlambat: 0, total: 0 };
		if (r.status in k) k[r.status as keyof typeof k]++;
		k.total++;
		perKelasMonth.set(cid, k);
	}

	const bulanIniPerKelas = classes.map((c) => {
		const k = perKelasMonth.get(c.id) ?? { hadir: 0, sakit: 0, izin: 0, alpa: 0, terlambat: 0, total: 0 };
		return { class_id: c.id, class_name: c.nama, ...k };
	});

	const trend: { tanggal: string; hadir: number; sakit: number; izin: number; alpa: number; terlambat: number; total: number }[] = [];
	for (let i = 10; i >= 0; i--) {
		const d = addDays(tanggal, -i);
		if (d > tanggal) continue;
		const dow = new Date(`${d}T00:00:00`).getDay();
		if (dow === 0 || dow === 6) continue;
		const hol = await isHoliday(d);
		if (hol.libur) continue;

		const t = { tanggal: d, hadir: 0, sakit: 0, izin: 0, alpa: 0, terlambat: 0, total: 0 };
		const map = await getAttendanceByDate(d, classIds.length ? classIds : null);
		const activeStudents = await getStudents({ user, status: 'aktif' });

		for (const s of activeStudents) {
			const rec = map.get(s.id);
			if (rec) {
				t[rec.status as keyof typeof t]++;
				t.total++;
			}
		}
		trend.push(t);
		if (trend.length === 7) break;
	}

	const hariIniAbsen: { student_id: number; nama: string; class_name: string; status: AttendanceStatus; keterangan: string }[] = [];
	const todayMap = await getAttendanceByDate(tanggal, classIds.length ? classIds : null);
	const activeStudents = await getStudents({ user, status: 'aktif' });
	for (const s of activeStudents) {
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

	const holidays = await getUpcomingHolidays(5);

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

// ================================================================ ACADEMIC PERIODS

export async function getAcademicPeriods(): Promise<AcademicPeriod[]> {
	const p = await pool();
	const [rows] = await p.query<any[]>('SELECT id, tahun_ajaran, semester, aktif FROM academic_periods ORDER BY tahun_ajaran DESC, semester DESC');
	return rows.map((r) => ({
		id: Number(r.id),
		tahun_ajaran: r.tahun_ajaran,
		semester: r.semester,
		aktif: Boolean(r.aktif)
	}));
}

export async function addAcademicPeriod(tahun_ajaran: string, semester: string): Promise<void> {
	const p = await pool();
	await p.query(
		`INSERT INTO academic_periods (tahun_ajaran, semester, aktif) VALUES (?, ?, 0)
		 ON DUPLICATE KEY UPDATE id=id`,
		[tahun_ajaran, semester]
	);
}

export async function setActivePeriod(tahun_ajaran: string, semester: string): Promise<void> {
	const p = await pool();
	await p.query('UPDATE academic_periods SET aktif = 0');
	await p.query('UPDATE academic_periods SET aktif = 1 WHERE tahun_ajaran = ? AND semester = ?', [tahun_ajaran, semester]);
	await updateSchool({ tahun_ajaran_aktif: tahun_ajaran, semester_aktif: semester });
}
