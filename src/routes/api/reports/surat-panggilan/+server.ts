import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import type { RequestHandler } from './$types';
import { requireUser } from '$lib/server/auth';
import { getReportSummary, getSchool, getStudent } from '$lib/server/data';
import { formatDateId, formatDateShort, monthRange } from '$lib/date';

export const GET: RequestHandler = async (event) => {
	const user = await requireUser(event);
	const url = event.url;
	const student_id = Number(url.searchParams.get('student_id') ?? '0');
	const student = await getStudent(student_id);
	if (!student) return new Response('Siswa tidak ditemukan', { status: 404 });

	const school = await getSchool();
	const { from, to } = monthRange(new Date().toISOString().slice(0, 7));
	const { rows } = await getReportSummary({ class_id: student.class_id, from, to, user });
	const row = rows.find((r) => r.student_id === student_id);
	const alpa = row?.alpa ?? 0;

	const pdf = await PDFDocument.create();
	const font = await pdf.embedFont(StandardFonts.Helvetica);
	const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
	const page = pdf.addPage([595, 842]);
	const margin = 60;
	let y = 800;

	const line = (text: string, size = 11, f = font, x = margin) => {
		page.drawText(text, { x, y, size, font: f, color: rgb(0.1, 0.1, 0.1) });
		y -= 16;
	};

	// Kop surat
	line(school.nama.toUpperCase(), 15, bold);
	page.drawLine({ start: { x: margin, y: y - 4 }, end: { x: 535, y: y - 4 }, thickness: 1.5, color: rgb(0.15, 0.25, 0.5) });
	y -= 16;
	line(`NPSN: ${school.npsn || '-'} | ${school.alamat || ''}`, 9);
	y += 6;

	line('SURAT PANGGILAN ORANG TUA/WALI SISWA', 12, bold);
	line(`Nomor: ${String(1000 + student.id)}/SP/SMPN-01/${school.tahun_ajaran_aktif.replace('/', '-')}`, 10);
	y -= 10;

	line(`Kepada Yth. Bapak/Ibu Orang Tua/Wali dari siswa:`, 11);
	y -= 6;
	line(`Nama Siswa      : ${student.nama}`, 11);
	line(`NISN / NIS      : ${student.nisn || '-'} / ${student.nis || '-'}`, 11);
	line(`Kelas            : ${student.class_name}`, 11);
	line(`Alamat          : ${student.alamat || '-'}`, 11);
	line(`No. HP          : ${student.no_hp_ortu || '-'}`, 11);
	y -= 10;

	line('Dengan hormat,', 11);
	line(`Berdasarkan rekapitulasi kehadiran bulan ${formatDateShort(from)} s/d ${formatDateShort(to)}, putra/putri Bapak/Ibu tercatat tidak hadir tanpa keterangan (alpa) sebanyak ${alpa} hari.`, 11);
	line('Kami mengkhawatirkan perkembangan belajar putra/putri Bapak/Ibu dan mohon kesediaan Bapak/Ibu untuk hadir menemui Wali Kelas guna membahas hal tersebut.', 11);
	line(`Hari/Tanggal : ${formatDateId(new Date().toISOString().slice(0, 10))}`, 11);
	line('Waktu : Pukul 09.00 - 12.00 WIB', 11);
	line('Tempat : Ruang Wali Kelas', 11);
	y -= 10;
	line('Demikian surat ini kami sampaikan. Atas perhatian dan kerja samanya, kami ucapkan terima kasih.', 11);

	y = 300;
	line('Mengetahui,', 9);
	line('Kepala Sekolah,', 9);
	y -= 40;
	line(school.kepala_sekolah || '____________________________', 11, bold);
	line('Kepala Sekolah', 9);

	const buf = await pdf.save();
	return new Response(buf as unknown as BodyInit, {
		headers: {
			'Content-Type': 'application/pdf',
			'Content-Disposition': `attachment; filename="surat-panggilan-${student.nama.replace(/\s+/g, '-')}.pdf"`
		}
	});
};
