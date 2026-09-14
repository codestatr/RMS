import { initializeDatabase, query } from './src/database/db.js';
initializeDatabase().then(() => query("SELECT SUM(amount) as s FROM payments WHERE status = 'paid'")).then(console.log).then(() => process.exit(0));
