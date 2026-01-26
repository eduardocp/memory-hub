import fs from 'fs';
import path from 'path';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { format, subDays, isSameDay, getDay, startOfWeek, endOfWeek, subWeeks } from 'date-fns';
import db from './db.js';

// Paths
const TEMPLATES_DIR = path.join(process.cwd(), 'src', 'templates');

interface ReportTemplate {
    id: string;
    name: string;
    description: string;
    icon: string;
    requiredContext: string[];
    prompt: string;
}

interface ReportOptions {
    includeCommits?: boolean;
    onlyCommits?: boolean;
}

// Helpers
function getSetting(key: string): string | undefined {
    const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as { value: string } | undefined;
    if (row && row.value) return row.value;
    return undefined;
}

function getWorkingDays(): number[] {
    const val = getSetting('working_days');
    if (val) {
        try {
            return JSON.parse(val);
        } catch {
            return [1, 2, 3, 4, 5]; // Default Mon-Fri
        }
    }
    return [1, 2, 3, 4, 5];
}

// Date Logic
function getLastWorkDay(from: Date, workingDays: number[]): Date {
    let d = subDays(from, 1);
    // Safety break after 14 days to avoid infinite loop
    for (let i = 0; i < 14; i++) {
        if (workingDays.includes(getDay(d))) {
            return d;
        }
        d = subDays(d, 1);
    }
    return subDays(from, 1); // Fallback
}

export function listTemplates(): ReportTemplate[] {
    if (!fs.existsSync(TEMPLATES_DIR)) return [];

    return fs.readdirSync(TEMPLATES_DIR)
        .filter(f => f.endsWith('.json'))
        .map(f => {
            try {
                return JSON.parse(fs.readFileSync(path.join(TEMPLATES_DIR, f), 'utf-8'));
            } catch (e) {
                console.error(`Error reading template ${f}`, e);
                return null;
            }
        })
        .filter(Boolean) as ReportTemplate[];
}

export async function generateReport(templateId: string, project?: string, options?: ReportOptions) {
    // 1. Load Template
    const templates = listTemplates();
    const template = templates.find(t => t.id === templateId);
    if (!template) throw new Error('Template not found');

    // 2. Resolve Dates & Context
    const now = new Date();
    const workingDays = getWorkingDays();
    const contextData: Record<string, any> = {
        work_days: workingDays.join(', '),
        today_date: format(now, 'yyyy-MM-dd')
    };

    // Helper to fetch events
    const fetchEvents = (start: Date, end: Date) => {
        let query = 'SELECT * FROM events WHERE timestamp >= ? AND timestamp <= ?';
        const params: any[] = [start.toISOString(), end.toISOString()];

        if (project) {
            query += ' AND project = ?';
            params.push(project);
        }

        if (options?.onlyCommits) {
            query += " AND source = 'git'";
        } else if (!options?.includeCommits) {
            query += " AND (source IS NOT 'git' OR source IS NULL)";
        }

        query += ' ORDER BY timestamp ASC';
        return db.prepare(query).all(...params);
    };

    // Populate Context Variables
    if (template.requiredContext.includes('last_work_day')) {
        const lastWorkDay = getLastWorkDay(now, workingDays);
        const start = new Date(lastWorkDay); start.setHours(0, 0, 0, 0);
        const end = new Date(lastWorkDay); end.setHours(23, 59, 59, 999);

        const events = fetchEvents(start, end);
        contextData['last_work_day_date'] = format(lastWorkDay, 'yyyy-MM-dd (EEEE)');
        contextData['last_work_day_events'] = events.map((e: any) => `- [${format(new Date(e.timestamp), 'HH:mm')}] ${e.type}: ${e.text}`).join('\n') || "(No events)";
    }

    if (template.requiredContext.includes('today')) {
        const start = new Date(now); start.setHours(0, 0, 0, 0);
        const end = new Date(now); end.setHours(23, 59, 59, 999);

        const events = fetchEvents(start, end);
        contextData['today_events'] = events.map((e: any) => `- [${format(new Date(e.timestamp), 'HH:mm')}] ${e.type}: ${e.text}`).join('\n') || "(No events yet)";
    }

    if (template.requiredContext.includes('last_week')) {
        const lastWeekStart = startOfWeek(subWeeks(now, 1), { weekStartsOn: 1 }); // Monday
        const lastWeekEnd = endOfWeek(subWeeks(now, 1), { weekStartsOn: 1 });

        const events = fetchEvents(lastWeekStart, lastWeekEnd);
        contextData['last_week_events'] = events.map((e: any) => `- [${format(new Date(e.timestamp), 'dd/MM')}] ${e.type}: ${e.text}`).join('\n');
    }

    if (template.requiredContext.includes('current_week')) {
        const weekStart = startOfWeek(now, { weekStartsOn: 1 });
        const weekEnd = endOfWeek(now, { weekStartsOn: 1 });

        const events = fetchEvents(weekStart, weekEnd);
        contextData['current_week_events'] = events.map((e: any) => `- [${format(new Date(e.timestamp), 'dd/MM')}] ${e.type}: ${e.text}`).join('\n');
    }

    // 3. Inject Context into Prompt
    let finalPrompt = template.prompt;
    for (const [key, val] of Object.entries(contextData)) {
        finalPrompt = finalPrompt.replace(new RegExp(`{{${key}}}`, 'g'), val);
    }

    // Also replace simple {{project}}
    if (project) finalPrompt = finalPrompt.replace(/{{project}}/g, project);
    else finalPrompt = finalPrompt.replace(/{{project}}/g, "All Projects");

    // 4. Call AI
    const apiKey = getSetting('gemini_key') || process.env.GEMINI_KEY;
    if (!apiKey) throw new Error('Gemini API Key not found in Settings or ENV');

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-lite" }); // More stable model

    console.log(`Generating report '${template.name}'...`);
    const result = await model.generateContent(finalPrompt);
    const response = await result.response;
    const text = response.text();

    return {
        template: template.name,
        report: text,
        contextUsed: contextData
    };
}
