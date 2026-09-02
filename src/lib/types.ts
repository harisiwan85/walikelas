export type Role = 'admin' | 'kepala_sekolah' | 'wali_kelas' | 'guru_mapel';

export const ROLES: Record<Role, string> = {
	admin: 'Admin',
	kepala_sekolah: 'Kepala Sekolah',
	wali_kelas: 'Wali Kelas',
	guru_mapel: 'Guru Mapel'
};

export type AttendanceStatus = 'hadir' | 'sakit' | 'izin' | 'alpa' | 'terlambat';

export const STATUS_LABEL: Record<AttendanceStatus, string> = {
	hadir: 'Hadir',
	sakit: 'Sakit',
	izin: 'Izin',
	alpa: 'Alpa',
	terlambat: 'Terlambat'
};

export const STATUS_COLOR: Record<AttendanceStatus, string> = {
	hadir: 'emerald',
	sakit: 'amber',
	izin: 'sky',
	alpa: 'rose',
	terlambat: 'orange'
};

export type StudentStatus = 'aktif' | 'pindah' | 'lulus' | 'keluar';

export interface User {
	id: number;
	username: string | null;
	email: string;
	name: string;
	role: Role;
	teacher_id: number | null;
	class_id: number | null;
	class_name: string | null;
	foto_url: string;
}

export interface School {
	id: number;
	nama: string;
	npsn: string;
	alamat: string;
	logo_url: string;
	kepala_sekolah: string;
	tahun_ajaran_aktif: string;
	semester_aktif: string;
	alpa_threshold: number;
}

export interface ClassRow {
	id: number;
	nama: string;
	tingkat: number;
	tahun_ajaran: string;
	wali_kelas_id: number | null;
	wali_kelas_nama: string | null;
	jumlah_siswa: number;
}

export interface Student {
	id: number;
	class_id: number;
	class_name: string;
	nisn: string;
	nis: string;
	nama: string;
	jenis_kelamin: 'L' | 'P';
	tempat_lahir: string;
	tanggal_lahir: string;
	alamat: string;
	no_hp_ortu: string;
	foto_url: string;
	status: StudentStatus;
}

export interface Teacher {
	id: number;
	kode: string;
	nip: string;
	nuptk: string;
	nama: string;
	jabatan: string;
	kontak: string;
	foto_url?: string;
	user_id: number | null;
	username: string | null;
	user_email: string | null;
	user_role: string | null;
}

export interface AcademicPeriod {
	id: number;
	tahun_ajaran: string;
	semester: string;
	aktif: boolean;
}

export interface Subject {
	id: number;
	kode: string;
	nama: string;
	teacher_id: number | null;
	teacher_nama: string | null;
	classes: { id: number; nama: string }[];
}

export interface AttendanceRecord {
	id: number;
	student_id: number;
	nisn: string;
	nama: string;
	tanggal: string;
	status: AttendanceStatus;
	keterangan: string;
	bukti_url: string;
	dictatat_oleh: string;
	updated_at: string;
}

export interface AttendanceEntry {
	student_id: number;
	status: AttendanceStatus;
	keterangan?: string;
	bukti_url?: string;
}

export interface ReportRow {
	student_id: number;
	nisn: string;
	nis: string;
	nama: string;
	hadir: number;
	sakit: number;
	izin: number;
	alpa: number;
	terlambat: number;
	total: number;
	persentase: number;
}

export interface AlertItem {
	student_id: number;
	nama: string;
	nisn: string;
	class_name: string;
	alpa_count: number;
	threshold: number;
}	export interface DashboardSummary {
	tanggal: string;
	libur: boolean;
	keterangan_libur: string | null;
	hadir: number;
	sakit: number;
	izin: number;
	alpa: number;
	terlambat: number;
	belum_dicatat: number;
	total_siswa: number;
	/** Statistik absensi bulan berjalan (untuk chart donat). */
	bulan_ini: { hadir: number; sakit: number; izin: number; alpa: number; terlambat: number; total: number };
	/** Statistik absensi bulan berjalan per kelas (untuk mini donat). */
	bulan_ini_per_kelas: {
		class_id: number;
		class_name: string;
		hadir: number;
		sakit: number;
		izin: number;
		alpa: number;
		terlambat: number;
		total: number;
	}[];
	per_kelas: {
		class_id: number;
		class_name: string;
		hadir: number;
		sakit: number;
		izin: number;
		alpa: number;
		terlambat: number;
		belum_dicatat: number;
		total: number;
	}[];
	alerts: AlertItem[];
	trend: {
		tanggal: string;
		hadir: number;
		sakit: number;
		izin: number;
		alpa: number;
		terlambat: number;
		total: number;
	}[];
	hariIniAbsen: {
		student_id: number;
		nama: string;
		class_name: string;
		status: AttendanceStatus;
		keterangan: string;
	}[];
	holidays: Holiday[];
}

export interface Holiday {
	id: number;
	tanggal: string;
	keterangan: string;
	tipe: 'libur' | 'aktif';
}

export interface JournalEntry {
	id: number;
	class_id: number;
	class_name: string;
	tanggal: string;
	subject_id: number | null;
	subject_name: string | null;
	materi: string;
	kegiatan: string;
	kendala: string;
	catatan: string;
	dicatat_oleh: string | null;
}

export interface SubjectAttendanceRow {
	student_id: number;
	nisn: string;
	nama: string;
	status: AttendanceStatus;
	keterangan: string;
}	export interface MatrixReport {
	dates: string[];
	rows: {
		student_id: number;
		nisn: string;
		nama: string;
		class_name: string;
		per_date: Record<string, AttendanceStatus>;
		hadir: number;
		sakit: number;
		izin: number;
		alpa: number;
		terlambat: number;
		total: number;
		persentase: number;
	}[];
	/** Statistik agregat per tanggal (untuk baris % Kehadiran per tanggal). */
	per_date: Record<string, { hadir: number; sakit: number; izin: number; alpa: number; terlambat: number; total: number; persentase: number }>;
	class_name: string | null;
	subject_name?: string | null;
}
