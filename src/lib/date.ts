export function todayStr(d: Date = new Date()): string {
	const y = d.getFullYear();
	const m = String(d.getMonth() + 1).padStart(2, '0');
	const day = String(d.getDate()).padStart(2, '0');
	return `${y}-${m}-${day}`;
}

export function addDays(dateStr: string, days: number): string {
	const d = new Date(`${dateStr}T00:00:00`);
	d.setDate(d.getDate() + days);
	return todayStr(d);
}

export function isWeekend(dateStr: string): boolean {
	const d = new Date(`${dateStr}T00:00:00`);
	const day = d.getDay();
	return day === 0 || day === 6;
}

export function formatDateId(dateStr: string): string {
	if (!dateStr) return '-';
	const d = new Date(`${dateStr}T00:00:00`);
	const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
	const months = [
		'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
		'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
	];
	return `${days[d.getDay()]}, ${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

export function formatDateShort(dateStr: string): string {
	if (!dateStr) return '-';
	const d = new Date(`${dateStr}T00:00:00`);
	const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
	return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

export function monthRange(monthStr: string): { from: string; to: string } {
	const [y, m] = monthStr.split('-').map(Number);
	const from = `${y}-${String(m).padStart(2, '0')}-01`;
	const last = new Date(y, m, 0).getDate();
	const to = `${y}-${String(m).padStart(2, '0')}-${String(last).padStart(2, '0')}`;
	return { from, to };
}

export function semesterRange(tahunAjaran: string, semester: string): { from: string; to: string } {
	const [y1, y2] = tahunAjaran.split('/').map(Number);
	if (semester === 'Ganjil') return { from: `${y1}-07-01`, to: `${y1}-12-31` };
	return { from: `${y2}-01-01`, to: `${y2}-06-30` };
}

export function lastNDays(n: number): string[] {
	const out: string[] = [];
	for (let i = n - 1; i >= 0; i--) {
		out.push(addDays(todayStr(), -i));
	}
	return out;
}
