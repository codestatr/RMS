import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runMigration() {
  console.log('Starting Database Migration...');

  // Connect to MySQL server (create DB if not exists)
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    multipleStatements: true,
  });

  const dbName = process.env.DB_NAME || 'rms_database';
  console.log(`📦 Ensuring database '${dbName}' exists...`);
  await connection.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`);
  await connection.query(`USE \`${dbName}\`;`);

  // Read schema.sql
  const schemaPath = path.resolve(__dirname, '../../../database/schema.sql');
  if (fs.existsSync(schemaPath)) {
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');
    console.log('📜 Executing schema.sql statements...');
    await connection.query(schemaSql);
    console.log('Schema migration completed successfully!');
  } else {
    console.error(`Schema file not found at: ${schemaPath}`);
  }

  const [housekeepingColumn] = await connection.query(
    `SELECT COUNT(*) AS count
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'properties' AND COLUMN_NAME = 'housekeeping_status'`,
    [dbName]
  );
  if (Number(housekeepingColumn[0]?.count || 0) === 0) {
    await connection.query(
      `ALTER TABLE properties
       ADD COLUMN housekeeping_status ENUM('clean', 'dirty', 'maintenance') NOT NULL DEFAULT 'clean'`
    );
    console.log('Added properties.housekeeping_status');
  }

  const [discountColumns] = await connection.query(
    `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'bookings'
     AND COLUMN_NAME IN ('discount_code', 'discount_amount')`,
    [dbName]
  );
  const existingDiscountColumns = new Set(discountColumns.map((column) => column.COLUMN_NAME));
  if (!existingDiscountColumns.has('discount_code')) {
    await connection.query('ALTER TABLE bookings ADD COLUMN discount_code VARCHAR(50)');
  }
  if (!existingDiscountColumns.has('discount_amount')) {
    await connection.query('ALTER TABLE bookings ADD COLUMN discount_amount DECIMAL(10, 2) NOT NULL DEFAULT 0');
  }

  await connection.end();
}

runMigration().catch((err) => {
  console.error('Migration failed:', err.message);
  process.exit(1);
});
