import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, '../../../data');

let _db: any = null;

export async function getDb() {
	if (_db) return _db;
	const { default: Database } = await import('better-sqlite3');
	mkdirSync(dataDir, { recursive: true });
	_db = new Database(path.join(dataDir, 'wali-kelas.db'));
	_db.pragma('journal_mode = WAL');
	_db.pragma('foreign_keys = ON');

	_db.exec(`
	CREATE TABLE IF NOT EXISTS schools (
	  id INTEGER PRIMARY KEY AUTOINCREMENT,
	  nama TEXT NOT NULL DEFAULT '',
	  npsn TEXT DEFAULT '',
	  alamat TEXT DEFAULT '',
	  logo_url TEXT DEFAULT '',
	  kepala_sekolah TEXT DEFAULT '',
	  tahun_ajaran_aktif TEXT DEFAULT '2026/2027',
	  semester_aktif TEXT DEFAULT 'Ganjil',
	  alpa_threshold INTEGER NOT NULL DEFAULT 3,
	  created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
	);

	CREATE TABLE IF NOT EXISTS teachers (
	  id INTEGER PRIMARY KEY AUTOINCREMENT,
	  school_id INTEGER NOT NULL DEFAULT 1,
	  kode TEXT DEFAULT '',
	  nip TEXT DEFAULT '',
	  nuptk TEXT DEFAULT '',
	  nama TEXT NOT NULL,
	  jabatan TEXT DEFAULT 'guru_mapel',
	  kontak TEXT DEFAULT '',
	  created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
	  FOREIGN KEY (school_id) REFERENCES schools(id)
	);

	CREATE TABLE IF NOT EXISTS classes (
	  id INTEGER PRIMARY KEY AUTOINCREMENT,
	  school_id INTEGER NOT NULL DEFAULT 1,
	  nama TEXT NOT NULL,
	  tingkat INTEGER NOT NULL,
	  tahun_ajaran TEXT NOT NULL DEFAULT '2026/2027',
	  wali_kelas_id INTEGER,
	  created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
	  FOREIGN KEY (school_id) REFERENCES schools(id),
	  FOREIGN KEY (wali_kelas_id) REFERENCES teachers(id)
	);

	CREATE TABLE IF NOT EXISTS students (
	  id INTEGER PRIMARY KEY AUTOINCREMENT,
	  class_id INTEGER NOT NULL,
	  nisn TEXT DEFAULT '',
	  nis TEXT DEFAULT '',
	  nama TEXT NOT NULL,
	  jenis_kelamin TEXT NOT NULL DEFAULT 'L' CHECK (jenis_kelamin IN ('L','P')),
	  tempat_lahir TEXT DEFAULT '',
	  tanggal_lahir TEXT DEFAULT '',
	  alamat TEXT DEFAULT '',
	  no_hp_ortu TEXT DEFAULT '',
	  foto_url TEXT DEFAULT '',
	  status TEXT NOT NULL DEFAULT 'aktif' CHECK (status IN ('aktif','pindah','lulus','keluar')),
	  created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
	  FOREIGN KEY (class_id) REFERENCES classes(id)
	);
	CREATE INDEX IF NOT EXISTS idx_students_class ON students(class_id);
	CREATE INDEX IF NOT EXISTS idx_students_status ON students(status);

	CREATE TABLE IF NOT EXISTS subjects (
	  id INTEGER PRIMARY KEY AUTOINCREMENT,
	  kode TEXT DEFAULT '',
	  nama TEXT NOT NULL,
	  teacher_id INTEGER,
	  created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
	  FOREIGN KEY (teacher_id) REFERENCES teachers(id)
	);

	CREATE TABLE IF NOT EXISTS subject_classes (
	  subject_id INTEGER NOT NULL,
	  class_id INTEGER NOT NULL,
	  PRIMARY KEY (subject_id, class_id),
	  FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE,
	  FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE
	);

	CREATE TABLE IF NOT EXISTS subject_teachers (
	  subject_id INTEGER NOT NULL,
	  teacher_id INTEGER NOT NULL,
	  PRIMARY KEY (subject_id, teacher_id),
	  FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE,
	  FOREIGN KEY (teacher_id) REFERENCES teachers(id) ON DELETE CASCADE
	);

	CREATE TABLE IF NOT EXISTS users (
	  id INTEGER PRIMARY KEY AUTOINCREMENT,
	  auth_id TEXT,
	  username TEXT UNIQUE,
	  email TEXT NOT NULL UNIQUE,
	  password_hash TEXT,
	  name TEXT NOT NULL,
	  role TEXT NOT NULL CHECK (role IN ('admin','kepala_sekolah','wali_kelas','guru_mapel')),
	  teacher_id INTEGER,
	  class_id INTEGER,
	  foto_url TEXT NOT NULL DEFAULT '',
	  created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
	  FOREIGN KEY (teacher_id) REFERENCES teachers(id),
	  FOREIGN KEY (class_id) REFERENCES classes(id)
	);

	CREATE TABLE IF NOT EXISTS sessions (
	  token TEXT PRIMARY KEY,
	  user_id INTEGER NOT NULL,
	  expires_at TEXT NOT NULL,
	  created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
	  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
	);

	CREATE TABLE IF NOT EXISTS attendance_daily (
	  id INTEGER PRIMARY KEY AUTOINCREMENT,
	  student_id INTEGER NOT NULL,
	  tanggal TEXT NOT NULL,
	  status TEXT NOT NULL CHECK (status IN ('hadir','sakit','izin','alpa','terlambat')),
	  keterangan TEXT DEFAULT '',
	  bukti_url TEXT DEFAULT '',
	  dicatat_oleh INTEGER,
	  created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
	  updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
	  UNIQUE (student_id, tanggal),
	  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
	  FOREIGN KEY (dicatat_oleh) REFERENCES users(id)
	);
	CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance_daily(tanggal);
	CREATE INDEX IF NOT EXISTS idx_attendance_student ON attendance_daily(student_id);

	CREATE TABLE IF NOT EXISTS attendance_subject (
	  id INTEGER PRIMARY KEY AUTOINCREMENT,
	  student_id INTEGER NOT NULL,
	  subject_id INTEGER NOT NULL,
	  class_id INTEGER NOT NULL,
	  tanggal TEXT NOT NULL,
	  jam_ke INTEGER NOT NULL DEFAULT 1,
	  status TEXT NOT NULL CHECK (status IN ('hadir','sakit','izin','alpa','terlambat')),
	  keterangan TEXT DEFAULT '',
	  dicatat_oleh INTEGER,
	  created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
	  updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
	  UNIQUE (student_id, subject_id, tanggal, jam_ke),
	  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
	  FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE,
	  FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE,
	  FOREIGN KEY (dicatat_oleh) REFERENCES users(id)
	);
	CREATE INDEX IF NOT EXISTS idx_att_subject_date ON attendance_subject(tanggal);
	CREATE INDEX IF NOT EXISTS idx_att_subject_subj ON attendance_subject(subject_id, tanggal);

	CREATE TABLE IF NOT EXISTS attendance_logs (
	  id INTEGER PRIMARY KEY AUTOINCREMENT,
	  attendance_id INTEGER,
	  student_id INTEGER NOT NULL,
	  tanggal TEXT NOT NULL,
	  user_id INTEGER,
	  old_status TEXT DEFAULT '',
	  new_status TEXT NOT NULL,
	  changed_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
	  FOREIGN KEY (attendance_id) REFERENCES attendance_daily(id) ON DELETE SET NULL,
	  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
	  FOREIGN KEY (user_id) REFERENCES users(id)
	);

	CREATE TABLE IF NOT EXISTS academic_calendar (
	  id INTEGER PRIMARY KEY AUTOINCREMENT,
	  tanggal TEXT NOT NULL UNIQUE,
	  keterangan TEXT DEFAULT '',
	  tipe TEXT NOT NULL DEFAULT 'libur' CHECK (tipe IN ('libur','aktif')),
	  created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
	);

	CREATE TABLE IF NOT EXISTS class_journals (
	  id INTEGER PRIMARY KEY AUTOINCREMENT,
	  class_id INTEGER NOT NULL,
	  tanggal TEXT NOT NULL DEFAULT (date('now', 'localtime')),
	  subject_id INTEGER,
	  materi TEXT DEFAULT '',
	  kegiatan TEXT DEFAULT '',
	  kendala TEXT DEFAULT '',
	  catatan TEXT DEFAULT '',
	  dicatat_oleh INTEGER,
	  created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
	  updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
	  FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE,
	  FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE SET NULL,
	  FOREIGN KEY (dicatat_oleh) REFERENCES users(id)
	);
	CREATE INDEX IF NOT EXISTS idx_journal_class ON class_journals(class_id, tanggal);

	CREATE TABLE IF NOT EXISTS academic_periods (
	  id INTEGER PRIMARY KEY AUTOINCREMENT,
	  tahun_ajaran TEXT NOT NULL,
	  semester TEXT NOT NULL DEFAULT 'Ganjil',
	  aktif INTEGER NOT NULL DEFAULT 0,
	  UNIQUE (tahun_ajaran, semester)
	);

	CREATE TABLE IF NOT EXISTS settings (
	  key TEXT PRIMARY KEY,
	  value TEXT NOT NULL
	);
	`);

	const teacherCols = _db.prepare('PRAGMA table_info(teachers)').all() as { name: string }[];
	if (!teacherCols.some((c: { name: string }) => c.name === 'kode')) {
		_db.exec("ALTER TABLE teachers ADD COLUMN kode TEXT DEFAULT ''");
	}

	return _db;
}

export const db: any = {
	get instance() {
		return _db;
	},
	prepare(...args: Parameters<any>) {
		return _db.prepare(...args);
	},
	exec(...args: Parameters<any>) {
		return _db.exec(...args);
	},
	pragma(...args: Parameters<any>) {
		return _db.pragma(...args);
	},
	transaction<T extends (...args: any[]) => any>(fn: T): T {
		return _db.transaction(fn);
	}
};
