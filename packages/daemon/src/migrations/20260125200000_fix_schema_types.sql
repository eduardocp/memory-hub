-- Migration to fix Types (TEXT -> DATETIME) and add UUID to projects

-- 1. Projects Table Migration (Add UUID)
CREATE TABLE projects_new (
  id TEXT PRIMARY KEY,
  path TEXT,
  name TEXT,
  created_at DATETIME DEFAULT (datetime('now'))
);

-- Copy data from old table, generating UUIDs using registered uuid() function
INSERT INTO projects_new (id, path, name, created_at)
SELECT uuid(), path, name, created_at FROM projects;

DROP TABLE projects;
ALTER TABLE projects_new RENAME TO projects;


-- 2. Events Table Migration (DATETIME)
CREATE TABLE events_new (
  id TEXT PRIMARY KEY,
  timestamp DATETIME,
  type TEXT,
  text TEXT,
  project TEXT,
  source TEXT,
  created_at DATETIME DEFAULT (datetime('now'))
);

INSERT INTO events_new (id, timestamp, type, text, project, source, created_at)
SELECT id, timestamp, type, text, project, source, created_at FROM events;

DROP TABLE events;
ALTER TABLE events_new RENAME TO events;


-- 3. Triggers Table Migration (DATETIME)
CREATE TABLE triggers_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT,
  project TEXT,
  event_type TEXT,
  match_text TEXT,
  action_type TEXT,
  action_payload TEXT,
  enabled INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT (datetime('now')),
  updated_at DATETIME DEFAULT (datetime('now'))
);

INSERT INTO triggers_new (id, name, project, event_type, match_text, action_type, action_payload, enabled, created_at, updated_at)
SELECT id, name, project, event_type, match_text, action_type, action_payload, enabled, created_at, updated_at FROM triggers;

DROP TABLE triggers;
ALTER TABLE triggers_new RENAME TO triggers;


-- 4. Schedules Table Migration (DATETIME)
CREATE TABLE schedules_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT,
  cron TEXT,
  action_type TEXT,
  action_payload TEXT,
  enabled INTEGER DEFAULT 1,
  last_run_at DATETIME,
  created_at DATETIME DEFAULT (datetime('now')),
  updated_at DATETIME DEFAULT (datetime('now'))
);

INSERT INTO schedules_new (id, name, cron, action_type, action_payload, enabled, last_run_at, created_at, updated_at)
SELECT id, name, cron, action_type, action_payload, enabled, last_run_at, created_at, updated_at FROM schedules;

DROP TABLE schedules;
ALTER TABLE schedules_new RENAME TO schedules;


-- 5. Settings Table Migration (DATETIME)
CREATE TABLE settings_new (
  key TEXT PRIMARY KEY,
  value TEXT,
  category TEXT,
  updated_at DATETIME DEFAULT (datetime('now'))
);

INSERT INTO settings_new (key, value, category, updated_at)
SELECT key, value, category, updated_at FROM settings;

DROP TABLE settings;
ALTER TABLE settings_new RENAME TO settings;
