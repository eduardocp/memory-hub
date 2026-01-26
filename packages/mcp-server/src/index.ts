#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
    CallToolRequestSchema,
    ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import fs from "fs";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import { z } from "zod";

const server = new Server(
    {
        name: "memory-hub-mcp",
        version: "1.0.0",
    },
    {
        capabilities: {
            tools: {},
        },
    }
);

// Get configured root from env var (if provided in MCP settings)
const configRoot = process.env.MEMORY_FOLDER_PATH ? path.resolve(process.env.MEMORY_FOLDER_PATH) : process.cwd();

function getMemoryPath(overridePath?: string) {
    const memoryDir = overridePath || configRoot;

    if (!fs.existsSync(memoryDir)) {
        try {
            fs.mkdirSync(memoryDir, { recursive: true });
        } catch (e) {
            // ignore
        }
    }
    return path.join(memoryDir, "memory.json");
}

function readMemory(overridePath?: string) {
    const p = getMemoryPath(overridePath);

    if (!fs.existsSync(p)) {
        return { events: [] };
    }
    try {
        const content = fs.readFileSync(p, "utf-8");
        if (!content.trim()) return { events: [] };
        return JSON.parse(content);
    } catch (err) {
        console.error(`Error reading memory: ${err}`);
        return { events: [] };
    }
}

function writeMemory(data: any, overridePath?: string) {
    const p = getMemoryPath(overridePath);
    fs.writeFileSync(p, JSON.stringify(data, null, 2));
}

// Tool Handlers
server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
        tools: [
            {
                name: "memory_add",
                description: "Appends a new event to memory.json",
                inputSchema: {
                    type: "object",
                    properties: {
                        text: { type: "string" },
                        type: { type: "string", default: "note", enum: ["note", "idea", "task_update", "summary", "system", "new_bug", "bug_update", "spike_progress", "new_feat", "git_commit"] },
                        project: { type: "string", description: "Project name (optional, defaults to directory name)" },
                        projectRoot: { type: "string", description: "Absolute path to project root (optional)" },
                        source: { type: "string", description: "Source of the event (user, ai, git)", default: "user" }
                    },
                    required: ["text"],
                },
            },
            {
                name: "memory_list",
                description: "Returns all events",
                inputSchema: {
                    type: "object",
                    properties: {
                        projectRoot: { type: "string", description: "Absolute path to project root (optional)" }
                    },
                },
            },
            {
                name: "memory_clear",
                description: "Removes all events",
                inputSchema: {
                    type: "object",
                    properties: {
                        projectRoot: { type: "string", description: "Absolute path to project root (optional)" }
                    },
                },
            },
        ],
    };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    if (name === "memory_add") {
        // Validate args
        const schema = z.object({
            text: z.string(),
            type: z.enum(["note", "idea", "task_update", "summary", "system", "new_bug", "bug_update", "spike_progress", "new_feat", "git_commit"]).default("note").optional(),
            project: z.string().optional(),
            projectRoot: z.string().optional(),
            source: z.string().optional(),
        });

        const parsed = schema.parse(args);
        const memory = readMemory(parsed.projectRoot);

        // Default to 'memory-hub' if we are in this repo, or dirname
        // Use configRoot if no projectRoot provided
        const effectiveRoot = parsed.projectRoot || configRoot;
        const projectName = parsed.project || path.basename(effectiveRoot);

        const newEvent = {
            id: uuidv4(),
            timestamp: new Date().toISOString(),
            type: parsed.type || "note",
            text: parsed.text,
            project: projectName,
            source: parsed.source || "user",
        };

        memory.events.push(newEvent);
        writeMemory(memory, parsed.projectRoot);

        return {
            content: [
                {
                    type: "text",
                    text: `Event added: ${newEvent.id}`,
                },
            ],
        };
    }

    if (name === "memory_list") {
        const schema = z.object({
            projectRoot: z.string().optional(),
        });
        const parsed = schema.parse(args || {});
        const memory = readMemory(parsed.projectRoot);
        return {
            content: [
                {
                    type: "text",
                    text: JSON.stringify(memory.events, null, 2),
                },
            ],
        };
    }

    if (name === "memory_clear") {
        const schema = z.object({
            projectRoot: z.string().optional(),
        });
        const parsed = schema.parse(args || {});

        writeMemory({ events: [] }, parsed.projectRoot);
        return {
            content: [
                {
                    type: "text",
                    text: "Memory cleared",
                },
            ],
        };
    }

    throw new Error(`Unknown tool: ${name}`);
});

async function run() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("Memory MCP Server running on stdio");
}

run().catch((error) => {
    console.error("Fatal error running server:", error);
    process.exit(1);
});
