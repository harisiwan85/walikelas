#!/usr/bin/env node
// ============================================================
// Isi data demo ke project Supabase langsung (tanpa SQL Editor).
// Butuh SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY di .env.local
// Jalankan: node scripts/supabase-fill.mjs
//
// PostgREST tidak mendukung OVERRIDING SYSTEM VALUE, jadi kolom id
// dibiarkan digenerate identity, lalu id-nya ditangkap dari respons
// untuk dipakai pada relasi foreign key. Aman dijalankan ulang.
// ============================================================
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(__dirname, '../.env.local');
const env = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';

const SUPABASE_URL = process.env.SUPABASE_URL || env.match(/SUPABASE_URL="?([^"\n]+)/)?.[1];
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || env.match(/SUPABASE_SERVICE_ROLE_KEY="?([^"\n]+)/)?.[1];

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY belum diisi di .env.local');
  process.exit(1);
}

const REST = `${SUPABASE_URL}/rest/v1`;
const AUTH = `${SUPABASE_URL}/auth/v1`;
const H = {
  apikey: SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
  'Content-Type': 'application/json',
  Prefer: 'return=minimal'
};
const HR = { ...H, Prefer: 'return=representation' };

async function get(table, select, filter = '') {
  const res = await fetch(`${REST}/${table}?select=${select}${filter}`, { headers: H });
  if (!res.ok) return [];
  return res.json();
}

async function post(table, rows) {
  if (!rows.length) return [];
  const res = await fetch(`${REST}/${table}`, { method: 'POST', headers: HR, body: JSON.stringify(rows) });
  const body = await res.json();
  if (!res.ok) {
    console.log(`  ✗ ${table} (${rows.length}) -> ${res.status} ${JSON.stringify(body).slice(0, 180)}`);
    return [];
  }
  console.log(`  ✓ ${table} (${rows.length})`);
  return Array.isArray(body) ? body : [];
}

async function getCount(table) {
  const res = await fetch(`${REST}/${table}?select=*&limit=1`, { headers: { ...H, Prefer: 'count=exact' } });
  await res.arrayBuffer();
  return res.headers.get('content-range')?.split('/')[1] ?? '?';
}

// ------------------------------------------------------------ Auth
async function ensureAuthUser(email, password) {
  const list = await (await fetch(`${AUTH}/admin/users`, { headers: H })).json();
  const existing = (list.users ?? []).find((u) => u.email === email);
  if (existing) return existing;
  const res = await fetch(`${AUTH}/admin/users`, {
    method: 'POST', headers: H,
    body: JSON.stringify({ email, password, email_confirm: true })
  });
  const body = await res.json();
  if (!res.ok) console.log(`  ✗ auth ${email} -> ${res.status} ${JSON.stringify(body).slice(0, 160)}`);
  else console.log(`  ✓ auth ${email}`);
  return body.user ?? body;
}

