#!/usr/bin/env node
// ============================================================
// Setup sekali jalan ke Supabase:
//   1. Buat semua tabel (schema.sql)
//   2. Isi data demo + akun Supabase Auth (seed.sql)
//
// Cara pakai:
//   SUPABASE_ACCESS_TOKEN=<PAT> SUPABASE_PROJECT_REF=<ref> node scripts/supabase-setup.mjs
//
// - SUPABASE_ACCESS_TOKEN : Personal Access Token dari
//   https://supabase.com/dashboard/account/tokens
// - SUPABASE_PROJECT_REF  : kode proyek (bagian pertama dari
//   https://<ref>.supabase.co)
//
// Setelah selesai, isi web/.env.local dengan SUPABASE_URL dan
// SUPABASE_SERVICE_ROLE_KEY, lalu jalankan `npm run dev`.
// ============================================================

import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const token = process.env.SUPABASE_ACCESS_TOKEN;
const projectRef = process.env.SUPABASE_PROJECT_REF;

if (!token || !projectRef) {
	console.error('Kurang argumen. Contoh:');
	console.error('  SUPABASE_ACCESS_TOKEN=<PAT> SUPABASE_PROJECT_REF=<ref> node scripts/supabase-setup.mjs');
	process.exit(1);
}

async function runSql(sql, label) {
	console.log(`\n▶ ${label}...`);
	const res = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${token}`,
			'Content-Type': 'application/json'
		},
		body: JSON.stringify({ query: sql })
	});
	if (!res.ok) {
		const text = await res.text();
		console.error(`✖ Gagal ${label}:`, text.slice(0, 800));
		process.exit(1);
	}
	console.log(`✔ ${label} selesai`);
}

const schema = await readFile(resolve(root, '../supabase/schema.sql'), 'utf8');
const seed = await readFile(resolve(root, '../supabase/seed.sql'), 'utf8');

await runSql(schema, 'Membuat tabel (schema.sql)');
await runSql(seed, 'Mengisi data demo & akun (seed.sql)');

console.log('\n✅ Setup Supabase selesai!');
console.log('\nLangkah berikutnya:');
console.log('  1. Salin web/.env.example ke web/.env.local');
console.log('  2. Isi SUPABASE_URL=https://' + projectRef + '.supabase.co');
console.log('  3. Isi SUPABASE_SERVICE_ROLE_KEY (Dashboard → Project Settings → API → service_role)');
console.log('  4. npm run dev  →  login: admin/admin123 (atau username admin)');
