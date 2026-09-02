import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { hashPassword, requireRole } from '$lib/server/auth';
import { isSupabase } from '$lib/server/data';
import { createUserAccount, findUserByTeacherId, getTeachers, updateUserAccount } from '$lib/server/data';
import { classIdForRole, roleFromJabatan, slugUsername } from '$lib/server/accounts';

export const PUT: RequestHandler = async (event) => {
	await requireRole(event, ['admin']);
	const teacher_id = Number(event.params.id);
	const teachers = await getTeachers();
	const teacher = teachers.find((t) => t.id === teacher_id);
	if (!teacher) throw error(404, 'Guru tidak ditemukan');

	const body = await event.request.json().catch(() => null);
	if (!body) throw error(400, 'Body tidak valid');

	const username = String(body.username ?? '').trim() || slugUsername(teacher.nama);
	const email = String(body.email ?? '').trim() || `${username}@sekolah.sch.id`.toLowerCase();
	const role = body.role && ['admin', 'kepala_sekolah', 'wali_kelas', 'guru_mapel'].includes(body.role) ? body.role : roleFromJabatan(teacher.jabatan);
	const password = body.password ? String(body.password) : '';

	let account = await findUserByTeacherId(teacher_id);

	if (!account) {
		const class_id = await classIdForRole(role as any, teacher.id);
		const hash = password ? hashPassword(password) : null;
		const userId = await createUserAccount({
			username,
			email,
			password_hash: hash,
			name: teacher.nama,
			role,
			teacher_id: teacher.id,
			class_id
		});
		// Mode Supabase: buat juga akun di Supabase Auth agar password bisa dipakai login
		if (isSupabase && password) {
			const { getSupabase } = await import('$lib/server/data/supabase');
			const { data, error: err } = await getSupabase().auth.admin.createUser({
				email,
				password,
				email_confirm: true,
				user_metadata: { name: teacher.nama, username }
			});
			if (!err && data?.user) {
				await updateUserAccount(userId, { username, email, role, password_hash: undefined });
				await getSupabase().from('users').update({ auth_id: data.user.id }).eq('id', userId);
			}
		}
		account = await findUserByTeacherId(teacher_id);
	} else {
		await updateUserAccount(account.id, {
			username,
			email,
			role,
			password_hash: password ? hashPassword(password) : undefined
		});
		if (isSupabase && password) {
			const { getSupabase } = await import('$lib/server/data/supabase');
			const authId = await (await import('$lib/server/data')).authGetAuthId(account.id);
			if (authId) {
				const { error: err } = await getSupabase().auth.admin.updateUserById(authId, { password });
				if (err) throw new Error('Gagal memperbarui password Supabase: ' + err.message);
			}
		}
		account = await findUserByTeacherId(teacher_id);
	}
	if (!account) throw error(500, 'Gagal menyimpan akun');

	// Role akun yang diubah manual ikut menyinkronkan jabatan di tabel guru
	const { updateTeacher } = await import('$lib/server/data');
	await updateTeacher(teacher_id, { jabatan: role });

	return json({ ok: true, account: { id: account.id, username: account.username, email: account.email, role: account.role } });
};
