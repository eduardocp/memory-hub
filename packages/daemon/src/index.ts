import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { initDB } from './db.js';
import db from './db.js';
import { Watcher } from './watcher.js';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { execSync } from 'child_process';

import { createServer } from 'http';
import { Server } from 'socket.io';
import { listTemplates, generateReport } from './reports.js';
import { gitService } from './git.js';
import { generateDailySummary, generateConnections, generateText, askBrain, AI_PROVIDERS, findSimilarEvents, backfillEmbeddings, generateEmbedding, saveEmbedding } from './ai.js';
import { initScheduler, scheduleTrigger, removeTriggerJob } from './scheduler.js';

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
initScheduler();

// Start Git Sync Loop (every 10 minutes)
setInterval(() => {
    gitService.syncAllProjects();
}, 10 * 60 * 1000);
// Initial run
// Initial run
gitService.syncAllProjects();

// MCP Auth Routes
// Store pending auth server ID (for providers that don't return state)
let pendingAuthServerId: string | null = null;

app.get('/mcp/auth/start', async (req, res) => {
    try {
        const { id } = req.query;
        if (!id || typeof id !== 'string') return res.status(400).send('Missing server ID');

        // Store the server ID for callback (in case provider doesn't return state)
        pendingAuthServerId = id;

        await mcpClientService.startAuth(id, res);
    } catch (e: any) {
        console.error("Auth Start Error:", e);
        res.status(500).send(e.message);
    }
});

app.get('/mcp/auth/callback', async (req, res) => {
    try {
        const { code, state } = req.query;
        if (!code || typeof code !== 'string') return res.status(400).send('Missing code');

        // Use state if provided, otherwise use the pending server ID
        let serverId = state as string | undefined;
        if (!serverId && pendingAuthServerId) {
            serverId = pendingAuthServerId;
            pendingAuthServerId = null; // Clear after use
        }

        if (!serverId) return res.status(400).send('Missing state and no pending auth');

        await mcpClientService.handleAuthCallback(code, serverId, res);
    } catch (e: any) {
        console.error("Auth Callback Error:", e);
        res.status(500).send(e.message);
    }
});

// MCP Client Routes
import { mcpClientService } from './mcp-client.js';

// Init MCP Service (Auto-start enabled servers)
mcpClientService.startAll();

