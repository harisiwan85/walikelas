import type { Role, Teacher, User } from '$lib/types';
import { getClasses, findUserByTeacherId, createUserAccount, authGetUserById } from './data';

export function roleFromJabatan(jabatan: string): Role {
	if (jabatan === 'kepala_sekolah') return 'kepala_sekolah';
	if (jabatan === 'admin') return 'admin';
	if (jabatan === 'wali_kelas') return 'wali_kelas';
	return 'guru_mapel';
}

export function slugUsername(nama: string): string {
	const clean = nama
		.replace(/^(Drs|Dra|H|Hj|S\.P d\.|M\.Pd|S\.Kom|S\.Ag|S\.Si|S\.E|A\.Md)\.?/i, '')
		.trim();
	const parts = clean.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(Boolean);
	return (parts.slice(0, 2).join('.') || 'guru').slice(0, 20);
}

/** Kelas yang diampu guru tersebut bila ia wali kelas. */
export async function classIdForRole(role: Role, teacherId: number): Promise<number | null> {
	if (role !== 'wali_kelas') return null;
	const classes = await getClasses();
	return classes.find((c) => c.wali_kelas_id === teacherId)?.id ?? null;
}

/** Ambil akun guru; buat otomatis bila belum ada (untuk impersonasi / akses cepat). */
export async function getOrCreateTeacherAccount(teacher: Teacher): Promise<User> {
	let account = await findUserByTeacherId(teacher.id);
	if (!account) {
		const username = slugUsername(teacher.nama);
		const role = roleFromJabatan(teacher.jabatan);
		const class_id = await classIdForRole(role, teacher.id);
		const email = `${username}@sekolah.sch.id`.toLowerCase();
		await createUserAccount({ username, email, password_hash: null, name: teacher.nama, role, teacher_id: teacher.id, class_id });
		account = await findUserByTeacherId(teacher.id);
	}
	if (!account) throw new Error('Gagal menyiapkan akun guru');
	const { password_hash: _ph, ...u } = account;
	return u as User;
}
