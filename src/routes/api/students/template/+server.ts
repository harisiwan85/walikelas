import * as XLSX from 'xlsx';
import type { RequestHandler } from './$types';
import { requireRole } from '$lib/server/auth';

export const GET: RequestHandler = async (event) => {
	await requireRole(event, ['admin']);
	const rows = [
		{
			nisn: '001234567890',
			nis: '202600001',
			nama: 'Contoh Siswa',
			jenis_kelamin: 'L',
			tempat_lahir: 'Jakarta',
			tanggal_lahir: '14/08/2013',
			alamat: 'Jl. Contoh No. 1',
			no_hp_ortu: '081234567890',
			status: 'aktif'
		}
	];
	const wb = XLSX.utils.book_new();
	const ws = XLSX.utils.json_to_sheet(rows);
	ws['!cols'] = [{ wch: 14 }, { wch: 12 }, { wch: 24 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 28 }, { wch: 16 }, { wch: 10 }];
	XLSX.utils.book_append_sheet(wb, ws, 'Siswa');
	const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

	return new Response(buf, {
		headers: {
			'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
			'Content-Disposition': 'attachment; filename="template-siswa.xlsx"'
		}
	});
};
