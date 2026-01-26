import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { v4 as uuidv4 } from 'uuid';

const DB_DIR = path.join(os.homedir(), 'memory-hub');
const DB_PATH = path.join(DB_DIR, 'global.db');
const MIGRATIONS_DIR = path.join(process.cwd(), 'src', 'migrations');

// Ensure directory exists
if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}

const db = new Database(DB_PATH);

// Register UUID function to be used in migrations
db.function('uuid', () => uuidv4());

function runMigrations() {
  // 1. Create migrations table
  db.exec(`
        CREATE TABLE IF NOT EXISTS migrations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE,
            executed_at DATETIME DEFAULT (datetime('now'))
        )
    `);

  // 2. Read migration files
  if (!fs.existsSync(MIGRATIONS_DIR)) {
    console.warn(`Migrations directory not found at ${MIGRATIONS_DIR}`);
    return;
  }

  const files = fs.readdirSync(MIGRATIONS_DIR)
    .filter(f => f.endsWith('.sql'))
    .sort(); // Sort by name (timestamp)

  // 3. Execute pending migrations
  for (const file of files) {
    const row = db.prepare('SELECT id FROM migrations WHERE name = ?').get(file);
    if (!row) {
      console.log(`Running migration: ${file}`);
      const filePath = path.join(MIGRATIONS_DIR, file);
      const sql = fs.readFileSync(filePath, 'utf-8');

      try {
        db.transaction(() => {
          db.exec(sql);
          db.prepare('INSERT INTO migrations (name) VALUES (?)').run(file);
        })();
        console.log(`Migration ${file} completed successfully.`);
      } catch (err) {
        console.error(`Error running migration ${file}:`, err);
        throw err; // Stop migration process on error
      }
    }
  }
}

export function initDB() {
  console.log('Initializing Database at', DB_PATH);
  runMigrations();
}

export default db;
