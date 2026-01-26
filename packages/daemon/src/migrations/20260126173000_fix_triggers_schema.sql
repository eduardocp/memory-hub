-- Migration to fix triggers schema based on unification
-- We drop existing tables to start fresh with the new unified schema
DROP TABLE IF EXISTS triggers;
DROP TABLE IF EXISTS schedules;

CREATE TABLE triggers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    schedule TEXT,
    action TEXT NOT NULL,
    config TEXT,
    enabled INTEGER DEFAULT 1,
    last_run DATETIME,
    created_at DATETIME
);
