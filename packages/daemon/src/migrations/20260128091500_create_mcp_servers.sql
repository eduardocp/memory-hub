CREATE TABLE IF NOT EXISTS mcp_servers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT DEFAULT 'stdio',
    command TEXT NOT NULL,
    args TEXT, -- JSON array
    env TEXT, -- JSON object
    enabled BOOLEAN DEFAULT 1,
    status TEXT DEFAULT 'stopped',
    created_at DATETIME DEFAULT (datetime('now'))
);