// ------------------------------------------------------------ main
async function main() {
  console.log('== Akun Supabase Auth ==');
  const authAccounts = [
    ['admin@sekolah.sch.id', 'admin123'],
    ['kepala@sekolah.sch.id', 'kepala123'],
    ['siti@sekolah.sch.id', 'wali123'],
    ['anto@sekolah.sch.id', 'guru123']
  ];
  const authUsers = {};
  for (const [email, pw] of authAccounts) {
    const u = await ensureAuthUser(email, pw);
    if (u?.id) authUsers[email] = u.id;
  }

  // ------------------------------------------------------------ master (id di-generate)
  console.log('== Data master ==');
  const schoolExists = (await get('schools', 'id')).length > 0;
  if (!schoolExists) {
    await post('schools', [{
      nama: 'SMP Negeri 1 Harapan Jaya', npsn: '20219876',
      alamat: 'Jl. Pendidikan No. 1, Kec. Sukamaju, Kota Harapan',
      kepala_sekolah: 'Drs. Bambang Sutrisno, M.Pd.',
      tahun_ajaran_aktif: '2026/2027', semester_aktif: 'Ganjil'
    }]);
  } else {
    console.log('  - schools sudah ada');
  }

  const teacherDefs = [
    ['196512121988031002', '9933756657120002', 'Drs. Bambang Sutrisno, M.Pd.', 'kepala_sekolah', '081234567801'],
    ['197503152005011004', '9944766655220001', 'Pak Budi Santoso, S.Kom.', 'admin', '081234567802'],
    ['198204122010012001', '9955887712340001', 'Bu Siti Rahayu, S.Pd.', 'wali_kelas', '081234567803'],
    ['198807232012021001', '9966778899000012', 'Pak Anto Wijaya, S.Pd.', 'guru_mapel', '081234567804'],
    ['199001102014022002', '9977889900110023', 'Bu Dewi Lestari, S.Pd.', 'wali_kelas', '081234567805'],
    ['199205152015031003', '9988990011220034', 'Pak Rizky Pratama, S.Pd.', 'guru_mapel', '081234567806']
  ];
  const existingTeachers = await get('teachers', 'id,nama');
  const teacherIds = {};
  const toInsertTeachers = [];
  for (const [nip, nuptk, nama, jabatan, kontak] of teacherDefs) {
    const found = existingTeachers.find((t) => t.nama === nama);
    if (found) { teacherIds[nama] = found.id; continue; }
    const idx = toInsertTeachers.length;
    toInsertTeachers.push({ nip, nuptk, nama, jabatan, kontak });
  }
  const insertedTeachers = await post('teachers', toInsertTeachers);
  insertedTeachers.forEach((t) => { teacherIds[t.nama] = t.id; });

  const classDefs = [
    ['7A', 7, '2026/2027', teacherIds['Bu Siti Rahayu, S.Pd.']],
    ['7B', 7, '2026/2027', teacherIds['Pak Anto Wijaya, S.Pd.']],
    ['8A', 8, '2026/2027', teacherIds['Bu Dewi Lestari, S.Pd.']]
  ];
  const existingClasses = await get('classes', 'id,nama');
  const classIds = {};
  const toInsertClasses = [];
  for (const [nama, tingkat, tahunAjaran, waliId] of classDefs) {
    const found = existingClasses.find((c) => c.nama === nama);
    if (found) { classIds[nama] = found.id; continue; }
    toInsertClasses.push({ nama, tingkat, tahun_ajaran: tahunAjaran, wali_kelas_id: waliId });
  }
  const insertedClasses = await post('classes', toInsertClasses);
  insertedClasses.forEach((c) => { classIds[c.nama] = c.id; });

  const nama7a = ['Ahmad Hidayat','Budi Ramadhan','Citra Mulyani','Dewi Saputra','Eko Kusuma','Fitri Anggraini','Galih Handayani','Hana Nugroho','Indah Sari','Joko Hartono','Kirana Wijaya','Lukman Permata','Maya Setiawan','Nadia Susanti','Oscar Santoso','Putri Putra'];
  const nama7b = ['Rizky Pratama','Siti Aisyah','Taufik Hidayat','Umi Kulsum','Vina Rahma','Wahyu Nugroho','Yuni Astuti','Zaki Maulana','Adi Saputra','Bayu Prasetyo','Cahya Lestari','Dimas Arya','Elsa Putri','Fajar Ramadhan'];
  const nama8a = ['Gita Purnama','Hendra Gunawan','Intan Permata','Jihan Salsabila','Krisna Aditya','Laila Mufidah','Mila Rahayu','Nanda Putra','Okta Riana','Puri Handayani','Rina Marlina','Surya Nugraha'];
  const studentDefs = [];
  const make = (classKey, offset, i, nama, city) => ({
    class_id: classIds[classKey],
    nisn: String(1000000000 + offset + i * 13).padStart(10, '0'),
    nis: String(202600000 + offset + i * 7).padStart(9, '0'),
    nama,
    jenis_kelamin: i % 2 === 0 ? 'L' : 'P',
    tempat_lahir: city,
    tanggal_lahir: '2012-01-01',
    alamat: `Jl. Melati No. ${i}`,
    no_hp_ortu: '0813' + String(10000000 + i * 12345).padStart(8, '0'),
    status: 'aktif'
  });
  nama7a.forEach((n, idx) => studentDefs.push(make('7A', 0, idx + 1, n, 'Jakarta')));
  nama7b.forEach((n, idx) => studentDefs.push(make('7B', 100, idx + 1, n, 'Bandung')));
  nama8a.forEach((n, idx) => studentDefs.push(make('8A', 200, idx + 1, n, 'Bogor')));
  const existingStudents = await get('students', 'id,nisn');
  const studentIds = {};
  const toInsertStudents = [];
  for (const s of studentDefs) {
    const found = existingStudents.find((x) => x.nisn === s.nisn);
    if (found) { studentIds[s.nisn] = found.id; continue; }
    toInsertStudents.push(s);
  }
  const insertedStudents = await post('students', toInsertStudents);
  insertedStudents.forEach((s) => { studentIds[s.nisn] = s.id; });

  const subjectDefs = [
    ['MTK', 'Matematika', 75, 'Pak Anto Wijaya, S.Pd.'],
    ['BIN', 'Bahasa Indonesia', 75, 'Bu Dewi Lestari, S.Pd.'],
    ['BIG', 'Bahasa Inggris', 75, 'Bu Dewi Lestari, S.Pd.'],
    ['IPA', 'Ilmu Pengetahuan Alam', 75, 'Bu Dewi Lestari, S.Pd.'],
    ['IPS', 'Ilmu Pengetahuan Sosial', 75, 'Bu Dewi Lestari, S.Pd.'],
    ['PPKn', 'Pendidikan Pancasila & Kewarganegaraan', 75, 'Bu Dewi Lestari, S.Pd.'],
    ['PAI', 'Pendidikan Agama Islam', 75, 'Bu Dewi Lestari, S.Pd.'],
    ['PJOK', 'Pendidikan Jasmani, Olahraga, dan Kesehatan', 75, 'Bu Dewi Lestari, S.Pd.'],
    ['SBK', 'Seni Budaya', 75, 'Bu Dewi Lestari, S.Pd.'],
    ['INF', 'Informatika', 75, 'Pak Anto Wijaya, S.Pd.']
  ];
  const existingSubjects = await get('subjects', 'id,kode');
  const subjectIds = {};
  const toInsertSubjects = [];
  for (const [kode, nama, kkm, teacherNama] of subjectDefs) {
    const found = existingSubjects.find((x) => x.kode === kode);
    if (found) { subjectIds[kode] = found.id; continue; }
    toInsertSubjects.push({ kode, nama, kkm, teacher_id: teacherIds[teacherNama] });
  }
  const insertedSubjects = await post('subjects', toInsertSubjects);
  insertedSubjects.forEach((s) => { subjectIds[s.kode] = s.id; });

  const existingSC = await get('subject_classes', 'subject_id,class_id');
  const scRows = [];
  for (const kode of Object.keys(subjectIds)) {
    for (const cid of Object.values(classIds)) {
      if (!existingSC.some((x) => x.subject_id === subjectIds[kode] && x.class_id === cid)) {
        scRows.push({ subject_id: subjectIds[kode], class_id: cid });
      }
    }
  }
  await post('subject_classes', scRows);

  // ------------------------------------------------------------ akun aplikasi
  console.log('== Akun aplikasi (users) ==');
  const appUsers = [
    { email: 'admin@sekolah.sch.id', username: 'admin', name: 'Pak Budi Santoso', role: 'admin', teacher: 'Pak Budi Santoso, S.Kom.', classKey: null },
    { email: 'kepala@sekolah.sch.id', username: 'kepala', name: 'Drs. Bambang Sutrisno', role: 'kepala_sekolah', teacher: 'Drs. Bambang Sutrisno, M.Pd.', classKey: null },
    { email: 'siti@sekolah.sch.id', username: 'siti', name: 'Bu Siti Rahayu', role: 'wali_kelas', teacher: 'Bu Siti Rahayu, S.Pd.', classKey: '7A' },
    { email: 'anto@sekolah.sch.id', username: 'anto', name: 'Pak Anto Wijaya', role: 'guru_mapel', teacher: 'Pak Anto Wijaya, S.Pd.', classKey: '7B' }
  ];
  const existingUsers = await get('users', 'id,email');
  for (const u of appUsers) {
    if (existingUsers.some((x) => x.email === u.email)) { console.log(`  - users ${u.username} sudah ada`); continue; }
    const res = await fetch(`${REST}/users`, {
      method: 'POST', headers: H,
      body: JSON.stringify({
        auth_id: authUsers[u.email], username: u.username, email: u.email, name: u.name, role: u.role,
        teacher_id: teacherIds[u.teacher], class_id: u.classKey ? classIds[u.classKey] : null
      })
    });
    const body = await res.text();
    if (res.ok) console.log(`  ✓ users ${u.username}`);
    else console.log(`  ✗ users ${u.username} -> ${res.status} ${body.slice(0, 180)}`);
  }

  // ------------------------------------------------------------ master & pendukung
  console.log('== Master & pendukung ==');
  const periods = await get('academic_periods', 'tahun_ajaran,semester');
  const periodDefs = [
    ['2026/2027', 'Ganjil', true], ['2025/2026', 'Ganjil', false], ['2025/2026', 'Genap', false]
  ];
  const toInsertPeriods = periodDefs
    .filter(([ta, sem]) => !periods.some((p) => p.tahun_ajaran === ta && p.semester === sem))
    .map(([tahun_ajaran, semester, aktif]) => ({ tahun_ajaran, semester, aktif }));
  await post('academic_periods', toInsertPeriods);

  const cal = await get('academic_calendar', 'tanggal');
  const calDefs = [
    ['2026-08-17', 'Hari Kemerdekaan RI', 'libur'], ['2026-12-25', 'Hari Raya Natal', 'libur']
  ];
  const toInsertCal = calDefs
    .filter(([t]) => !cal.some((c) => c.tanggal === t))
    .map(([tanggal, keterangan, tipe]) => ({ tanggal, keterangan, tipe }));
  await post('academic_calendar', toInsertCal);

  const settings = await get('settings', 'key');
  if (!settings.some((s) => s.key === 'alpa_threshold')) {
    await post('settings', [{ key: 'alpa_threshold', value: '3' }]);
  } else {
    console.log('  - settings sudah ada');
  }

  // ------------------------------------------------------------ contoh absensi
  console.log('== Contoh absensi (8 hari kerja terakhir) ==');
  const sitiRow = (await get('users', 'id', '&username=eq.siti'))[0];
  const existingAtt = await get('attendance_daily', 'student_id,tanggal', '&limit=2000');
  const holidays = ['2026-08-17', '2026-12-25'];
  const days = [];
  for (let g = 1; g <= 8; g++) {
    const d = new Date();
    d.setDate(d.getDate() - g);
    const iso = d.toISOString().slice(0, 10);
    if (d.getDay() === 0 || d.getDay() === 6) continue;
    if (holidays.includes(iso)) continue;
    days.push({ iso, doy: Math.floor((d - new Date(d.getFullYear(), 0, 0)) / 86400000) });
  }
  const attendance = [];
  for (const nisn of Object.keys(studentIds)) {
    const sid = studentIds[nisn];
    for (const { iso, doy } of days) {
      if (existingAtt.some((a) => a.student_id === sid && a.tanggal === iso)) continue;
      const m10 = (sid + doy) % 10;
      const m7 = (sid + doy) % 7;
      const m5 = (sid + doy) % 5;
      const status = m10 === 0 ? 'alpa' : m7 === 0 ? 'izin' : m5 === 0 ? 'sakit' : 'hadir';
      attendance.push({
        student_id: sid, tanggal: iso, status,
        keterangan: status === 'sakit' ? 'Demam' : '',
        dicatat_oleh: sitiRow?.id ?? null
      });
    }
  }
  for (let i = 0; i < attendance.length; i += 500) {
    await post('attendance_daily', attendance.slice(i, i + 500));
  }

  // ------------------------------------------------------------ ringkasan
  console.log('\n== Ringkasan ==');
  for (const t of ['schools','teachers','classes','students','subjects','subject_classes','users','academic_periods','academic_calendar','settings','attendance_daily']) {
    console.log(`  ${t.padEnd(20)} ${await getCount(t)} baris`);
  }
  const aus = await (await fetch(`${AUTH}/admin/users`, { headers: H })).json();
  console.log(`  ${'auth.users'.padEnd(20)} ${(aus.users ?? []).length} baris`);
}

main().catch((e) => { console.error(e); process.exit(1); });
