-- Create diary_entries table for daily journal entries
CREATE TABLE IF NOT EXISTS diary_entries (
  id TEXT PRIMARY KEY,
  date DATE NOT NULL,
  content TEXT NOT NULL,
  created_at DATETIME DEFAULT (datetime('now')),
  updated_at DATETIME DEFAULT (datetime('now'))
);

-- Create index for fast date lookup
CREATE INDEX idx_diary_entries_date ON diary_entries(date);
