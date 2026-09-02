import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import type { RequestHandler } from './$types';
import { requireUser } from '$lib/server/auth';
import { getAttendanceMatrix, getClass, getSchool } from '$lib/server/data';
import { formatDateShort } from '$lib/date';

const LETTER: Record<string, string> = { hadir: 'H', sakit: 'S', izin: 'I', alpa: 'A', terlambat: 'T' };
const DAYS = ['M', 'S', 'S', 'R', 'K', 'J', 'S']; // Minggu..Sabtu

function dayLetter(dateStr: string): string {
	const [y, m, d] = dateStr.split('-').map(Number);
	return DAYS[new Date(y, m - 1, d).getDay()];
}

const DARK = rgb(0.15, 0.15, 0.15);
const GRAY = rgb(0.45, 0.45, 0.45);
const WHITE = rgb(1, 1, 1);
const BLUE = rgb(0.25, 0.35, 0.75);
const LIGHT = rgb(0.93, 0.94, 0.98);

export const GET: RequestHandler = async (event) => {
	const user = await requireUser(event);
	const url = event.url;
	const from = url.searchParams.get('from') ?? '';
	const to = url.searchParams.get('to') ?? '';
	const class_id = url.searchParams.get('class_id') ? Number(url.searchParams.get('class_id')) : undefined;
	const { dates, rows, per_date, class_name } = await getAttendanceMatrix({ class_id, from, to, user });
	const school = await getSchool();

	const pdf = await PDFDocument.create();
	const font = await pdf.embedFont(StandardFonts.Helvetica);
	const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

	const margin = 36;
	const pageW = 842; // A4 landscape
	const pageH = 595;
	let page = pdf.addPage([pageW, pageH]);
	let y = pageH - margin;
	let x = margin;

	// Kop atas
	page.drawText(school.nama, { x: margin, y, size: 13, font: bold, color: DARK });
	y -= 16;
	page.drawText(`Laporan Rekap Absensi ${class_name ? `Kelas ${class_name}` : 'Seluruh Kelas'}`, { x: margin, y, size: 10, font: bold, color: DARK });
	y -= 13;
	page.drawText(`Periode: ${formatDateShort(from)} s/d ${formatDateShort(to)}`, { x: margin, y, size: 8, font, color: GRAY });
	y -= 5;
	page.drawLine({ start: { x: margin, y }, end: { x: pageW - margin, y }, thickness: 1, color: rgb(0.7, 0.7, 0.7) });
	y -= 18;

	const colNo = 22;
	const colNama = 130;
	const colStat = 16;
	const colPct = 34;
	const dateArea = pageW - 2 * margin - colNo - colNama - 5 * colStat - colPct;
	const dateW = Math.max(14, Math.min(24, Math.floor(dateArea / Math.max(1, dates.length))));
	const totalW = colNo + colNama + dateW * dates.length + 5 * colStat + colPct;
	const rowH = 15;

	const center = (text: string, size: number, colW: number, fontIn: typeof bold = bold) => {
		const tw = fontIn.widthOfTextAtSize(text, size);
		return x + (colW - tw) / 2;
	};

	const hdrH = 13; // tinggi tiap baris judul tabel
	const drawTableHeader = () => {
		x = margin;
		// Latar biru digambar DULU, teks putih sesudahnya agar terlihat
		page.drawRectangle({ x: margin, y: y - hdrH * 2, width: totalW, height: hdrH * 2, color: BLUE });

		// Baris atas: No, Nama, huruf hari, H S I A T %
		page.drawText('No', { x: center('No', 8, colNo), y: y - 6, size: 8, font: bold, color: WHITE });
		x += colNo;
		page.drawText('Nama', { x: x + 4, y: y - 6, size: 8, font: bold, color: WHITE });
		x += colNama;
		for (const d of dates) {
			page.drawText(dayLetter(d), { x: center(dayLetter(d), 8, dateW), y: y - 6, size: 8, font: bold, color: WHITE });
			x += dateW;
		}
		for (const s of ['H', 'S', 'I', 'A', 'T']) {
			page.drawText(s, { x: center(s, 8, colStat), y: y - 6, size: 8, font: bold, color: WHITE });
			x += colStat;
		}
		page.drawText('%', { x: center('%', 8, colPct), y: y - 6, size: 8, font: bold, color: WHITE });

		// Baris bawah: angka tanggal tepat di bawah huruf harinya
		x = margin + colNo + colNama;
		for (const d of dates) {
			const num = String(Number(d.split('-')[2]));
			page.drawText(num, { x: center(num, 8, dateW), y: y - hdrH - 5, size: 8, font: bold, color: WHITE });
			x += dateW;
		}
		y -= hdrH * 2 + 8;
	};

	drawTableHeader();

	const cell = (text: string, size = 8, colW = colStat) => {
		page.drawText(text, { x: center(text, size, colW), y: y - 6, size, font, color: DARK });
		x += colW;
	};

	for (let i = 0; i < rows.length; i++) {
		if (y < 70) {
			page = pdf.addPage([pageW, pageH]);
			y = pageH - margin - 6;
			drawTableHeader();
		}
		const r = rows[i];
		x = margin;
		cell(String(i + 1), 8, colNo);
		page.drawText(r.nama, { x: x + 4, y: y - 6, size: 8, font, color: DARK });
		x += colNama;
		for (const d of dates) {
			cell(LETTER[r.per_date[d]] ?? '-', 8, dateW);
		}
		cell(String(r.hadir));
		cell(String(r.sakit));
		cell(String(r.izin));
		cell(String(r.alpa));
		cell(String(r.terlambat));
		cell(`${Math.round(r.persentase)}%`, 8, colPct);
		y -= rowH;
	}

	// Baris % kehadiran per tanggal
	if (dates.length) {
		if (y < 70) {
			page = pdf.addPage([pageW, pageH]);
			y = pageH - margin - 6;
			drawTableHeader();
		}
		x = margin;
		page.drawRectangle({ x: margin, y: y - rowH, width: totalW, height: rowH, color: LIGHT });
		page.drawText('% Kehadiran', { x: x + 4, y: y - 6, size: 8, font: bold, color: DARK });
		x += colNo + colNama;
		for (const d of dates) {
			const st = per_date[d];
			cell(st ? `${Math.round(st.persentase)}%` : '-', 8, dateW);
		}
		y -= rowH;
	}

	y -= 24;
	const waliNama = class_id ? ((await getClass(class_id))?.wali_kelas_nama ?? null) : null;
	const colMid = margin + (pageW - 2 * margin) / 2;
	const namaKepala = school.kepala_sekolah || '________________________';
	if (waliNama) {
		// Tanda tangan dua kolom: wali kelas (kiri) dan kepala sekolah (kanan)
		y -= 34;
		x = margin;
		page.drawText('Mengetahui,', { x, y, size: 9, font });
		page.drawText('Mengetahui,', { x: colMid, y, size: 9, font });
		y -= 30;
		page.drawText(waliNama, { x, y, size: 10, font: bold });
		page.drawText(namaKepala, { x: colMid, y, size: 10, font: bold });
		y -= 14;
		page.drawText('Wali Kelas', { x, y, size: 9, font });
		page.drawText('Kepala Sekolah', { x: colMid, y, size: 9, font });
	} else {
		x = margin;
		page.drawText('Diketahui oleh,', { x, y: y - 8, size: 9, font });
		y -= 30;
		page.drawText(namaKepala, { x, y, size: 10, font: bold });
		y -= 14;
		page.drawText('Kepala Sekolah', { x, y, size: 9, font });
	}

	const buf = await pdf.save();
	return new Response(buf as unknown as BodyInit, {
		headers: {
			'Content-Type': 'application/pdf',
			'Content-Disposition': `attachment; filename="laporan-absensi-${from}_${to}${class_name ? '-' + class_name : ''}.pdf"`
		}
	});
};
