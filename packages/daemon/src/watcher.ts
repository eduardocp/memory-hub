import chokidar from 'chokidar';
import fs from 'fs';
import path from 'path';
import db from './db.js';

interface MemoryEvent {
    id: string;
    timestamp: string;
    type: string;
    text: string;
    project: string;
    source?: string;
}

interface MemoryLayout {
    events: MemoryEvent[];
}

import { Server } from 'socket.io';

export class Watcher {
    private watcher: chokidar.FSWatcher;
    private io: Server;

    constructor(io: Server) {
        this.io = io;
        this.watcher = chokidar.watch([], {
            persistent: true,
            ignoreInitial: false,
        });

        this.watcher.on('add', this.handleFileChange.bind(this));
        this.watcher.on('change', this.handleFileChange.bind(this));
    }

    public addProject(projectPath: string) {
        const memoryPath = path.join(projectPath, 'memory.json');
        console.log(`Watching ${memoryPath}`);
        this.watcher.add(memoryPath);
    }

    public removeProject(projectPath: string) {
        const memoryPath = path.join(projectPath, 'memory.json');
        console.log(`Unwatching ${memoryPath}`);
        this.watcher.unwatch(memoryPath);
    }

    public loadProjectsFromDB() {
        const stmt = db.prepare('SELECT name, path, watch_enabled FROM projects');
        const projects = stmt.all() as { name: string, path: string, watch_enabled: number }[];

        // Ideally we should sync current watched paths with DB state
        // For now, let's just add enabled ones. chokidar handles duplicates gracefully.
        for (const p of projects) {
            if (p.watch_enabled !== 0) {
                this.addProject(p.path);
            } else {
                this.removeProject(p.path); // Ensure removed if disabled
            }
        }
    }

    public updateProjectWatch(projectName: string, enable: boolean) {
        const row = db.prepare('SELECT path FROM projects WHERE name = ?').get(projectName) as { path: string } | undefined;
        if (!row) {
            console.error(`Project ${projectName} not found`);
            return;
        }

        if (enable) {
            this.addProject(row.path);
        } else {
            this.removeProject(row.path);
        }
    }

    private async handleFileChange(filePath: string) {
        const setting = db.prepare("SELECT value FROM settings WHERE key = 'system.file_watcher_enabled'").get() as { value: string } | undefined;
        if (setting && setting.value === 'false') {
            return;
        }

        console.log(`File changed: ${filePath}`);
        try {
            if (!fs.existsSync(filePath)) return;

            const content = fs.readFileSync(filePath, 'utf-8');
            if (!content.trim()) return;

            const data = JSON.parse(content) as MemoryLayout;
            if (!data.events) return;

            // Updated query to handle updates on existing IDs
            const insert = db.prepare(`
                INSERT INTO events (id, timestamp, type, text, project_id, source, created_at)
                VALUES (@id, @timestamp, @type, @text, @project_id, COALESCE(@source, 'file'), datetime('now'))
                ON CONFLICT(id) DO UPDATE SET
                    timestamp = excluded.timestamp,
                    type = excluded.type,
                    text = excluded.text,
                    project_id = excluded.project_id,
                    source = excluded.source
            `);

            // Cache project IDs to avoid repetitive selects
            const projectIdCache = new Map<string, string>();
            const getProjectId = (name: string): string | null => {
                if (projectIdCache.has(name)) return projectIdCache.get(name)!;
                const row = db.prepare('SELECT id FROM projects WHERE name = ?').get(name) as { id: string } | undefined;
                if (row) {
                    projectIdCache.set(name, row.id);
                    return row.id;
                }
                return null; // Or handle 'unknown' project
            };

            const insertMany = db.transaction((events: MemoryEvent[]) => {
                for (const event of events) {
                    const projectName = event.project || 'unknown';
                    const pid = getProjectId(projectName);

                    if (pid) {
                        insert.run({
                            ...event,
                            project_id: pid,
                            source: event.source || 'manual'
                        });
                    } else {
                        console.warn(`Skipping event ${event.id}: Project '${projectName}' not found in DB.`);
                    }
                }
            });

            insertMany(data.events);
            console.log(`Processed ${data.events.length} events from ${filePath}`);

            // Notify clients
            this.io.emit('events:updated');

            // TODO: Evaluate triggers here
        } catch (err) {
            console.error(`Error processing ${filePath}:`, err);
        }
    }
}
