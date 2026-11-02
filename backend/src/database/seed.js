import mysql from 'mysql2/promise'
import bcrypt from 'bcryptjs'
import { randomUUID } from 'crypto'
import dotenv from 'dotenv'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

dotenv.config()

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

async function seed() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    multipleStatements: true,
  })

  try {
    const dbName = process.env.DB_NAME || 'rms_database'
    await connection.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`)
    await connection.query(`USE \`${dbName}\``)

    const schemaPath = path.resolve(__dirname, '../../../database/schema.sql')
    if (!fs.existsSync(schemaPath)) throw new Error(`Schema file not found: ${schemaPath}`)
    await connection.query(fs.readFileSync(schemaPath, 'utf8'))

    const email = process.env.INITIAL_ADMIN_EMAIL?.trim().toLowerCase()
    const password = process.env.INITIAL_ADMIN_PASSWORD
    const firstName = process.env.INITIAL_ADMIN_FIRST_NAME?.trim()
    const lastName = process.env.INITIAL_ADMIN_LAST_NAME?.trim()
    const requestedBootstrap = Boolean(email || password || firstName || lastName)

    if (requestedBootstrap) {
      if (!email || !password || !firstName || !lastName) {
        throw new Error('Set INITIAL_ADMIN_EMAIL, INITIAL_ADMIN_PASSWORD, INITIAL_ADMIN_FIRST_NAME, and INITIAL_ADMIN_LAST_NAME together to create the first administrator.')
      }
      if (password.length < 8) throw new Error('INITIAL_ADMIN_PASSWORD must contain at least 8 characters.')

      const [existing] = await connection.execute('SELECT id FROM users WHERE email = ? LIMIT 1', [email])
      if (!existing.length) {
        const passwordHash = await bcrypt.hash(password, 12)
        await connection.execute(
          `INSERT INTO users (id, email, first_name, last_name, role, status, password_hash)
           VALUES (?, ?, ?, ?, 'admin', 'active', ?)`,
          [randomUUID(), email, firstName, lastName, passwordHash]
        )
        console.log('Initial administrator created.')
      } else {
        console.log('Initial administrator already exists; existing account was left unchanged.')
      }
    }

    console.log('Database schema is ready.')
  } finally {
    await connection.end()
  }
}

seed().catch((error) => {
  console.error('Database setup failed:', error.message)
  process.exitCode = 1
})
