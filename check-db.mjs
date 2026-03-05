import { createRequire } from 'module';
const require = createRequire(import.meta.url);
try {
    const sqlite3 = require('better-sqlite3');
    const db = new sqlite3('./server-php/database/dev.db');
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
    console.log('Tables:', JSON.stringify(tables, null, 2));
    const users = db.prepare('SELECT id, email, role, passwordHash, name FROM "User"').all();
    console.log('Users:', JSON.stringify(users, null, 2));
    const distributors = db.prepare('SELECT id, email, name, status FROM "Distributor"').all();
    console.log('Distributors:', JSON.stringify(distributors, null, 2));
    db.close();
} catch (e) {
    console.error('Error:', e.message);
    // Try without better-sqlite3
    import('node:child_process').then(({ execSync }) => {
        try {
            // List tables via sqlite3 command
            console.log('better-sqlite3 not found, need to install it');
        } catch { }
    });
}
