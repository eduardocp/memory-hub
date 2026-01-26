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
        const stmt = db.prepare('SELECT path FROM projects');
        const projects = stmt.all() as { path: string }[];
        for (const p of projects) {
            this.addProject(p.path);
        }
    }

    private async handleFileChange(filePath: string) {
        console.log(`File changed: ${filePath}`);
        try {
            if (!fs.existsSync(filePath)) return;

            const content = fs.readFileSync(filePath, 'utf-8');
            if (!content.trim()) return;

            const data = JSON.parse(content) as MemoryLayout;
            if (!data.events) return;

            // Updated query to handle updates on existing IDs
            const insert = db.prepare(`
                INSERT INTO events (id, timestamp, type, text, project, source, created_at)
                VALUES (@id, @timestamp, @type, @text, @project, COALESCE(@source, 'file'), datetime('now'))
                ON CONFLICT(id) DO UPDATE SET
                    timestamp = excluded.timestamp,
                    type = excluded.type,
                    text = excluded.text,
                    project = excluded.project,
                    source = excluded.source
            `);

            const insertMany = db.transaction((events: MemoryEvent[]) => {
                for (const event of events) {
                    insert.run(event);
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
