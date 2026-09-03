import { hashPassword } from './auth';
import { getMysqlPool, initMysqlTables } from './mysql';
import { addDays, todayStr } from '$lib/date';
import type { AttendanceStatus } from '$lib/types';

const FIRST = [
	'Ahmad', 'Budi', 'Citra', 'Dewi', 'Eko', 'Fitri', 'Galih', 'Hana', 'Indah', 'Joko',
	'Kirana', 'Lukman', 'Maya', 'Nadia', 'Oscar', 'Putri', 'Rizky', 'Siti', 'Taufik', 'Umi',
	'Vina', 'Wahyu', 'Yuni', 'Zaki', 'Adi', 'Bayu', 'Cahya', 'Dimas', 'Elsa', 'Fajar',
	'Gita', 'Hendra', 'Intan', 'Jihan', 'Krisna', 'Laila', 'Mila', 'Nanda', 'Okta', 'Puri'
];

const LAST = [
	'Saputra', 'Wijaya', 'Pratama', 'Hidayat', 'Nugroho', 'Santoso', 'Rahayu', 'Kusuma',
	'Permata', 'Utami', 'Ramadhan', 'Sari', 'Putra', 'Lestari', 'Anggraini', 'Setiawan',
	'Firmansyah', 'Mulyani', 'Hartono', 'Yuliana', 'Purnama', 'Handayani', 'Susanti', 'Maulana'
];

function pickName(i: number): { nama: string; jk: 'L' | 'P' } {
	const f = FIRST[i % FIRST.length];
	const l = LAST[(i * 7 + 3) % LAST.length];
	const femaleIdx = new Set([2, 3, 5, 7, 8, 10, 12, 13, 15, 18, 20, 22, 23, 25, 27, 28, 30, 32, 33, 35, 36, 38, 39]);
	const jk = femaleIdx.has(i % FIRST.length) ? 'P' : 'L';
	return { nama: `${f} ${l}`, jk };
}

function pickDate(i: number): string {
	const y = 2012 + (i % 4);
	const m = String((i % 12) + 1).padStart(2, '0');
	const d = String((i % 28) + 1).padStart(2, '0');
	return `${y}-${m}-${d}`;
}

const CITIES = ['Jakarta', 'Bandung', 'Bogor', 'Depok', 'Tangerang', 'Bekasi', 'Surabaya', 'Semarang'];

