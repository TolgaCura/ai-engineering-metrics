import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import postgres from 'postgres'

const __dirname = dirname(fileURLToPath(import.meta.url))
const url = process.env.DATABASE_URL

if (!url) {
  console.error('ERROR: DATABASE_URL is not set.')
  process.exit(1)
}

const sql = postgres(url, {
  max: 1,
  ssl: url.includes('localhost') ? false : { rejectUnauthorized: false },
})

const schema = readFileSync(join(__dirname, '..', 'schema.sql'), 'utf8')

console.log('Applying schema...')
try {
  await sql.unsafe(schema)
  console.log('✓ Schema applied successfully.')
} catch (err) {
  console.error('Schema error:', err)
  process.exit(1)
} finally {
  await sql.end()
}
