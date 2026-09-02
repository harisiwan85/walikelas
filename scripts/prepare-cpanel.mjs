import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const root = path.resolve('C:/laragon/www/walikelas/web');
const distZip = path.join(root, 'cpanel-deploy.zip');

console.log('1. Membangun aplikasi web...');
execSync('npm run build', { cwd: root, stdio: 'inherit' });

console.log('\n2. Mengarsipkan file deployment...');
// Buat zip menggunakan tar/zip bawaan atau powershell Compress-Archive
const filesToInclude = ['build', 'package.json', 'package-lock.json', 'app.cjs', 'app.js'];

if (fs.existsSync(path.join(root, 'data'))) {
    filesToInclude.push('data');
}

const psCommand = `powershell -Command "Compress-Archive -Path ${filesToInclude.map(f => `'${path.join(root, f)}'`).join(', ')} -DestinationPath '${distZip}' -Force"`;
execSync(psCommand, { stdio: 'inherit' });

console.log(`\nBerhasil! File siap upload: ${distZip}`);
