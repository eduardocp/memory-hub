-- Migration to fix timestamp column type from TEXT to DATETIME in events table

-- 1. Create new events table with DATETIME timestamp
CREATE TABLE events_new (
  id TEXT PRIMARY KEY,
  timestamp DATETIME,
  type TEXT,
  text TEXT,
  project_id TEXT,
  source TEXT,
  created_at DATETIME DEFAULT (datetime('now')),
  CONSTRAINT fk_projects
    FOREIGN KEY (project_id)
    REFERENCES projects(id)
    ON DELETE CASCADE
);

-- 2. Migrate data, converting TEXT timestamps to DATETIME
INSERT INTO events_new (id, timestamp, type, text, project_id, source, created_at)
SELECT 
    id, 
    datetime(timestamp),
    type, 
    text, 
    project_id,
    source, 
    created_at
FROM events;

-- 3. Replace old table
DROP TABLE events;
ALTER TABLE events_new RENAME TO events;

-- 4. Recreate Indexes
CREATE INDEX idx_events_project_id ON events(project_id);
CREATE INDEX idx_events_timestamp ON events(timestamp);
CREATE INDEX idx_events_type ON events(type);
