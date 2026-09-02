import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { verifyShareToken } from '$lib/server/share';
import { getAttendanceMatrix, getSchool } from '$lib/server/data';

export const load: PageServerLoad = async ({ params }) => {
	const result = verifyShareToken(params.token);
	if (!result.ok) {
		if (result.reason === 'expired') {
			throw error(410, 'Link laporan telah kedaluwarsa. Minta link baru kepada wali kelas/guru.');
		}
		throw error(400, 'Link laporan tidak valid atau telah diubah.');
	}
	const payload = result.payload;
	const [matrix, school] = await Promise.all([
		getAttendanceMatrix({
			from: payload.from,
			to: payload.to,
			class_id: payload.class_id,
			student_ids: payload.student_ids
		}),
		getSchool()
	]);
	return {
		matrix,
		school,
		from: payload.from,
		to: payload.to,
		expires_at: payload.expires_at,
		class_name: payload.class_name ?? null,
		wali_kelas: payload.wali_kelas ?? null
	};
};
