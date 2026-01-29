-- 1. Create new table with BLOB vector
CREATE TABLE event_embeddings_new (
    event_id TEXT PRIMARY KEY,
    vector BLOB NOT NULL,
    model TEXT NOT NULL,
    created_at DATETIME DEFAULT (datetime('now')),
    FOREIGN KEY(event_id) REFERENCES events(id) ON DELETE CASCADE
);

-- 2. Migrate data converting JSON to BLOB
INSERT INTO event_embeddings_new (event_id, vector, model, created_at)
SELECT 
    event_id, 
    json_to_vec(vector), 
    model, 
    created_at 
FROM event_embeddings
WHERE json_to_vec(vector) IS NOT NULL;

-- 3. Swap tables
DROP TABLE event_embeddings;
ALTER TABLE event_embeddings_new RENAME TO event_embeddings;
