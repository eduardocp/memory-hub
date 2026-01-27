CREATE TABLE IF NOT EXISTS event_embeddings (
    event_id TEXT PRIMARY KEY,
    vector TEXT NOT NULL,
    model TEXT NOT NULL,
    created_at DATETIME DEFAULT (datetime('now')),
    FOREIGN KEY(event_id) REFERENCES events(id) ON DELETE CASCADE
);