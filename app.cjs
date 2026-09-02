const fs = require('node:fs');
const path = require('node:path');

// Pastikan working directory selalu di folder root aplikasi
process.chdir(__dirname);

// Perbaiki permission seluruh folder dan file secara otomatis saat startup
function fixPermissions(dir) {
    try {
        if (!fs.existsSync(dir)) return;
        const stat = fs.statSync(dir);
        if (stat.isDirectory()) {
            try { fs.chmodSync(dir, 0o777); } catch (_) {}
            const entries = fs.readdirSync(dir);
            for (const entry of entries) {
                fixPermissions(path.join(dir, entry));
            }
        } else {
            try { fs.chmodSync(dir, 0o666); } catch (_) {}
        }
    } catch (_) {}
}

// Jalankan perbaikan permission folder build sebelum aplikasi dimuat
fixPermissions(path.join(__dirname, 'build'));

(async () => {
    try {
        await import('./build/index.js');
    } catch (err) {
        console.error('Gagal menjalankan aplikasi:', err);
        process.exit(1);
    }
})();