app.get('/mcp/servers', (req, res) => {
    try {
        const servers = mcpClientService.listServers();
        // Enrich with realtime connection status check if needed, 
        // relying on DB status is fine for now as updateStatus updates DB.
        res.json(servers);
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/mcp/servers', async (req, res) => {
    try {
        const newServer = mcpClientService.addServer(req.body);
        if (newServer?.enabled) {
            // Try to auto connect
            await mcpClientService.connect(newServer.id).catch(err => console.error("Auto-connect failed:", err));
        }
        res.json(newServer);
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

app.put('/mcp/servers/:id', async (req, res) => {
    try {
        const updatedServer = mcpClientService.updateServer(req.params.id, req.body);

        // Auto restart if enabled to apply potential config changes (e.g. auth tokens)
        if (updatedServer?.enabled) {
            // We don't await detailed connection phases here to keep UI responsive, 
            // but we ensure clean state transition.
            await mcpClientService.stop(updatedServer.id);
            mcpClientService.connect(updatedServer.id).catch(err => console.error(`[MCP] Auto-reconnect failed for ${updatedServer.name}:`, err));
        }

        res.json(updatedServer);
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

app.delete('/mcp/servers/:id', async (req, res) => {
    try {
        await mcpClientService.deleteServer(req.params.id);
        res.json({ success: true });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/mcp/servers/:id/start', async (req, res) => {
    try {
        await mcpClientService.connect(req.params.id);
        res.json({ success: true });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/mcp/servers/:id/stop', async (req, res) => {
    try {
        await mcpClientService.stop(req.params.id);
        res.json({ success: true });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

app.get('/mcp/servers/:id/tools', async (req, res) => {
    try {
        const tools = await mcpClientService.listTools(req.params.id);
        res.json(tools);
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

import { MCP_PRESETS } from './presets.js';
app.get('/mcp/presets', (req, res) => {
    res.json(MCP_PRESETS);
});

// Analytics API
import { getOverallStats, getActivityHeatmap, getTypeDistribution } from './analytics.js';

app.get('/api/analytics/stats', (req, res) => {
    try {
        const range = (req.query.range as any) || 'week';
        const stats = getOverallStats(range);
        res.json(stats);
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/analytics/heatmap', (req, res) => {
    try {
        const heatmap = getActivityHeatmap();
        res.json(heatmap);
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/analytics/distribution', (req, res) => {
    try {
        const range = (req.query.range as any) || 'month';
        const dist = getTypeDistribution(range);
        res.json(dist);
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// API Routes

app.post('/git/hook', async (req, res) => {
    const { path } = req.body;
    if (!path) return res.status(400).json({ error: 'Path is required' });

    console.log(`[Webhook] Git event received for path: ${path}`);
    try {
        const result = await gitService.syncProjectNow(path);
        res.json(result);
    } catch (err: any) {
        console.error('Git Hook Error:', err.message);
        // Don't fail the hook, just log error mostly (though 404 might be useful context)
        // If we 500, git hook might complain in user console. Let's return 200 but with error payload if needed, 
        // or just strict error codes.
        if (err.message.includes('not tracked')) return res.status(404).json({ error: err.message });
        res.status(500).json({ error: err.message });
    }
});

app.get('/status', (req, res) => {
    res.json({ status: 'running', version: '1.0.0' });
});

// Browse filesystem directories
app.get('/browse', (req, res) => {
    const { path: dirPath } = req.query;
    const isWindows = process.platform === 'win32';

    // Special case: list Windows drives
    if (isWindows && (!dirPath || dirPath === 'drives')) {
        try {
            // Get list of drives using wmic
            const output = execSync('wmic logicaldisk get name', { encoding: 'utf-8' });
            const drives = output
                .split('\n')
                .map((line: string) => line.trim())
                .filter((line: string) => /^[A-Z]:$/.test(line))
                .map((drive: string) => ({
                    name: drive,
                    path: drive + '\\'
                }));

            return res.json({
                current: 'Computer',
                parent: null,
                directories: drives,
                isDrivesRoot: true
            });
        } catch (err: any) {
            return res.status(500).json({ error: 'Failed to list drives: ' + err.message });
        }
    }

    const targetPath = typeof dirPath === 'string' && dirPath.trim()
        ? dirPath
        : process.env.HOME || process.env.USERPROFILE || '/';

    try {
        if (!fs.existsSync(targetPath)) {
            return res.status(404).json({ error: 'Directory not found' });
        }

        const stat = fs.statSync(targetPath);
        if (!stat.isDirectory()) {
            return res.status(400).json({ error: 'Path is not a directory' });
        }

        const entries = fs.readdirSync(targetPath, { withFileTypes: true });
        const directories = entries
            .filter(e => e.isDirectory())
            .map(e => ({
                name: e.name,
                path: path.join(targetPath, e.name)
            }))
            .sort((a, b) => a.name.localeCompare(b.name));

        // Get parent directory
        const parent = path.dirname(targetPath);

        // On Windows, if we're at a drive root (e.g., C:\), parent should go to drives list
        const isAtDriveRoot = isWindows && /^[A-Z]:\\?$/i.test(targetPath);

        res.json({
            current: targetPath,
            parent: isAtDriveRoot ? 'drives' : (parent !== targetPath ? parent : null),
            directories
        });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
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

app.post('/projects/:name/watch', (req, res) => {
    const { name } = req.params;
    const { enabled } = req.body;

    try {
        const info = db.prepare('UPDATE projects SET watch_enabled = ? WHERE name = ?').run(enabled ? 1 : 0, name);
        if (info.changes > 0) {
            watcher.updateProjectWatch(name, enabled);
            res.json({ success: true });
        } else {
            res.status(404).json({ error: 'Project not found' });
        }
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

app.get('/events', (req, res) => {
    const { project, type, limit = 100, offset = 0 } = req.query;

    let query = `
        SELECT e.*, p.name as project 
        FROM events e 
        LEFT JOIN projects p ON e.project_id = p.id 
        WHERE 1=1
    `;
    const params: any[] = [];

    if (project) {
        query += ' AND p.name = ?';
        params.push(project);
    }
    if (req.query.query) {
        query += ' AND e.text LIKE ?';
        params.push(`%${req.query.query}%`);
    }
    if (req.query.startDate) {
        query += ' AND e.timestamp >= ?';
        params.push(req.query.startDate);
    }
    if (req.query.endDate) {
        query += ' AND e.timestamp <= ?';
        params.push(req.query.endDate);
    }
    if (type) {
        query += ' AND e.type = ?';
        params.push(type);
    }

    query += ' ORDER BY e.timestamp DESC LIMIT ? OFFSET ?';
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

        // Generate Embedding async
        generateEmbedding(text)
            .then(vector => saveEmbedding(newEvent.id, vector))
            .catch(err => console.error(`Failed to generate embedding for event ${newEvent.id}:`, err));

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

// AI Graph Connections
app.post('/ai/connections', async (req, res) => {
    try {
        const { project } = req.body;
        const connections = await generateConnections(project);
        res.json({ success: true, connections });
    } catch (err: any) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

// AI Models List
app.get('/ai/models', (req, res) => {
    res.json(AI_PROVIDERS);
});

app.post('/ai/chat', async (req, res) => {
    try {
        const { query, project } = req.body;
        if (!query) return res.status(400).json({ error: 'Query is required' });

        const answer = await askBrain(query, project);
        res.json({ success: true, answer });
    } catch (err: any) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

app.post('/ai/search/semantic', async (req, res) => {
    try {
        const { query, project, limit } = req.body;
        if (!query) return res.status(400).json({ error: 'Query is required' });

        const results = await findSimilarEvents(query, project, limit);
        res.json({ success: true, results });
    } catch (err: any) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

app.post('/ai/embeddings/backfill', async (req, res) => {
    // Start backfill in background
    backfillEmbeddings().catch(err => console.error("Backfill failed:", err));
    res.json({ success: true, message: "Backfill started in background" });
});

// ---- TRIGGERS API ----
app.get('/triggers', (req, res) => {
    try {
        const triggers = db.prepare('SELECT * FROM triggers ORDER BY created_at DESC').all();
        res.json(triggers);
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/triggers', (req, res) => {
    try {
        const { id, name, type, schedule, action, config, enabled } = req.body;

        let finalId = id;
        if (!finalId) finalId = uuidv4();

        const configStr = typeof config === 'object' ? JSON.stringify(config) : config;

        const stmt = db.prepare(`
            INSERT INTO triggers (id, name, type, schedule, action, config, enabled, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
            ON CONFLICT(id) DO UPDATE SET
                name = excluded.name,
                type = excluded.type,
                schedule = excluded.schedule,
                action = excluded.action,
                config = excluded.config,
                enabled = excluded.enabled
        `);

        stmt.run(finalId, name, type, schedule, action, configStr, enabled ? 1 : 0);

        // Update Scheduler
        const trigger = db.prepare('SELECT * FROM triggers WHERE id = ?').get(finalId);
        scheduleTrigger(trigger);

        res.json({ success: true, trigger });
    } catch (err: any) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

app.delete('/triggers/:id', (req, res) => {
    try {
        const { id } = req.params;
        db.prepare('DELETE FROM triggers WHERE id = ?').run(id);
        removeTriggerJob(id);
        res.json({ success: true });
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
// Diary API
// ==========================================

// Get diary entry for a specific date
app.get('/diary/:date', (req, res) => {
    try {
        const { date } = req.params;
        const entry = db.prepare('SELECT * FROM diary_entries WHERE date = ?').get(date);
        res.json(entry || null);
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// Get all diary entries (for calendar view)
app.get('/diary', (req, res) => {
    try {
        const { month, year } = req.query;
        let query = 'SELECT id, date, substr(content, 1, 100) as preview, created_at, updated_at FROM diary_entries';
        const params: any[] = [];

        if (month && year) {
            // Filter by month/year
            query += " WHERE strftime('%Y', date) = ? AND strftime('%m', date) = ?";
            params.push(year, String(month).padStart(2, '0'));
        }

        query += ' ORDER BY date DESC';
        const entries = db.prepare(query).all(...params);
        res.json(entries);
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// Create or update diary entry
app.post('/diary', (req, res) => {
    const { date, content } = req.body;
    if (!date || content === undefined) {
        return res.status(400).json({ error: 'date and content are required' });
    }

    try {
        // Check if entry exists
        const existing = db.prepare('SELECT id FROM diary_entries WHERE date = ?').get(date) as { id: string } | undefined;

        if (existing) {
            // Update
            db.prepare('UPDATE diary_entries SET content = ?, updated_at = datetime("now") WHERE id = ?').run(content, existing.id);
            const updated = db.prepare('SELECT * FROM diary_entries WHERE id = ?').get(existing.id);
            res.json({ success: true, entry: updated, action: 'updated' });
        } else {
            // Create
            const id = uuidv4();
            db.prepare('INSERT INTO diary_entries (id, date, content) VALUES (?, ?, ?)').run(id, date, content);
            const created = db.prepare('SELECT * FROM diary_entries WHERE id = ?').get(id);
            res.json({ success: true, entry: created, action: 'created' });
        }
    } catch (err: any) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

// Delete diary entry
app.delete('/diary/:date', (req, res) => {
    try {
        const { date } = req.params;
        const result = db.prepare('DELETE FROM diary_entries WHERE date = ?').run(date);
        if (result.changes > 0) {
            res.json({ success: true });
        } else {
            res.status(404).json({ error: 'Entry not found' });
        }
    } catch (err: any) {
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
            let query = `
                SELECT e.*, p.name as project 
                FROM events e 
                LEFT JOIN projects p ON e.project_id = p.id 
                WHERE 1=1
            `;
            const queryParams: any[] = [];

            if (project) {
                query += ' AND p.name = ?';
                queryParams.push(project);
            }
            if (type) {
                query += ' AND e.type = ?';
                queryParams.push(type);
            }
            if (params?.query) {
                query += ' AND e.text LIKE ?';
                queryParams.push(`%${params.query}%`);
            }
            if (params?.startDate) {
                query += ' AND e.timestamp >= ?';
                queryParams.push(params.startDate);
            }
            if (params?.endDate) {
                query += ' AND e.timestamp <= ?';
                queryParams.push(params.endDate);
            }

            // Exclude git commits by default unless requested (to keep main timeline clean)
            if (!params?.includeGit) {
                query += " AND (e.source IS NOT 'git' OR e.source IS NULL)";
            }

            query += ' ORDER BY e.timestamp DESC LIMIT ? OFFSET ?';
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

            const projectRow = db.prepare('SELECT id, path FROM projects WHERE name = ?').get(project) as { id: string, path: string } | undefined;
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
            const stmt = db.prepare('INSERT INTO events (id, timestamp, type, text, project_id, source) VALUES (?, ?, ?, ?, ?, ?)');
            stmt.run(newEvent.id, newEvent.timestamp, newEvent.type, newEvent.text, projectRow.id, 'user');

            // Broadcast to all clients
            io.emit('events:new', newEvent);

            // Generate Embedding async
            generateEmbedding(text)
                .then(vector => saveEmbedding(newEvent.id, vector))
                .catch(err => console.error(`Failed to generate embedding for event ${newEvent.id}:`, err));

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
            const { id, path: newPath, name: newName, watch_enabled } = data;
            if (!id) {
                return callback({ success: false, error: 'id is required' });
            }

            const oldProject = db.prepare('SELECT * FROM projects WHERE id = ?').get(id) as { id: string, path: string, name: string, watch_enabled: number } | undefined;
            if (!oldProject) {
                return callback({ success: false, error: 'Project not found' });
            }

            const updates: string[] = [];
            const params: any[] = [];

            if (newPath) { updates.push('path = ?'); params.push(newPath); }
            if (newName) { updates.push('name = ?'); params.push(newName); }
            if (watch_enabled !== undefined) { updates.push('watch_enabled = ?'); params.push(watch_enabled ? 1 : 0); }

            if (updates.length > 0) {
                params.push(id);
                db.prepare(`UPDATE projects SET ${updates.join(', ')} WHERE id = ?`).run(...params);
            }

            // --- Watcher Sync ---
            const finalPath = newPath || oldProject.path;
            const finalEnabled = watch_enabled !== undefined ? watch_enabled : (oldProject.watch_enabled !== 0);

            // Path changed?
            if (newPath && newPath !== oldProject.path) {
                watcher.removeProject(oldProject.path); // Remove old

                // Ensure new file exists
                const memoryPath = path.join(newPath, 'memory.json');
                if (!fs.existsSync(memoryPath)) {
                    const dir = path.dirname(memoryPath);
                    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
                    fs.writeFileSync(memoryPath, JSON.stringify({ events: [] }, null, 2));
                }
            }

            // Sync status
            if (finalEnabled) {
                watcher.addProject(finalPath);
            } else {
                watcher.removeProject(finalPath);
            }

            const updatedProject = { ...oldProject, path: finalPath, name: newName || oldProject.name, watch_enabled: finalEnabled ? 1 : 0 };
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

// Serve static frontend (when bundled with @memory-hub/app)
const webDistPath = process.env.WEB_DIST_PATH;

if (webDistPath && fs.existsSync(webDistPath)) {
    console.log(`Serving frontend from: ${webDistPath}`);
    app.use(express.static(webDistPath));

    // SPA fallback - serve index.html for non-API routes
    app.get('*', (req, res, next) => {
        // Skip API routes
        if (req.path.startsWith('/api') ||
            req.path.startsWith('/status') ||
            req.path.startsWith('/projects') ||
            req.path.startsWith('/events') ||
            req.path.startsWith('/settings') ||
            req.path.startsWith('/diary') ||
            req.path.startsWith('/triggers') ||
            req.path.startsWith('/templates') ||
            req.path.startsWith('/reports') ||
            req.path.startsWith('/summary') ||
            req.path.startsWith('/ai') ||
            req.path.startsWith('/socket.io')) {
            return next();
        }

        const indexPath = path.join(webDistPath, 'index.html');
        if (fs.existsSync(indexPath)) {
            res.sendFile(indexPath);
        } else {
            next();
        }
    });
}

httpServer.listen(PORT, () => {
    console.log(`Daemon running on http://localhost:${PORT}`);
});
