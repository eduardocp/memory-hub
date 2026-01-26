-- 1. Create new events table with FK to projects
CREATE TABLE events_new (
  id TEXT PRIMARY KEY,
  timestamp TEXT,
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

-- 2. Migrate data
-- Map existing project names to project IDs
INSERT INTO events_new (id, timestamp, type, text, source, created_at, project_id)
SELECT 
    e.id, 
    e.timestamp, 
    e.type, 
    e.text, 
    e.source, 
    e.created_at,
    p.id
FROM events e
LEFT JOIN projects p ON e.project = p.name;

-- 3. Replace old table
DROP TABLE events;
ALTER TABLE events_new RENAME TO events;

-- 4. Create Indexes
CREATE INDEX idx_events_project_id ON events(project_id);
CREATE INDEX idx_events_timestamp ON events(timestamp);
CREATE INDEX idx_events_type ON events(type);
