import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import * as XLSX from 'xlsx';
import { requireUser } from '$lib/server/auth';
import { assertCanManageStudents } from '$lib/server/rbac';
import { importStudents } from '$lib/server/data';

export const POST: RequestHandler = async (event) => {
	const user = await requireUser(event);
	const form = await event.request.formData().catch(() => null);
	if (!form) throw error(400, 'Form tidak valid');
	const class_id = Number(form.get('class_id'));
	const file = form.get('file');
	if (!class_id) throw error(400, 'Pilih kelas tujuan terlebih dahulu');
	assertCanManageStudents(user, class_id);
	if (!(file instanceof File)) throw error(400, 'File Excel wajib diunggah');

	const buf = Buffer.from(await file.arrayBuffer());
	let rows: any[];
	try {
		const wb = XLSX.read(buf, { type: 'buffer' });
		const ws = wb.Sheets[wb.SheetNames[0]];
		rows = XLSX.utils.sheet_to_json(ws, { defval: '' });
	} catch {
		throw error(400, 'File tidak dapat dibaca. Pastikan formatnya .xlsx atau .xls');
	}
	if (rows.length === 0) throw error(400, 'File kosong atau tidak ada baris data');

	const result = await importStudents(class_id, rows);
	return json(result, { status: 201 });
};
