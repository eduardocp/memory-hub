import { GoogleGenerativeAI } from '@google/generative-ai';
import { VertexAI } from '@google-cloud/vertexai';
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import db from './db.js';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs';

// --- Constants & Types ---

export const AI_PROVIDERS = {
    gemini: {
        name: 'Google Gemini (AI Studio)',
        models: [
            { id: 'gemini-2.5-flash-lite', name: 'Gemini 2.5 Flash Lite', type: 'chat' },
            { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', type: 'chat' },
            { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', type: 'chat' },
            { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', type: 'chat' },
            { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro', type: 'chat' },
            { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash', type: 'chat' },
            { id: 'text-embedding-004', name: 'Text Embedding 004', type: 'embedding' }
        ]
    },
    vertex: {
        name: 'Google Vertex AI (Enterprise)',
        models: [
            { id: 'gemini-2.5-flash-001', name: 'Gemini 2.5 Flash', type: 'chat' },
            { id: 'gemini-2.5-pro-001', name: 'Gemini 2.5 Pro', type: 'chat' },
            { id: 'gemini-1.5-flash-001', name: 'Gemini 1.5 Flash', type: 'chat' },
            { id: 'gemini-1.5-pro-001', name: 'Gemini 1.5 Pro', type: 'chat' },
            { id: 'text-embedding-004', name: 'Text Embedding 004', type: 'embedding' }
        ]
    },
    openai: {
        name: 'OpenAI',
        models: [
            { id: 'gpt-4o', name: 'GPT-4o', type: 'chat' },
            { id: 'gpt-4o-mini', name: 'GPT-4o Mini', type: 'chat' },
            { id: 'gpt-4-turbo', name: 'GPT-4 Turbo', type: 'chat' },
            { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo', type: 'chat' },
            { id: 'text-embedding-3-small', name: 'Text Embedding 3 Small', type: 'embedding' },
            { id: 'text-embedding-3-large', name: 'Text Embedding 3 Large', type: 'embedding' }
        ]
    },
    anthropic: {
        name: 'Anthropic',
        models: [
            { id: 'claude-3-5-sonnet-latest', name: 'Claude 3.5 Sonnet', type: 'chat' },
            { id: 'claude-3-5-haiku-latest', name: 'Claude 3.5 Haiku', type: 'chat' },
            { id: 'claude-3-opus-latest', name: 'Claude 3 Opus', type: 'chat' }
        ]
    }
};

export type AIProvider = keyof typeof AI_PROVIDERS;

function getSetting(key: string): string | undefined {
    const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as { value: string } | undefined;
    return row?.value;
}

// --- Core Generation Logic ---

// Helper to get client for a specific provider name
function createClient(provider: AIProvider) {
    const customBaseUrl = getSetting('ai_custom_base_url');

    if (provider === 'openai') {
        const apiKey = getSetting('openai_key');
        if (!apiKey) throw new Error('OpenAI API Key not configured');
        return new OpenAI({ apiKey, baseURL: customBaseUrl || undefined });
    }
    else if (provider === 'anthropic') {
        const apiKey = getSetting('anthropic_key');
        if (!apiKey) throw new Error('Anthropic API Key not configured');
        return new Anthropic({ apiKey, baseURL: customBaseUrl || undefined });
    }
    else if (provider === 'vertex') {
        const projectId = getSetting('vertex_project_id');
        const location = getSetting('vertex_location') || 'us-central1';
        if (!projectId) throw new Error('Vertex AI Project ID not configured');
        return new VertexAI({ project: projectId, location });
    }
    else {
        // Gemini
        const apiKey = getSetting('gemini_key');
        if (!apiKey) throw new Error('Gemini API Key not configured');
        return new GoogleGenerativeAI(apiKey);
    }
}

async function getChatClient() {
    const provider = getSetting('ai_provider') as AIProvider || 'gemini';
    const modelId = getSetting('ai_model');
    const client = createClient(provider);

    // Safety check: ensure selected model belongs to provider? 
    // For now, trust the settings or default fallbacks.

    return { provider, modelId, client };
}

async function getEmbeddingClient() {
    const provider = (getSetting('embedding_provider') as AIProvider) || 'gemini';
    const modelId = getSetting('embedding_model') || 'text-embedding-004';

    // Fallback: If provider is anthropic (no embeddings), switch to gemini
    if (provider === 'anthropic') {
        return {
            provider: 'gemini' as AIProvider,
            modelId: 'text-embedding-004',
            client: createClient('gemini')
        };
    }

    const client = createClient(provider);
    return { provider, modelId, client };
}

export async function generateText(prompt: string, systemInstruction?: string): Promise<string> {
    const { provider, modelId, client } = await getChatClient();

    try {
        if (provider === 'openai') {
            const openai = client as OpenAI;
            const messages: any[] = [{ role: 'user', content: prompt }];
            if (systemInstruction) messages.unshift({ role: 'system', content: systemInstruction });

            const completion = await openai.chat.completions.create({
                model: modelId || 'gpt-4o-mini',
                messages,
            });
            return completion.choices[0]?.message?.content || '';
        }
        else if (provider === 'anthropic') {
            const anthropic = client as Anthropic;
            const response = await anthropic.messages.create({
                model: modelId || 'claude-3-5-sonnet-latest',
                max_tokens: 4000,
                system: systemInstruction,
                messages: [{ role: 'user', content: prompt }]
            });
            // Anthropic TextBlock response handling
            const content = response.content[0];
            if (content.type === 'text') return content.text;
            return '';
        }
        else if (provider === 'vertex') {
            const vertexAI = client as VertexAI;
            const model = vertexAI.getGenerativeModel({
                model: modelId || 'gemini-1.5-flash-001',
                systemInstruction: systemInstruction ? { parts: [{ text: systemInstruction } as any], role: 'system' } : undefined
            });
            const result = await model.generateContent(prompt);
            const response = await result.response;
            return response.candidates?.[0].content.parts[0].text || '';
        }
        else {
            // Gemini AI Studio
            const genAI = client as GoogleGenerativeAI;
            const model = genAI.getGenerativeModel({
                model: modelId || 'gemini-1.5-flash',
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

// --- JSON Construction ---

export async function generateJSON(prompt: string): Promise<any> {
    const { provider, modelId, client } = await getChatClient();

    try {
        if (provider === 'openai') {
            const openai = client as OpenAI;
            const completion = await openai.chat.completions.create({
                model: modelId || 'gpt-4o-mini',
                messages: [
                    { role: 'system', content: 'You are a strict JSON generator. Output only valid JSON.' },
                    { role: 'user', content: prompt }
                ],
                response_format: { type: "json_object" }
            });
            return JSON.parse(completion.choices[0]?.message?.content || '{}');
        }
        else if (provider === 'anthropic') {
            const anthropic = client as Anthropic;
            const response = await anthropic.messages.create({
                model: modelId || 'claude-3-5-sonnet-latest',
                max_tokens: 4000,
                system: 'You are a strict JSON generator. Output only valid JSON.',
                messages: [{ role: 'user', content: prompt }]
            });
            let text = '';
            if (response.content[0].type === 'text') text = response.content[0].text;

            // Clean markdown block if present
            text = text.replace(/```json/g, '').replace(/```/g, '').trim();
            return JSON.parse(text);
        }
        else if (provider === 'vertex') {
            const vertexAI = client as VertexAI;
            const model = vertexAI.getGenerativeModel({
                model: modelId || 'gemini-1.5-flash-001',
                generationConfig: { responseMimeType: "application/json" }
            });
            const result = await model.generateContent(prompt);
            const response = await result.response;
            const text = response.candidates?.[0].content.parts[0].text || '{}';
            return JSON.parse(text);
        }
        else {
            // Gemini (AI Studio)
            const genAI = client as GoogleGenerativeAI;
            const model = genAI.getGenerativeModel({
                model: modelId || 'gemini-1.5-flash',
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
    // 1. Retrieve relevant memories (RAG)
    // We use the same hybrid/semantic search logic to find the most relevant events
    // to answer the user's question, rather than just the last 500 logs.
    const relevantEvents = await findSimilarEvents(query, project, 15);

    if (relevantEvents.length === 0) {
        return {
            user_response: "I didn't find any information about that in your memories.",
            related_memories: []
        };
    }

    // 2. Prepare Context
    const context = relevantEvents.map(e =>
        `[${e.id}] (${e.timestamp}) [${e.type}]: ${e.text}`
    ).join('\n');

    const systemPrompt = `
        You are an assistant specialized in interpreting user requests based on memories stored in the system.

        GENERAL RULES:
        1. Use exclusively the information provided by the retrieval mechanism (RAG).
        2. Never invent data, dates, events, or actions that are not present in the retrieved memories.
        3. If the information is not available, state clearly: "I did not find this information in your memories."
        4. Interpret natural language variations and understand that the user may refer to the same event in different ways.
        5. Prioritize precision, clarity, and traceability.

        MANDATORY BEHAVIOR:
        - Whenever a relevant memory is identified, return:
          a) a natural response for the user
          b) a structured object containing the corresponding memory(ies)

        RESPONSE FORMAT:
        ALWAYS respond in the following JSON format:

        {
          "user_response": "Clear and direct text answering the question.",
          "related_memories": [
            {
              "id": "<memory_id>",
              "excerpt": "<original_text_from_memory>",
              "date": "<iso_timestamp>",
              "type": "<memory_type>"
            }
          ]
        }

        RULES FOR THE BLOCK 'related_memories':
        - Include only memories actually retrieved by the system/context.
        - If there are multiple relevant memories, list all of them.
        - If no memory is found, return an empty list.
        - The "excerpt" must match the text from the context.
    `;

    const userPrompt = `
        USER QUESTION: "${query}"

        RETRIEVED MEMORIES (Context):
        ${context}
    `;

    // 3. Generate Answer
    try {
        const result = await generateJSON(JSON.stringify({
            system: systemPrompt,
            user: userPrompt
        }));

        // Handle case where model might return raw text or slightly malformed JSON (though generateJSON tries to fix)
        // If generateJSON is just receiving a prompt string (which it is), we pass the combo.
        // Actually generateJSON signature is (prompt: string). 
        // We should combine system and user prompt for the call.

        return await generateJSON(`${systemPrompt}\n\n${userPrompt}`);

    } catch (e: any) {
        console.error("AskBrain RAG Error:", e);
        return {
            user_response: "I encountered an error trying to process your request.",
            related_memories: []
        };
    }
}

// --- Embeddings & Semantic Search ---

// Simple Cosine Similarity
function cosineSimilarity(vecA: number[], vecB: number[]) {
    let dotProduct = 0.0;
    let normA = 0.0;
    let normB = 0.0;
    for (let i = 0; i < vecA.length; i++) {
        dotProduct += vecA[i] * vecB[i];
        normA += vecA[i] * vecA[i];
        normB += vecB[i] * vecB[i];
    }
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

export async function generateEmbedding(text: string): Promise<number[]> {
    const { provider, modelId, client } = await getEmbeddingClient();

    try {
        if (provider === 'openai') {
            const openai = client as OpenAI;
            const response = await openai.embeddings.create({
                model: modelId || "text-embedding-3-small",
                input: text,
                encoding_format: "float",
            });
            return response.data[0].embedding;
        }
        else if (provider === 'vertex') {
            const vertexAI = client as VertexAI;
            // Use proper model ID from settings or fallback
            const modelName = modelId || "text-embedding-004";
            const model = vertexAI.getGenerativeModel({ model: modelName });

            const request = {
                contents: [{ role: 'user', parts: [{ text }] }],
            };
            const result = await model.generateContent(request);
            // @ts-ignore
            return result;
        }
        else if (provider === 'anthropic') {
            // Should be handled by fallback in getEmbeddingClient, but just in case
            throw new Error("Anthropic does not support embeddings.");
        }
        else {
            // Default: Gemini (AI Studio)
            const genAI = client as GoogleGenerativeAI;
            const modelName = modelId || "text-embedding-004";
            console.log(`Generating embedding using model: ${modelName}`);
            const model = genAI.getGenerativeModel({ model: modelName });
            const result = await model.embedContent(text);
            return result.embedding.values;
        }
    } catch (e: any) {
        console.error("Embedding generation error:", e);
        throw e;
    }
}

export async function saveEmbedding(eventId: string, vector: number[], model: string = 'text-embedding-004') {
    const vectorStr = JSON.stringify(vector);
    db.prepare(`
        INSERT INTO event_embeddings (event_id, vector, model, created_at)
        VALUES (?, ?, ?, datetime('now'))
        ON CONFLICT(event_id) DO UPDATE SET
            vector = excluded.vector,
            model = excluded.model,
            created_at = datetime('now')
    `).run(eventId, vectorStr, model);
}

export async function findSimilarEvents(query: string, project?: string, limit: number = 5) {
    let searchVectors: number[][] = [];

    // 0. Multi-Variation Query Optimization (HyDE-lite)
    // We generate 3 variations of the potential log entry to maximize the chance
    // of a high-score match regardless of the exact phrasing in the DB.
    try {
        const refinementPrompt = `
            You are a search optimizer for a developer's technical memory log.
            
            USER QUERY: "${query}"
            
            Task: Generate 3 distinct variations of how this event might be written in the logs (in English).
            1. Concise headline style.
            2. Detailed, descriptive technical entry.
            3. Past-tense declarative statement.
            
            Output ONLY the 3 lines, separated by plain newlines. Do not use bullets or numbering.
        `;

        const text = await generateText(refinementPrompt);
        const variations = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);

        console.log(`[Semantic Search] Variations:`, variations);

        if (variations.length > 0) {
            // Embed all variations in parallel
            searchVectors = await Promise.all(variations.map(v => generateEmbedding(v)));
        } else {
            // Fallback
            searchVectors = [await generateEmbedding(query)];
        }
    } catch (e) {
        console.warn("Query optimization failed, using original:", e);
        searchVectors = [await generateEmbedding(query)];
    }

    // 2. Fetch all embeddings + event meta
    let sql = `
        SELECT ee.event_id, ee.vector, e.text, e.type, e.timestamp, p.name as project
        FROM event_embeddings ee
        JOIN events e ON ee.event_id = e.id
        LEFT JOIN projects p ON e.project_id = p.id
        WHERE (e.type != 'git_commit') AND (e.source != 'git' OR e.source IS NULL)
    `;

    const params: any[] = [];
    if (project) {
        sql += ' AND p.name = ?';
        params.push(project);
    }

    const rows = db.prepare(sql).all(...params) as any[];

    // 3. Calculate similarity (Max of variations)
    const results = rows.map(row => {
        const docVector = JSON.parse(row.vector);
        // We take the BEST match from our 3 variations
        const bestSimilarity = Math.max(...searchVectors.map(qv => cosineSimilarity(qv, docVector)));
        return { ...row, similarity: bestSimilarity };
    });

    // 4. Sort and limit
    return results
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, limit)
        .map(({ vector, ...rest }) => rest);
}

export async function backfillEmbeddings() {
    console.log("Starting embedding backfill...");
    const events = db.prepare(`
        SELECT e.id, e.text 
        FROM events e 
        LEFT JOIN event_embeddings ee ON e.id = ee.event_id 
        WHERE ee.event_id IS NULL
    `).all() as { id: string, text: string }[];

    console.log(`Found ${events.length} events needing embeddings.`);

    for (const event of events) {
        if (!event.text || event.text.length < 3) continue;
        try {
            const vector = await generateEmbedding(event.text);
            await saveEmbedding(event.id, vector);
            console.log(`Generated embedding for ${event.id}`);
            // Rate limit prevention (simple delay)
            await new Promise(r => setTimeout(r, 200));
        } catch (err) {
            console.error(`Failed to embed event ${event.id}:`, err);
        }
    }
    console.log("Backfill complete.");
}
