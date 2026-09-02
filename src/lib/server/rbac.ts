import type { User } from '$lib/types';

/** Daftar class id yang boleh diakses user (wali: kelasnya sendiri; lainnya: null = semua). */
export function allowedClassIds(user: User): number[] | null {
	if (user.role === 'admin' || user.role === 'kepala_sekolah') return null;
	if (user.role === 'wali_kelas') return user.class_id ? [user.class_id] : [];
	return null; // guru_mapel: baca semua (read-only)
}

export function canWriteAttendance(user: User): boolean {
	return user.role === 'admin' || user.role === 'wali_kelas';
}

/** Guru mapel dapat mencatat absensi per jam pelajaran (mapel yang diampunya). */
export function canWriteSubjectAttendance(user: User): boolean {
	return user.role === 'admin' || user.role === 'wali_kelas' || user.role === 'guru_mapel';
}

export function canManageMaster(user: User): boolean {
	return user.role === 'admin';
}

/** Admin, kepala sekolah, dan wali kelas boleh mengelola data siswa. */
export function canManageStudents(user: User): boolean {
	return user.role === 'admin' || user.role === 'kepala_sekolah' || user.role === 'wali_kelas';
}

/** Wali kelas hanya boleh mengelola siswa di kelasnya sendiri. */
export function assertCanManageStudents(user: User, classId: number | null | undefined): void {
	if (!canManageStudents(user)) {
		throw new Error('Anda tidak berhak mengelola data siswa');
	}
	if (user.role === 'wali_kelas' && classId && user.class_id && classId !== user.class_id) {
		throw new Error('Wali kelas hanya dapat mengelola siswa di kelasnya sendiri');
	}
}
