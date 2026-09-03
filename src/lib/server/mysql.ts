import mysql from 'mysql2/promise';
import { env } from '$env/dynamic/private';

let pool: mysql.Pool | null = null;

export function getMysqlPool(): mysql.Pool {
	if (!pool) {
		const host = env.MYSQL_HOST || process.env.MYSQL_HOST || '51.79.231.14';
		const port = Number(env.MYSQL_PORT || process.env.MYSQL_PORT || 3306);
		const user = env.MYSQL_USER || process.env.MYSQL_USER || 'printsek';
		const password = env.MYSQL_PASSWORD || process.env.MYSQL_PASSWORD || 'BLKH80-3zhtd7:';
		const database = env.MYSQL_DATABASE || process.env.MYSQL_DATABASE || 'printsek_walikelas';

		pool = mysql.createPool({
			host,
			port,
			user,
			password,
			database,
			waitForConnections: true,
			connectionLimit: 10,
			queueLimit: 0,
			decimalNumbers: true
		});
	}
	return pool;
}

let initDone = false;

export async function initMysqlTables() {
	if (initDone) return;
	const p = getMysqlPool();

	const ddlStatements = [
		`CREATE TABLE IF NOT EXISTS schools (
			id INT AUTO_INCREMENT PRIMARY KEY,
			nama VARCHAR(255) NOT NULL DEFAULT '',
			npsn VARCHAR(50) DEFAULT '',
			alamat TEXT,
			logo_url VARCHAR(500) DEFAULT '',
			kepala_sekolah VARCHAR(255) DEFAULT '',
			tahun_ajaran_aktif VARCHAR(20) DEFAULT '2026/2027',
			semester_aktif VARCHAR(20) DEFAULT 'Ganjil',
			alpa_threshold INT NOT NULL DEFAULT 3,
			created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
		)`,
		`CREATE TABLE IF NOT EXISTS teachers (
			id INT AUTO_INCREMENT PRIMARY KEY,
			school_id INT NOT NULL DEFAULT 1,
			kode VARCHAR(50) DEFAULT '',
			nip VARCHAR(50) DEFAULT '',
			nuptk VARCHAR(50) DEFAULT '',
			nama VARCHAR(255) NOT NULL,
			jabatan VARCHAR(50) DEFAULT 'guru_mapel',
			kontak VARCHAR(50) DEFAULT '',
			created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			FOREIGN KEY (school_id) REFERENCES schools(id)
		)`,
		`CREATE TABLE IF NOT EXISTS classes (
			id INT AUTO_INCREMENT PRIMARY KEY,
			school_id INT NOT NULL DEFAULT 1,
			nama VARCHAR(100) NOT NULL,
			tingkat INT NOT NULL,
			tahun_ajaran VARCHAR(20) NOT NULL DEFAULT '2026/2027',
			wali_kelas_id INT,
			created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			FOREIGN KEY (school_id) REFERENCES schools(id),
			FOREIGN KEY (wali_kelas_id) REFERENCES teachers(id)
		)`,
		`CREATE TABLE IF NOT EXISTS students (
			id INT AUTO_INCREMENT PRIMARY KEY,
			class_id INT NOT NULL,
			nisn VARCHAR(50) DEFAULT '',
			nis VARCHAR(50) DEFAULT '',
			nama VARCHAR(255) NOT NULL,
			jenis_kelamin ENUM('L', 'P') NOT NULL DEFAULT 'L',
			tempat_lahir VARCHAR(100) DEFAULT '',
			tanggal_lahir VARCHAR(50) DEFAULT '',
			alamat TEXT,
			no_hp_ortu VARCHAR(50) DEFAULT '',
			foto_url TEXT,
			status ENUM('aktif', 'pindah', 'lulus', 'keluar') NOT NULL DEFAULT 'aktif',
			created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			FOREIGN KEY (class_id) REFERENCES classes(id),
			INDEX idx_students_class (class_id),
			INDEX idx_students_status (status)
		)`,
		`CREATE TABLE IF NOT EXISTS subjects (
			id INT AUTO_INCREMENT PRIMARY KEY,
			kode VARCHAR(50) DEFAULT '',
			nama VARCHAR(255) NOT NULL,
			teacher_id INT,
			created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			FOREIGN KEY (teacher_id) REFERENCES teachers(id)
		)`,
		`CREATE TABLE IF NOT EXISTS subject_classes (
			subject_id INT NOT NULL,
			class_id INT NOT NULL,
			PRIMARY KEY (subject_id, class_id),
			FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE,
			FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE
		)`,
		`CREATE TABLE IF NOT EXISTS subject_teachers (
			subject_id INT NOT NULL,
			teacher_id INT NOT NULL,
			PRIMARY KEY (subject_id, teacher_id),
			FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE,
			FOREIGN KEY (teacher_id) REFERENCES teachers(id) ON DELETE CASCADE
		)`,
		`CREATE TABLE IF NOT EXISTS users (
			id INT AUTO_INCREMENT PRIMARY KEY,
			auth_id VARCHAR(255),
			username VARCHAR(100) UNIQUE,
			email VARCHAR(255) NOT NULL UNIQUE,
			password_hash VARCHAR(255),
			name VARCHAR(255) NOT NULL,
			role ENUM('admin', 'kepala_sekolah', 'wali_kelas', 'guru_mapel') NOT NULL,
			teacher_id INT,
			class_id INT,
			foto_url TEXT,
			created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			FOREIGN KEY (teacher_id) REFERENCES teachers(id),
			FOREIGN KEY (class_id) REFERENCES classes(id)
		)`,
		`CREATE TABLE IF NOT EXISTS sessions (
			token VARCHAR(255) PRIMARY KEY,
			user_id INT NOT NULL,
			expires_at VARCHAR(100) NOT NULL,
			created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
		)`,
		`CREATE TABLE IF NOT EXISTS attendance_daily (
			id INT AUTO_INCREMENT PRIMARY KEY,
			student_id INT NOT NULL,
			tanggal VARCHAR(20) NOT NULL,
			status ENUM('hadir', 'sakit', 'izin', 'alpa', 'terlambat') NOT NULL,
			keterangan TEXT,
			bukti_url TEXT,
			dicatat_oleh INT,
			created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
			UNIQUE KEY unq_student_tanggal (student_id, tanggal),
			FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
			FOREIGN KEY (dicatat_oleh) REFERENCES users(id),
			INDEX idx_attendance_date (tanggal),
			INDEX idx_attendance_student (student_id)
		)`,
		`CREATE TABLE IF NOT EXISTS attendance_subject (
			id INT AUTO_INCREMENT PRIMARY KEY,
			student_id INT NOT NULL,
			subject_id INT NOT NULL,
			class_id INT NOT NULL,
			tanggal VARCHAR(20) NOT NULL,
			jam_ke INT NOT NULL DEFAULT 1,
			status ENUM('hadir', 'sakit', 'izin', 'alpa', 'terlambat') NOT NULL,
			keterangan TEXT,
			dicatat_oleh INT,
			created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
			UNIQUE KEY unq_att_subj (student_id, subject_id, tanggal, jam_ke),
			FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
			FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE,
			FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE,
			FOREIGN KEY (dicatat_oleh) REFERENCES users(id),
			INDEX idx_att_subject_date (tanggal),
			INDEX idx_att_subject_subj (subject_id, tanggal)
		)`,
		`CREATE TABLE IF NOT EXISTS attendance_logs (
			id INT AUTO_INCREMENT PRIMARY KEY,
			attendance_id INT,
			student_id INT NOT NULL,
			tanggal VARCHAR(20) NOT NULL,
			user_id INT,
			old_status VARCHAR(50) DEFAULT '',
			new_status VARCHAR(50) NOT NULL,
			changed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			FOREIGN KEY (attendance_id) REFERENCES attendance_daily(id) ON DELETE SET NULL,
			FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
			FOREIGN KEY (user_id) REFERENCES users(id)
		)`,
		`CREATE TABLE IF NOT EXISTS academic_calendar (
			id INT AUTO_INCREMENT PRIMARY KEY,
			tanggal VARCHAR(20) NOT NULL UNIQUE,
			keterangan TEXT,
			tipe ENUM('libur', 'aktif') NOT NULL DEFAULT 'libur',
			created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
		)`,
		`CREATE TABLE IF NOT EXISTS class_journals (
			id INT AUTO_INCREMENT PRIMARY KEY,
			class_id INT NOT NULL,
			tanggal VARCHAR(20) NOT NULL,
			subject_id INT,
			materi TEXT,
			kegiatan TEXT,
			kendala TEXT,
			catatan TEXT,
			dicatat_oleh INT,
			created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
			FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE,
			FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE SET NULL,
			FOREIGN KEY (dicatat_oleh) REFERENCES users(id),
			INDEX idx_journal_class (class_id, tanggal)
		)`,
		`CREATE TABLE IF NOT EXISTS academic_periods (
			id INT AUTO_INCREMENT PRIMARY KEY,
			tahun_ajaran VARCHAR(50) NOT NULL,
			semester VARCHAR(20) NOT NULL DEFAULT 'Ganjil',
			aktif INT NOT NULL DEFAULT 0,
			UNIQUE KEY unq_period (tahun_ajaran, semester)
		)`,
		`CREATE TABLE IF NOT EXISTS settings (
			\`key\` VARCHAR(100) PRIMARY KEY,
			\`value\` TEXT NOT NULL
		)`
	];

	for (const stmt of ddlStatements) {
		await p.query(stmt);
	}

	initDone = true;
}
