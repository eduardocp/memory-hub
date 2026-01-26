import { GoogleGenerativeAI } from '@google/generative-ai';
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import db from './db.js';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs';

// --- Constants & Types ---

export const AI_PROVIDERS = {
    gemini: {
        name: 'Google Gemini',
        models: [
            { id: 'gemini-2.5-flash-lite', name: 'Gemini 2.5 Flash Lite (Fastest)' },
            { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash (Balanced)' },
            { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro (Powerful)' },
            { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash (General)' },
            { id: 'gemini-3-flash-preview', name: 'Gemini 3 Flash (Preview)' },
            { id: 'gemini-3-pro-preview', name: 'Gemini 3 Pro (Preview)' }
        ]
    },
    openai: {
        name: 'OpenAI',
        models: [
            { id: 'gpt-5.2', name: 'GPT-5.2 (Most Advanced)' },
            { id: 'gpt-5-mini', name: 'GPT-5 Mini (Efficient Reasoning)' },
            { id: 'gpt-4o', name: 'GPT-4o (Multimodal Standard)' },
            { id: 'gpt-4o-mini', name: 'GPT-4o Mini (Cost Effective)' },
            { id: 'gpt-4.1', name: 'GPT-4.1 (Versatile)' },
            { id: 'gpt-4.1-mini', name: 'GPT-4.1 Mini' },
            { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo (Legacy)' }
        ]
    },
    anthropic: {
        name: 'Anthropic',
        models: [
            { id: 'claude-opus-4-5-20251101', name: 'Claude 4.5 Opus (Most Intelligent)' },
            { id: 'claude-sonnet-4-5-20250929', name: 'Claude 4.5 Sonnet (Balanced Best)' },
            { id: 'claude-haiku-4-5-20251001', name: 'Claude 4.5 Haiku (Fastest)' },
            { id: 'claude-sonnet-4-20250522', name: 'Claude 4 Sonnet' },
            { id: 'claude-3-5-sonnet-latest', name: 'Claude 3.5 Sonnet (Legacy Stable)' },
            { id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku' }
        ]
    }
};

export type AIProvider = keyof typeof AI_PROVIDERS;

function getSetting(key: string): string | undefined {
    const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as { value: string } | undefined;
    return row?.value;
}

// --- Core Generation Logic ---

async function getClientAndModel() {
    const provider = getSetting('ai_provider') as AIProvider || 'gemini';
    const modelId = getSetting('ai_model');

    if (provider === 'openai') {
        const apiKey = getSetting('openai_key');
        if (!apiKey) throw new Error('OpenAI API Key not configured');

        return {
            provider,
            modelId: modelId || 'gpt-4o-mini',
            client: new OpenAI({ apiKey })
        };
    }
    else if (provider === 'anthropic') {
        const apiKey = getSetting('anthropic_key');
        if (!apiKey) throw new Error('Anthropic API Key not configured');

        return {
            provider,
            modelId: modelId || 'claude-haiku-4-5-20251001',
            client: new Anthropic({ apiKey })
        };
    }
    else {
        // Default to Gemini
        const apiKey = getSetting('gemini_key');
        if (!apiKey) throw new Error('Gemini API Key not configured');

        return {
            provider: 'gemini',
            modelId: modelId || 'gemini-2.5-flash-lite', // Fallback to stable efficient one
            client: new GoogleGenerativeAI(apiKey)
        };
    }
}

export async function generateText(prompt: string, systemInstruction?: string): Promise<string> {
    const { provider, modelId, client } = await getClientAndModel();

    try {
        if (provider === 'openai') {
            const openai = client as OpenAI;
            const messages: any[] = [{ role: 'user', content: prompt }];
            if (systemInstruction) messages.unshift({ role: 'system', content: systemInstruction });

            const completion = await openai.chat.completions.create({
                model: modelId,
                messages,
            });
            return completion.choices[0]?.message?.content || '';
        }
        else if (provider === 'anthropic') {
            const anthropic = client as Anthropic;
            const response = await anthropic.messages.create({
                model: modelId,
                max_tokens: 4000,
                system: systemInstruction,
                messages: [{ role: 'user', content: prompt }]
            });
            // Anthropic TextBlock response handling
            const content = response.content[0];
            if (content.type === 'text') return content.text;
            return '';
        }
        else {
            // Gemini
            const genAI = client as GoogleGenerativeAI;
            const model = genAI.getGenerativeModel({
                model: modelId,
                systemInstruction: systemInstruction
            });
            const result = await model.generateContent(prompt);
            return result.response.text();
        }
    } catch (e: any) {
        console.error(`AI Generation Error (${provider}):`, e);
        throw new Error(`AI Error: ${e.message}`);
    }
}

export async function generateJSON(prompt: string): Promise<any> {
    const { provider, modelId, client } = await getClientAndModel();
    const systemInstruction = "You are a JSON-only API. Output ONLY valid JSON, no markdown, no explanations.";

    // Append JSON instruction to prompt for models that don't support system instructions strongly or response_format
    const jsonPrompt = `${prompt}\n\nReturn ONLY raw JSON.`;

    try {
        if (provider === 'openai') {
            const openai = client as OpenAI;
            const completion = await openai.chat.completions.create({
                model: modelId,
                messages: [
                    { role: 'system', content: systemInstruction },
                    { role: 'user', content: prompt }
                ],
                response_format: { type: "json_object" }
            });
            const text = completion.choices[0]?.message?.content || '{}';
            return JSON.parse(text);
        }
        else if (provider === 'anthropic') {
            const anthropic = client as Anthropic;
            const response = await anthropic.messages.create({
                model: modelId,
                max_tokens: 4000,
                system: systemInstruction,
                messages: [{ role: 'user', content: jsonPrompt }]
            });
            const content = response.content[0];
            let text = '';
            if (content.type === 'text') text = content.text;

            // Clean markdown just in case
            text = text.replace(/```json/g, '').replace(/```/g, '').trim();
            return JSON.parse(text);
        }
        else {
            // Gemini
            const genAI = client as GoogleGenerativeAI;
            const model = genAI.getGenerativeModel({
                model: modelId,
                generationConfig: { responseMimeType: "application/json" }
            });
            const result = await model.generateContent(prompt);
            return JSON.parse(result.response.text());
        }
    } catch (e: any) {
        console.error(`AI JSON Error (${provider}):`, e);
        throw new Error(`AI JSON Error: ${e.message}`);
    }
}

// --- Specific Features ---

export async function generateDailySummary(project: string) {
    console.log(`Generating summary for project: ${project}`);

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);
    const startIso = yesterday.toISOString();

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const endIso = today.toISOString();

    const events = db.prepare(`
        SELECT e.* FROM events e
        LEFT JOIN projects p ON e.project_id = p.id
        WHERE p.name = ? 
        AND e.timestamp >= ? 
        AND e.timestamp < ?
        ORDER BY e.timestamp ASC
    `).all(project, startIso, endIso) as any[];

    if (events.length === 0) return null;

    const eventsText = events.map(e => `[${e.timestamp}] (${e.type}): ${e.text}`).join('\n');
    const prompt = `
        Analyze the following log of activities from yesterday for the project "${project}".
        
        Events:
        ${eventsText}
        
        Generate a concise but informative summary of what was accomplished, any ideas generated, and important notes.
        Start with "Yesterday's Activity Summary:".
    `;

    const summaryText = await generateText(prompt, "You are an AI project assistant.");

    console.log('Summary generated, saving...');

    // Save Logic (same as before)
    const projectRow = db.prepare('SELECT path FROM projects WHERE name = ?').get(project) as { path: string } | undefined;
    if (!projectRow) throw new Error(`Project ${project} path not found`);

    const memoryPath = path.join(projectRow.path, 'memory.json');
    let memory = { events: [] as any[] };

    if (fs.existsSync(memoryPath)) {
        const content = fs.readFileSync(memoryPath, 'utf-8');
        if (content.trim()) memory = JSON.parse(content);
    }

    const newEvent = {
        id: uuidv4(),
        timestamp: new Date().toISOString(),
        type: 'summary',
        text: summaryText,
        project: project,
        source: 'ai'
    };

    memory.events.push(newEvent);
    fs.writeFileSync(memoryPath, JSON.stringify(memory, null, 2));

    return newEvent;
}

export async function generateConnections(project?: string) {
    let query = `
        SELECT e.id, e.type, e.text, e.timestamp 
        FROM events e
        LEFT JOIN projects p ON e.project_id = p.id
    `;
    const params: any[] = [];

    if (project) {
        query += ' WHERE p.name = ?';
        params.push(project);
    }

    query += ' ORDER BY e.timestamp DESC LIMIT 200';

    const events = db.prepare(query).all(...params) as any[];
    if (events.length < 2) return [];

    const eventsList = events.map(e => `ID: ${e.id} | Text: ${e.text}`).join('\n');

    const prompt = `
        Analyze the following list of events and identify semantic connections between them.
        Ignore trivial connections. Focus on events that connect different times but same topic.
        
        Events:
        ${eventsList}
        
        Return ONLY a JSON array of connections in this format:
        { "connections": [ { "source": "ID_A", "target": "ID_B", "reason": "topic" } ] }
    `;

    // Note: Requesting object with array to satisfy JSON parsing easier
    const result = await generateJSON(prompt);

    // Normalize result (handle array or object wrapper)
    if (Array.isArray(result)) return result;
    if (result.connections && Array.isArray(result.connections)) return result.connections;
    return [];
}

export async function askBrain(query: string, project?: string) {
    // 1. Fetch relevant history (Long Context approach)
    // Get last 500 events (usually covers weeks of work)
    let sql = `
        SELECT e.* FROM events e
        LEFT JOIN projects p ON e.project_id = p.id
    `;
    const params: any[] = [];

    if (project) {
        sql += ' WHERE p.name = ?';
        params.push(project);
    }

    sql += ' ORDER BY e.timestamp DESC LIMIT 500';

    const events = db.prepare(sql).all(...params) as any[];

    if (events.length === 0) {
        return "I don't have enough memories stored yet to answer that.";
    }

    const context = events.reverse().map(e =>
        `[${e.timestamp}] [${e.type}] ${e.source ? `(${e.source}) ` : ''}: ${e.text}`
    ).join('\n');

    const prompt = `
        You are the user's "Second Brain". You have access to their development logs and memories below.
        
        USER QUESTION: "${query}"
        
        MEMORY STREAM (Context):
        ${context}
        
        INSTRUCTIONS:
        - Answer based ONLY on the provided memory stream.
        - If you find the answer, cite the specific event date or ID if possible.
        - If the answer isn't in the memories, say so politely.
        - Be helpful, technical, and concise.
    `;

    return await generateText(prompt, "You are a helpful knowledgeable coding assistant.");
}
