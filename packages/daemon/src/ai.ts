import { GoogleGenerativeAI } from '@google/generative-ai';
import db from './db.js';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs';

// Helper to get settings
function getSetting(key: string): string | undefined {
    const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as { value: string } | undefined;
    return row?.value;
}

export async function generateDailySummary(project: string) {
    console.log(`Generating summary for project: ${project}`);

    // 1. Get Gemini Key
    const apiKey = getSetting('gemini_key');
    if (!apiKey) {
        throw new Error('Gemini API Key not found in settings');
    }

    // 2. Get yesterday's events
    // SQLite 'now','-1 day' logic or just JS date calculation
    // Let's use JS for precision
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);
    const startIso = yesterday.toISOString();

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const endIso = today.toISOString();

    const events = db.prepare(`
        SELECT * FROM events 
        WHERE project = ? 
        AND timestamp >= ? 
        AND timestamp < ?
        ORDER BY timestamp ASC
    `).all(project, startIso, endIso) as any[];

    if (events.length === 0) {
        return null; // No events to summarize
    }

    // 3. Prepare Prompt
    const eventsText = events.map(e => `[${e.timestamp}] (${e.type}): ${e.text}`).join('\n');
    const prompt = `
        You are an AI project assistant. 
        Analyze the following log of activities from yesterday for the project "${project}".
        
        Events:
        ${eventsText}
        
        Generate a concise but informative summary of what was accomplished, any ideas generated, and important notes.
        Format it as a clean text paragraph or bullet points.
        Start with "Yesterday's Activity Summary:".
    `;

    // 4. Call Gemini
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-lite" });

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const summaryText = response.text();

    console.log('Summary generated:', summaryText);

    // 5. Save Summary as a new Event
    // We need to find the project path to write to the file (so the watcher picks it up, or we insert directly)
    // If we insert directly to DB, the frontend sees it, but the file is out of sync.
    // Ideally we write to the file.

    const projectRow = db.prepare('SELECT path FROM projects WHERE name = ?').get(project) as { path: string } | undefined;
    if (!projectRow) {
        throw new Error(`Project ${project} path not found`);
    }

    const memoryPath = path.join(projectRow.path, 'memory.json');
    let memory = { events: [] as any[] };

    if (fs.existsSync(memoryPath)) {
        const content = fs.readFileSync(memoryPath, 'utf-8');
        if (content.trim()) memory = JSON.parse(content);
    }

    const newEvent = {
        id: uuidv4(),
        timestamp: new Date().toISOString(), // Now
        type: 'summary',
        text: summaryText,
        project: project,
        source: 'ai'
    };

    memory.events.push(newEvent);
    fs.writeFileSync(memoryPath, JSON.stringify(memory, null, 2));

    return newEvent;
}
