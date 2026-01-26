import express from 'express';
import cors from 'cors';
import { initDB } from './db.js';
import db from './db.js';
import { Watcher } from './watcher.js';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

import { createServer } from 'http';
import { Server } from 'socket.io';
import { listTemplates, generateReport } from './reports.js';
import { gitService } from './git.js';

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});
const PORT = 3000;

app.use(cors());
app.use(express.json());

// Initialize DB
initDB();

// Initialize Watcher
const watcher = new Watcher(io);
watcher.loadProjectsFromDB();

// Start Git Sync Loop (every 10 minutes)
setInterval(() => {
    gitService.syncAllProjects();
}, 10 * 60 * 1000);
// Initial run
gitService.syncAllProjects();

// API Routes

app.get('/status', (req, res) => {
    res.json({ status: 'running', version: '1.0.0' });
});

app.get('/projects', (req, res) => {
    const projects = db.prepare('SELECT * FROM projects').all();
    res.json(projects);
});

app.post('/projects', (req, res) => {
    const { path: projectPath, name } = req.body;
    if (!projectPath || !name) {
        return res.status(400).json({ error: 'path and name are required' });
    }

    try {
        const id = uuidv4();
        const stmt = db.prepare('INSERT INTO projects (id, path, name) VALUES (?, ?, ?)');
        stmt.run(id, projectPath, name);

        // Ensure memory.json exists immediately
        const memoryPath = path.join(projectPath, 'memory.json');
        if (!fs.existsSync(memoryPath)) {
            // Create if not exists to avoid watcher error
            const dir = path.dirname(memoryPath);
            if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
            fs.writeFileSync(memoryPath, JSON.stringify({ events: [] }, null, 2));
        }

        watcher.addProject(projectPath);
        res.json({ success: true, id, path: projectPath });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

app.patch('/projects/:id', (req, res) => {
    const { id } = req.params;
    const { path: newPath } = req.body;

    if (!newPath) {
        return res.status(400).json({ error: 'path is required' });
    }


    try {
        // Get old path to unwatch
        const oldProject = db.prepare('SELECT path FROM projects WHERE id = ?').get(id) as { path: string } | undefined;

        if (!oldProject) {
            return res.status(404).json({ error: 'Project not found' });
        }

        const stmt = db.prepare('UPDATE projects SET path = ? WHERE id = ?');
        const info = stmt.run(newPath, id);

        if (info.changes > 0) {
            watcher.removeProject(oldProject.path);

            // Ensure memory.json exists in new path
            const memoryPath = path.join(newPath, 'memory.json');
            if (!fs.existsSync(memoryPath)) {
                const dir = path.dirname(memoryPath);
                if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
                fs.writeFileSync(memoryPath, JSON.stringify({ events: [] }, null, 2));
            }

            watcher.addProject(newPath);
            res.json({ success: true, path: newPath });
        } else {
            res.status(404).json({ error: 'Project not found or unchanged' });
        }
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/projects/:id', (req, res) => {
    const { id } = req.params;

    try {
        const project = db.prepare('SELECT path FROM projects WHERE id = ?').get(id) as { path: string } | undefined;
        if (!project) {
            return res.status(404).json({ error: 'Project not found' });
        }

        const stmt = db.prepare('DELETE FROM projects WHERE id = ?');
        const info = stmt.run(id);

        if (info.changes > 0) {
            watcher.removeProject(project.path);
            res.json({ success: true, changes: info.changes });
        } else {
            res.status(404).json({ error: 'Project not found' });
        }
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/events', (req, res) => {
    const { project, type, limit = 100, offset = 0 } = req.query;

    let query = 'SELECT * FROM events WHERE 1=1';
    const params: any[] = [];

    if (project) {
        query += ' AND project = ?';
        params.push(project);
    }
    if (req.query.query) {
        query += ' AND text LIKE ?';
        params.push(`%${req.query.query}%`);
    }
    if (req.query.startDate) {
        query += ' AND timestamp >= ?';
        params.push(req.query.startDate);
    }
    if (req.query.endDate) {
        query += ' AND timestamp <= ?';
        params.push(req.query.endDate);
    }
    if (type) {
        query += ' AND type = ?';
        params.push(type);
    }

    query += ' ORDER BY timestamp DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const events = db.prepare(query).all(...params);
    res.json(events);

});



app.post('/events', (req, res) => {
    const { project, text, type, source } = req.body;
    if (!project || !text) {
        return res.status(400).json({ error: 'project and text are required' });
    }

    try {
        const projectRow = db.prepare('SELECT path FROM projects WHERE name = ?').get(project) as { path: string } | undefined;

        if (!projectRow) {
            return res.status(404).json({ error: 'Project not found' });
        }

        const memoryPath = path.join(projectRow.path, 'memory.json');
        if (!fs.existsSync(memoryPath)) {
            // Create if not exists (though project registration should have ensured it, or at least the dir)
            const dir = path.dirname(memoryPath);
            if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
            fs.writeFileSync(memoryPath, JSON.stringify({ events: [] }, null, 2));
        }

        const content = fs.readFileSync(memoryPath, 'utf-8');
        const memory = JSON.parse(content || '{"events":[]}');

        const newEvent = {
            id: uuidv4(),
            timestamp: new Date().toISOString(),
            type: type || 'note',
            text,
            project,
            source: source || 'user'
        };

        memory.events.push(newEvent);
        fs.writeFileSync(memoryPath, JSON.stringify(memory, null, 2));

        res.json({ success: true, event: newEvent });
    } catch (err: any) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

app.post('/trigger/run', (req, res) => {
    // Stub
    res.json({ message: 'Trigger run not implemented yet' });
});

app.post('/schedule/run', (req, res) => {
    // Stub
    res.json({ message: 'Schedule run not implemented yet' });
});

// Settings Endpoints
app.get('/settings', (req, res) => {
    try {
        const settings = db.prepare('SELECT * FROM settings').all();
        // Convert array to object for easier frontend consumption
        const settingsMap = settings.reduce((acc: any, curr: any) => {
            acc[curr.key] = curr.value;
            return acc;
        }, {});
        res.json(settingsMap);
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// ---- SETTINGS API ----
app.get('/settings', (req, res) => {
    try {
        const settings = db.prepare('SELECT * FROM settings').all();
        const settingsObj = settings.reduce((acc: any, curr: any) => {
            acc[curr.key] = curr.value;
            return acc;
        }, {});
        res.json(settingsObj);
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/settings', (req, res) => {
    const { key, value, category } = req.body;
    if (!key) {
        return res.status(400).json({ error: 'key is required' });
    }

    try {
        const stmt = db.prepare(`
            INSERT INTO settings (key, value, category, updated_at) 
            VALUES (?, ?, ?, datetime('now'))
            ON CONFLICT(key) DO UPDATE SET 
                value = excluded.value, 
                category = COALESCE(excluded.category, settings.category),
                updated_at = excluded.updated_at
        `);
        stmt.run(key, value, category);
        res.json({ success: true, key, value });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

import { generateDailySummary } from './ai.js';

app.post('/summary/generate', async (req, res) => {
    const { project } = req.body;
    if (!project) {
        return res.status(400).json({ error: 'project is required' });
    }

    try {
        const event = await generateDailySummary(project);
        if (!event) {
            return res.json({ message: 'No events found for yesterday to summarize' });
        }
        io.emit('events:new', event); // Send full event
        res.json({ success: true, event });
    } catch (err: any) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

// ---- REPORTS API ----
app.get('/templates', (req, res) => {
    try {
        const templates = listTemplates();
        res.json(templates);
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/reports/generate', async (req, res) => {
    const { templateId, project, options } = req.body;
    if (!templateId) return res.status(400).json({ error: 'templateId is required' });

    try {
        const result = await generateReport(templateId, project, options);
        res.json({ success: true, data: result });
    } catch (err: any) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

// ==========================================
// WebSocket Event Handlers (Real-time API)
// ==========================================

io.on('connection', (socket) => {
    console.log(`Client connected: ${socket.id}`);

    // ---- EVENTS ----
    socket.on('events:list', (params, callback) => {
        try {
            const { project, type, limit = 100, offset = 0 } = params || {};
            let query = 'SELECT * FROM events WHERE 1=1';
            const queryParams: any[] = [];

            if (project) {
                query += ' AND project = ?';
                queryParams.push(project);
            }
            if (type) {
                query += ' AND type = ?';
                queryParams.push(type);
            }
            if (params?.query) {
                query += ' AND text LIKE ?';
                queryParams.push(`%${params.query}%`);
            }
            if (params?.startDate) {
                query += ' AND timestamp >= ?';
                queryParams.push(params.startDate);
            }
            if (params?.endDate) {
                query += ' AND timestamp <= ?';
                queryParams.push(params.endDate);
            }

            // Exclude git commits by default unless requested (to keep main timeline clean)
            if (!params?.includeGit) {
                query += " AND (source IS NOT 'git' OR source IS NULL)";
            }

            query += ' ORDER BY timestamp DESC LIMIT ? OFFSET ?';
            queryParams.push(limit, offset);

            const events = db.prepare(query).all(...queryParams);
            callback({ success: true, data: events });
        } catch (err: any) {
            callback({ success: false, error: err.message });
        }
    });

    socket.on('events:add', (data, callback) => {
        try {
            const { project, text, type } = data;
            if (!project || !text) {
                return callback({ success: false, error: 'project and text are required' });
            }

            const projectRow = db.prepare('SELECT path FROM projects WHERE name = ?').get(project) as { path: string } | undefined;
            if (!projectRow) {
                return callback({ success: false, error: 'Project not found' });
            }

            const memoryPath = path.join(projectRow.path, 'memory.json');
            if (!fs.existsSync(memoryPath)) {
                const dir = path.dirname(memoryPath);
                if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
                fs.writeFileSync(memoryPath, JSON.stringify({ events: [] }, null, 2));
            }

            const content = fs.readFileSync(memoryPath, 'utf-8');
            const memory = JSON.parse(content || '{"events":[]}');

            const newEvent = {
                id: uuidv4(),
                timestamp: new Date().toISOString(),
                type: type || 'note',
                text,
                project,
                source: 'user'
            };

            memory.events.push(newEvent);
            fs.writeFileSync(memoryPath, JSON.stringify(memory, null, 2));

            // Also insert into DB for queries
            const stmt = db.prepare('INSERT INTO events (id, timestamp, type, text, project, source) VALUES (?, ?, ?, ?, ?, ?)');
            stmt.run(newEvent.id, newEvent.timestamp, newEvent.type, newEvent.text, newEvent.project, 'user');

            // Broadcast to all clients
            io.emit('events:new', newEvent);
            callback({ success: true, event: newEvent });
        } catch (err: any) {
            callback({ success: false, error: err.message });
        }
    });

    // ---- PROJECTS ----
    socket.on('projects:list', (callback) => {
        try {
            const projects = db.prepare('SELECT * FROM projects').all();
            callback({ success: true, data: projects });
        } catch (err: any) {
            callback({ success: false, error: err.message });
        }
    });

    socket.on('projects:add', (data, callback) => {
        try {
            const { path: projectPath, name } = data;
            if (!projectPath || !name) {
                return callback({ success: false, error: 'path and name are required' });
            }

            const id = uuidv4();
            const stmt = db.prepare('INSERT INTO projects (id, path, name) VALUES (?, ?, ?)');
            stmt.run(id, projectPath, name);

            const memoryPath = path.join(projectPath, 'memory.json');
            if (!fs.existsSync(memoryPath)) {
                const dir = path.dirname(memoryPath);
                if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
                fs.writeFileSync(memoryPath, JSON.stringify({ events: [] }, null, 2));
            }

            watcher.addProject(projectPath);

            const newProject = { id, path: projectPath, name };
            io.emit('projects:added', newProject);
            callback({ success: true, project: newProject });
        } catch (err: any) {
            callback({ success: false, error: err.message });
        }
    });

    socket.on('projects:update', (data, callback) => {
        try {
            const { id, path: newPath } = data;
            if (!id || !newPath) {
                return callback({ success: false, error: 'id and path are required' });
            }

            const oldProject = db.prepare('SELECT * FROM projects WHERE id = ?').get(id) as { id: string, path: string, name: string } | undefined;
            if (!oldProject) {
                return callback({ success: false, error: 'Project not found' });
            }

            const stmt = db.prepare('UPDATE projects SET path = ? WHERE id = ?');
            stmt.run(newPath, id);

            watcher.removeProject(oldProject.path);

            const memoryPath = path.join(newPath, 'memory.json');
            if (!fs.existsSync(memoryPath)) {
                const dir = path.dirname(memoryPath);
                if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
                fs.writeFileSync(memoryPath, JSON.stringify({ events: [] }, null, 2));
            }

            watcher.addProject(newPath);

            const updatedProject = { ...oldProject, path: newPath };
            io.emit('projects:updated', updatedProject);
            callback({ success: true, project: updatedProject });
        } catch (err: any) {
            callback({ success: false, error: err.message });
        }
    });

    socket.on('projects:delete', (data, callback) => {
        try {
            const { id } = data;
            if (!id) {
                return callback({ success: false, error: 'id is required' });
            }

            const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(id) as { id: string, path: string, name: string } | undefined;
            if (!project) {
                return callback({ success: false, error: 'Project not found' });
            }

            const stmt = db.prepare('DELETE FROM projects WHERE id = ?');
            stmt.run(id);

            watcher.removeProject(project.path);

            io.emit('projects:deleted', { id });
            callback({ success: true });
        } catch (err: any) {
            callback({ success: false, error: err.message });
        }
    });

    socket.on('disconnect', () => {
        console.log(`Client disconnected: ${socket.id}`);
    });
});

httpServer.listen(PORT, () => {
    console.log(`Daemon running on http://localhost:${PORT}`);
});
