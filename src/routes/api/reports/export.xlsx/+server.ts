import * as XLSXNS from 'xlsx-js-style';
import type { RequestHandler } from './$types';

// Interop CJS/ESM: di SSR namespace-nya bisa berupa { default: module.exports }
const XLSX: typeof XLSXNS = (XLSXNS as any).default ?? XLSXNS;
import { requireUser } from '$lib/server/auth';
import { getAttendanceMatrix, getClass, getSchool } from '$lib/server/data';
import { formatDateShort } from '$lib/date';

const LETTER: Record<string, string> = { hadir: 'H', sakit: 'S', izin: 'I', alpa: 'A', terlambat: 'T' };
const DAYS = ['M', 'S', 'S', 'R', 'K', 'J', 'S']; // Minggu..Sabtu

function dayLetter(dateStr: string): string {
	const [y, m, d] = dateStr.split('-').map(Number);
	return DAYS[new Date(y, m - 1, d).getDay()];
}

/** Gaya sel header tabel: latar biru, teks putih tebal. */
const HDR_STYLE = {
	fill: { fgColor: { rgb: 'FF2563EB' } },
	font: { bold: true, color: { rgb: 'FFFFFFFF' } }
};

export const GET: RequestHandler = async (event) => {
	const user = await requireUser(event);
	const url = event.url;
	const from = url.searchParams.get('from') ?? '';
	const to = url.searchParams.get('to') ?? '';
	const class_id = url.searchParams.get('class_id') ? Number(url.searchParams.get('class_id')) : undefined;
	const { dates, rows, per_date, class_name } = await getAttendanceMatrix({ class_id, from, to, user });
	const school = await getSchool();

	// Kop atas: nama sekolah, judul, periode (satu judul saja)
	const kop = [
		[school.nama],
		[`Rekap Absensi ${class_name ? `Kelas ${class_name}` : 'Semua Kelas'}`],
		[`Periode ${formatDateShort(from)} s/d ${formatDateShort(to)}`],
		[]
	];

	// Header tabel dua baris: baris atas = No, Nama, huruf hari, H S I A T %;
	// baris bawah = angka tanggal di kolom atasnya
	const headerRow1 = ['No', 'Nama', ...dates.map(dayLetter), 'H', 'S', 'I', 'A', 'T', '%'];
	const headerRow2 = ['', '', ...dates.map((d) => String(Number(d.split('-')[2]))), '', '', '', '', '', ''];

	const body = rows.map((r, i) => [
		i + 1,
		r.nama,
		...dates.map((d) => LETTER[r.per_date[d]] ?? '-'),
		r.hadir,
		r.sakit,
		r.izin,
		r.alpa,
		r.terlambat,
		Math.round(r.persentase)
	]);

	// Baris % kehadiran per tanggal
	const footer = [
		'',
		'% Kehadiran',
		...dates.map((d) => {
			const st = per_date[d];
			return st ? `${Math.round(st.persentase)}%` : '-';
		}),
		'',
		'',
		'',
		'',
		'',
		''
	];

	// Tanda tangan: wali kelas (kiri) & kepala sekolah (kanan) saat laporan per kelas
	const waliNama = class_id ? ((await getClass(class_id))?.wali_kelas_nama ?? null) : null;
	const totalCols = 2 + dates.length + 6;
	const lastCol = totalCols - 1;
	const sigRow = (left: string, right: string | null) => {
		const r = Array(totalCols).fill('');
		r[0] = left;
		if (right) r[lastCol] = right;
		return r;
	};
	const kosong = () => Array(totalCols).fill('');
	const sigRows: string[][] = [kosong()];
	if (waliNama) {
		sigRows.push(sigRow('Mengetahui,', 'Mengetahui,'));
		sigRows.push(kosong(), kosong()); // ruang tanda tangan
		sigRows.push(sigRow(waliNama, school.kepala_sekolah || '________________________'));
		sigRows.push(sigRow('Wali Kelas', 'Kepala Sekolah'));
	} else {
		sigRows.push(sigRow('Diketahui oleh,', null));
		sigRows.push(kosong(), kosong());
		sigRows.push(sigRow(school.kepala_sekolah || '________________________', null));
		sigRows.push(sigRow('Kepala Sekolah', null));
	}

	const ws = XLSX.utils.aoa_to_sheet([...kop, headerRow1, headerRow2, ...body, ...(dates.length ? [footer] : []), ...sigRows]);
	ws['!cols'] = [
		{ wch: 4 }, // No — kecil
		{ wch: 28 }, // Nama
		...dates.map(() => ({ wch: 5 })), // tanggal — sempit
		{ wch: 4 },
		{ wch: 4 },
		{ wch: 4 },
		{ wch: 4 },
		{ wch: 4 },
		{ wch: 6 }
	];

	// Latar warna pada dua baris judul tabel
	const headerStart = kop.length; // 4
	for (let r = headerStart; r < headerStart + 2; r++) {
		for (let c = 0; c < totalCols; c++) {
			const addr = XLSX.utils.encode_cell({ r, c });
			if (!ws[addr]) ws[addr] = { t: 'z' };
			ws[addr].s = { ...HDR_STYLE, alignment: { horizontal: c === 1 ? 'left' : 'center' } };
		}
	}

	const wb = XLSX.utils.book_new();
	XLSX.utils.book_append_sheet(wb, ws, 'Rekap Absensi');
	const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

	const filename = `rekap-absensi-${from}_${to}${class_name ? '-' + class_name : ''}.xlsx`;
	return new Response(buf, {
		headers: {
			'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
			'Content-Disposition': `attachment; filename="${filename}"`
		}
	});
};