export async function seedMysqlIfEmpty() {
	await initMysqlTables();
	const p = getMysqlPool();

	const [userRows] = await p.query<any[]>('SELECT COUNT(*) AS c FROM users');
	if (Number(userRows[0]?.c ?? 0) > 0) return;

	console.log('[seed-mysql] Memulai inisialisasi data contoh pada MySQL Remote...');

	// --- sekolah
	await p.query(
		`INSERT INTO schools (nama, npsn, alamat, kepala_sekolah, tahun_ajaran_aktif, semester_aktif)
		 VALUES ('SMP Negeri 1 Harapan Jaya', '20219876', 'Jl. Pendidikan No. 1, Kec. Sukamaju, Kota Harapan', 'Drs. Bambang Sutrisno, M.Pd.', '2026/2027', 'Ganjil')`
	);

	// --- guru
	const teachers = [
		['196512121988031002', '9933756657120002', 'Drs. Bambang Sutrisno, M.Pd.', 'kepala_sekolah', '081234567801'],
		['197503152005011004', '9944766655220001', 'Pak Budi Santoso, S.Kom.', 'admin', '081234567802'],
		['198204122010012001', '9955887712340001', 'Bu Siti Rahayu, S.Pd.', 'wali_kelas', '081234567803'],
		['198807232012021001', '9966778899000012', 'Pak Anto Wijaya, S.Pd.', 'guru_mapel', '081234567804'],
		['199001102014022002', '9977889900110023', 'Bu Dewi Lestari, S.Pd.', 'wali_kelas', '081234567805'],
		['199205152015031003', '9988990011220034', 'Pak Rizky Pratama, S.Pd.', 'guru_mapel', '081234567806']
	];
	const teacherIds: number[] = [];
	for (const t of teachers) {
		const [res] = await p.query<any>(
			'INSERT INTO teachers (school_id, nip, nuptk, nama, jabatan, kontak) VALUES (1, ?, ?, ?, ?, ?)',
			[t[0], t[1], t[2], t[3], t[4]]
		);
		teacherIds.push(Number(res.insertId));
	}

	// --- kelas
	const classRows: { id: number; nama: string }[] = [];
	const classDefs: [string, number, number | null][] = [
		['7A', 7, teacherIds[2]],
		['7B', 7, teacherIds[3]],
		['8A', 8, teacherIds[4]]
	];
	for (const [nama, tingkat, wali] of classDefs) {
		const [res] = await p.query<any>(
			'INSERT INTO classes (school_id, nama, tingkat, tahun_ajaran, wali_kelas_id) VALUES (1, ?, ?, "2026/2027", ?)',
			[nama, tingkat, wali]
		);
		classRows.push({ id: Number(res.insertId), nama });
	}

	// --- siswa
	const students: { id: number; class_id: number; nisn: string }[] = [];
	let sIdx = 0;
	for (const cl of classRows) {
		for (let i = 0; i < 30; i++) {
			const { nama, jk } = pickName(sIdx);
			const nisn = `00${26000000 + sIdx}`;
			const nis = `26${String(sIdx + 1).padStart(4, '0')}`;
			const tgl = pickDate(sIdx);
			const kota = CITIES[sIdx % CITIES.length];
			const [res] = await p.query<any>(
				`INSERT INTO students (class_id, nisn, nis, nama, jenis_kelamin, tempat_lahir, tanggal_lahir, alamat, no_hp_ortu, status)
				 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'aktif')`,
				[cl.id, nisn, nis, nama, jk, kota, tgl, `Jl. Siswa No. ${i + 1}, RT 0${(i % 5) + 1}/RW 02, ${kota}`, `08${String(1234000000 + sIdx).slice(0, 10)}`]
			);
			students.push({ id: Number(res.insertId), class_id: cl.id, nisn });
			sIdx++;
		}
	}

	// --- mata pelajaran
	const subjects = [
		['MTK', 'Matematika', teacherIds[3]],
		['IPA', 'Ilmu Pengetahuan Alam', teacherIds[5]],
		['BIN', 'Bahasa Indonesia', teacherIds[2]],
		['BIG', 'Bahasa Inggris', teacherIds[4]],
		['PAI', 'Pendidikan Agama Islam', teacherIds[0]]
	];
	for (const [kode, nama, tId] of subjects) {
		const [res] = await p.query<any>('INSERT INTO subjects (kode, nama, teacher_id) VALUES (?, ?, ?)', [kode, nama, tId]);
		const sId = Number(res.insertId);
		for (const cl of classRows) {
			await p.query('INSERT INTO subject_classes (subject_id, class_id) VALUES (?, ?)', [sId, cl.id]);
		}
	}

	// --- akun pengguna
	const passHash = hashPassword('admin123');
	await p.query(
		'INSERT INTO users (username, email, password_hash, name, role, teacher_id, class_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
		['admin', 'admin@sekolah.sch.id', passHash, 'Pak Budi Santoso, S.Kom.', 'admin', teacherIds[1], null]
	);
	await p.query(
		'INSERT INTO users (username, email, password_hash, name, role, teacher_id, class_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
		['kepsek', 'kepsek@sekolah.sch.id', passHash, 'Drs. Bambang Sutrisno, M.Pd.', 'kepala_sekolah', teacherIds[0], null]
	);
	await p.query(
		'INSERT INTO users (username, email, password_hash, name, role, teacher_id, class_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
		['wali7a', 'wali7a@sekolah.sch.id', passHash, 'Bu Siti Rahayu, S.Pd.', 'wali_kelas', teacherIds[2], classRows[0].id]
	);
	await p.query(
		'INSERT INTO users (username, email, password_hash, name, role, teacher_id, class_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
		['wali7b', 'wali7b@sekolah.sch.id', passHash, 'Pak Anto Wijaya, S.Pd.', 'wali_kelas', teacherIds[3], classRows[1].id]
	);
	await p.query(
		'INSERT INTO users (username, email, password_hash, name, role, teacher_id, class_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
		['guru_ipa', 'guru.ipa@sekolah.sch.id', passHash, 'Pak Rizky Pratama, S.Pd.', 'guru_mapel', teacherIds[5], null]
	);

	// --- kalender akademik
	await p.query('INSERT IGNORE INTO academic_calendar (tanggal, keterangan, tipe) VALUES (?, ?, ?)', ['2026-08-17', 'Hari Kemerdekaan RI ke-81', 'libur']);
	await p.query('INSERT IGNORE INTO academic_calendar (tanggal, keterangan, tipe) VALUES (?, ?, ?)', ['2026-10-01', 'Hari Kesaktian Pancasila (Upacara)', 'aktif']);
	await p.query('INSERT IGNORE INTO academic_calendar (tanggal, keterangan, tipe) VALUES (?, ?, ?)', ['2026-12-25', 'Hari Raya Natal', 'libur']);

	// --- riwayat absensi harian
	const statuses: AttendanceStatus[] = ['hadir', 'hadir', 'hadir', 'hadir', 'hadir', 'hadir', 'hadir', 'hadir', 'hadir', 'hadir', 'sakit', 'izin', 'terlambat'];
	for (let d = -30; d <= 0; d++) {
		const date = addDays(todayStr(), d);
		const dayOfWeek = new Date(date + 'T00:00:00').getDay();
		if (dayOfWeek === 0 || dayOfWeek === 6) continue;
		for (let i = 0; i < students.length; i++) {
			const st = students[i];
			if (i === 5 && (d === -1 || d === -2 || d === -5)) {
				await p.query(
					`INSERT IGNORE INTO attendance_daily (student_id, tanggal, status, keterangan, dicatat_oleh)
					 VALUES (?, ?, 'alpa', 'Tanpa keterangan', 3)`,
					[st.id, date]
				);
				continue;
			}
			const rnd = (i * 13 + d * 7 + 1000) % statuses.length;
			const status = statuses[rnd];
			await p.query(
				`INSERT IGNORE INTO attendance_daily (student_id, tanggal, status, keterangan, dicatat_oleh)
				 VALUES (?, ?, ?, ?, 3)`,
				[st.id, date, status, status === 'hadir' ? '' : `Catatan ${status}`]
			);
		}
	}

	// --- riwayat absensi mapel
	for (let d = -7; d <= 0; d++) {
		const date = addDays(todayStr(), d);
		const dayOfWeek = new Date(date + 'T00:00:00').getDay();
		if (dayOfWeek === 0 || dayOfWeek === 6) continue;
		const class7AStudents = students.filter((s) => s.class_id === classRows[0].id);
		for (let i = 0; i < class7AStudents.length; i++) {
			const st = class7AStudents[i];
			const rnd = (i * 11 + d * 3 + 500) % statuses.length;
			const status = statuses[rnd];
			await p.query(
				`INSERT IGNORE INTO attendance_subject (student_id, subject_id, class_id, tanggal, jam_ke, status, keterangan, dicatat_oleh)
				 VALUES (?, 1, ?, ?, 1, ?, '', 4)`,
				[st.id, classRows[0].id, date, status]
			);
			await p.query(
				`INSERT IGNORE INTO attendance_subject (student_id, subject_id, class_id, tanggal, jam_ke, status, keterangan, dicatat_oleh)
				 VALUES (?, 2, ?, ?, 3, ?, '', 5)`,
				[st.id, classRows[0].id, date, status]
			);
		}
	}

	// --- jurnal kelas
	for (let d = -5; d <= 0; d++) {
		const date = addDays(todayStr(), d);
		const dayOfWeek = new Date(date + 'T00:00:00').getDay();
		if (dayOfWeek === 0 || dayOfWeek === 6) continue;
		await p.query(
			`INSERT INTO class_journals (class_id, tanggal, subject_id, materi, kegiatan, kendala, catatan, dicatat_oleh)
			 VALUES (?, ?, 1, 'Bab 2 Aljabar — Penyederhanaan Bentuk Aljabar', 'Diskusi kelompok dan latihan soal 1-10 di LKS', 'Sebagian siswa masih bingung tanda negatif', 'Kelas kondusif dan aktif', 3)`,
			[classRows[0].id, date]
		);
		await p.query(
			`INSERT INTO class_journals (class_id, tanggal, subject_id, materi, kegiatan, kendala, catatan, dicatat_oleh)
			 VALUES (?, ?, 2, 'Bab 2 Klasifikasi Makhluk Hidup', 'Pengamatan preparat tumbuhan menggunakan mikroskop', 'Jumlah mikroskop terbatas sehingga bergantian', 'Siswa sangat antusias saat praktikum', 5)`,
			[classRows[0].id, date]
		);
	}

	// --- periode akademik
	await p.query('INSERT IGNORE INTO academic_periods (tahun_ajaran, semester, aktif) VALUES ("2026/2027", "Ganjil", 1)');
	await p.query('INSERT IGNORE INTO academic_periods (tahun_ajaran, semester, aktif) VALUES ("2026/2027", "Genap", 0)');

	console.log('[seed-mysql] Data contoh MySQL berhasil dibuat.');
}
