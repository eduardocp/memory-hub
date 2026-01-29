---
name: Database Management
description: Instructions for managing the SQLite database, creating migrations, and handling schema changes in the Memory Hub project.
---

# Database Management

The project uses `better-sqlite3` for a local SQLite database, typically located at `~/.memory-hub/memory-hub.db`. Migrations are handled by a custom implementation in the daemon.

## When to use this skill

- Use this when you need to manage the SQLite database, create migrations, or handle schema changes in the Memory Hub project.
- This is helpful for when you need to create a new table, add a new column, or modify an existing table.

## Directory Structure

- **Database Logic**: `packages/daemon/src/db.ts`
- **Migrations**: `packages/daemon/src/migrations/`

## Creating a Migration

Migrations are raw SQL files. To create a new migration:

1.  **Generate a timestamp**: Use the format `YYYYMMDDHHMMSS`.
2.  **Create the file**: Create a `.sql` file in `packages/daemon/src/migrations/` with the format `YYYYMMDDHHMMSS_description.sql`.
3.  **Write SQL**: Add valid SQL statements. You can use standard SQLite syntax.
    *   **Note**: A custom `uuid()` function is registered and available for use in your SQL.

### PowerShell Script to Create Migration

You can use this PowerShell snippet to generate a file with the correct name:

```powershell
$timestamp = Get-Date -Format "yyyyMMddHHmmss"
$name = Read-Host "Migration Name (e.g., add_users_table)"
$filename = "${timestamp}_${name}.sql"
$path = "packages/daemon/src/migrations/$filename"
New-Item -Path $path -ItemType File
Write-Host "Created migration: $path"
```

### Example Migration Content

```sql
-- 20260128120000_add_example_table.sql
CREATE TABLE IF NOT EXISTS example_table (
    id TEXT PRIMARY KEY DEFAULT (uuid()),
    name TEXT NOT NULL,
    created_at DATETIME DEFAULT (datetime('now'))
);
```

## Applying Migrations

Migrations are automatically applied when the daemon starts.

1.  Stop the daemon if it's running.
2.  Run `npm run dev:daemon` (or `npm run start` in the daemon package).
3.  The console will log `Running migration: ...` and `Migration ... completed successfully`.

## Database Access in Code

To interact with the database in the daemon code:

```typescript
import db from './db';

// Query
const rows = db.prepare('SELECT * FROM my_table WHERE id = ?').all(someId);

// Insert/Update
db.prepare('INSERT INTO my_table (name) VALUES (?)').run('New Name');

// Transaction
const createThing = db.transaction((thing) => {
    db.prepare('INSERT ...').run(thing);
    db.prepare('UPDATE ...').run(thing);
});
```

## Troubleshooting

- **Database Locks**: Since it's SQLite, concurrent writes might fail if not handled well, but `better-sqlite3` runs synchronously. If you encounter lock errors, ensure no other process (like a separate DB viewer) has the file open in write mode.
- **Failed Migrations**: If a migration throws an error, the process stops. You will need to fix the SQL file. The failed migration is *not* recorded in the `migrations` table, so it will retry on the next start.
  - **Warning**: SQLite lacks full DDL transaction support in some older versions/contexts, but `better-sqlite3` generally handles transactions well. However, if a migration partially succeeds (e.g. created one table but failed on the second) and crashes, you might be in an inconsistent state. It is best to keep migrations atomic or ensure you manually clean up if a dev migration fails.

## Database Standards

Follow these conventions when designing schemas:

### Naming Conventions
- **Tables**: Use **snake_case** and **plural** names (e.g., `user_settings`, `api_keys`).
- **Columns**: Use **snake_case** (e.g., `created_at`, `user_id`, `is_active`).
- **Foreign Keys**: `[singular_table_name]_id` (e.g., `project_id`).

### Column Types
- **Timestamps**: Use `DATETIME` for date/time fields.
  ```sql
  created_at DATETIME DEFAULT (datetime('now'))
  updated_at DATETIME DEFAULT (datetime('now'))
  ```
- **Booleans**: Use `BOOLEAN` (stored as 0 or 1).
  ```sql
  is_active BOOLEAN DEFAULT 1
  ```
- **JSON/Objects**: Use `TEXT` and add a comment indicating the structure.
  ```sql
  metadata TEXT, -- JSON object
  tags TEXT      -- JSON array
  ```

### Common Patterns
- **Foreign Key Constraints**: Define explicit constraints to ensure data integrity.
  ```sql
  CONSTRAINT fk_project
      FOREIGN KEY (project_id)
      REFERENCES projects(id)
      ON DELETE CASCADE
  ```
- **Indexes**: Create indexes for columns frequently used in `WHERE` clauses or `JOIN` conditions.
  ```sql
  CREATE INDEX idx_events_project_id ON events(project_id);
  ```


### Graph Relationships
- **Table**: `links`
- **Purpose**: "Entangled memories" / Graph edges.
- **Structure**: `source_id`, `target_id`, `type`, `metadata`.
- **Usage**: Use this to link any two entities (Events, Projects, etc.) with a specific relationship type.

### Vector Search (sqlite-vec)
- **Engine**: The project uses `sqlite-vec` extension for high-performance vector operations.
- **Storage**: Embeddings are stored as `BLOB` (Float32Array) in `event_embeddings`.
- **Search**: Use `vec_distance_cosine(column, ?)` in SQL queries.
  ```typescript
  // Convert number[] to Buffer for query
  const vecBuffer = Buffer.from(new Float32Array(vector).buffer);
  const rows = db.prepare('SELECT ..., vec_distance_cosine(vector, ?) as dist ...').all(vecBuffer);
  ```
