import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import db from './db.js';
import { v4 as uuidv4 } from 'uuid';

export interface McpServerConfig {
    id: string;
    name: string;
    type: string;
    command: string;
    args: string[];
    env: Record<string, string>;
    url?: string;
    enabled: boolean;
    status: 'stopped' | 'running' | 'error';
}

class McpClientService {
    private clients: Map<string, Client> = new Map();
    private transports: Map<string, StdioClientTransport | SSEClientTransport> = new Map();

    constructor() {
        // Load enabled servers on startup could be placed here or called explicitly
    }

    async startAll() {
        const servers = this.listServers();
        for (const server of servers) {
            if (server.enabled) {
                try {
                    await this.connect(server.id);
                } catch (e) {
                    console.error(`Failed to auto-start MCP server ${server.name}:`, e);
                }
            }
        }
    }

    listServers(): McpServerConfig[] {
        const rows = db.prepare('SELECT * FROM mcp_servers').all() as any[];
        return rows.map(row => ({
            ...row,
            args: row.args ? JSON.parse(row.args) : [],
            env: row.env ? JSON.parse(row.env) : {},
            enabled: !!row.enabled
        }));
    }

    getServer(id: string): McpServerConfig | undefined {
        const row = db.prepare('SELECT * FROM mcp_servers WHERE id = ?').get(id) as any;
        if (!row) return undefined;
        return {
            ...row,
            args: row.args ? JSON.parse(row.args) : [],
            env: row.env ? JSON.parse(row.env) : {},
            enabled: !!row.enabled
        };
    }

    addServer(config: Omit<McpServerConfig, 'id' | 'status'>) {
        const id = uuidv4();
        db.prepare(`
            INSERT INTO mcp_servers (id, name, type, command, args, env, url, enabled, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'stopped')
        `).run(
            id,
            config.name,
            config.type || 'stdio',
            config.command || '',
            JSON.stringify(config.args || []),
            JSON.stringify(config.env || {}),
            config.url || null,
            config.enabled ? 1 : 0
        );
        return this.getServer(id);
    }

    updateServer(id: string, config: Partial<McpServerConfig>) {
        const current = this.getServer(id);
        if (!current) throw new Error('Server not found');

        const updates: string[] = [];
        const values: any[] = [];

        if (config.name !== undefined) { updates.push('name = ?'); values.push(config.name); }
        if (config.type !== undefined) { updates.push('type = ?'); values.push(config.type); }
        if (config.command !== undefined) { updates.push('command = ?'); values.push(config.command); }
        if (config.args !== undefined) { updates.push('args = ?'); values.push(JSON.stringify(config.args)); }
        if (config.env !== undefined) { updates.push('env = ?'); values.push(JSON.stringify(config.env)); }
        if (config.url !== undefined) { updates.push('url = ?'); values.push(config.url); }
        if (config.enabled !== undefined) { updates.push('enabled = ?'); values.push(config.enabled ? 1 : 0); }

        if (updates.length > 0) {
            values.push(id);
            db.prepare(`UPDATE mcp_servers SET ${updates.join(', ')} WHERE id = ?`).run(...values);
        }
        return this.getServer(id);
    }

    deleteServer(id: string) {
        this.stop(id);
        db.prepare('DELETE FROM mcp_servers WHERE id = ?').run(id);
    }

    async connect(id: string) {
        const config = this.getServer(id);
        if (!config) throw new Error('Server not found');

        if (this.clients.has(id)) {
            console.log(`MCP Server ${config.name} already connected.`);
            return;
        }

        console.log(`Starting MCP Server: ${config.name} type=${config.type}`);

        try {
            let transport;

            if (config.type === 'sse' || config.type === 'http') {
                if (!config.url) throw new Error('URL is required for SSE/HTTP transport');
                // SSE Client Transport for SDK
                transport = new SSEClientTransport(new URL(config.url));
            } else {
                transport = new StdioClientTransport({
                    command: config.command,
                    args: config.args,
                    env: { ...process.env, ...config.env } as Record<string, string>
                });
            }

            const client = new Client({
                name: "memory-hub-daemon",
                version: "1.0.0",
            }, {
                capabilities: {}
            });

            await client.connect(transport);

            this.transports.set(id, transport);
            this.clients.set(id, client);

            this.updateStatus(id, 'running');
            console.log(`MCP Server ${config.name} connected successfully.`);

        } catch (e: any) {
            console.error(`Error connecting to MCP Server ${config.name}:`, e);
            this.updateStatus(id, 'error');
            throw e;
        }
    }

    async stop(id: string) {
        const client = this.clients.get(id);
        const transport = this.transports.get(id);

        if (client) {
            try { await client.close(); } catch { }
            this.clients.delete(id);
        }
        if (transport) {
            try { await transport.close(); } catch { }
            this.transports.delete(id);
        }

        this.updateStatus(id, 'stopped');
    }

    private updateStatus(id: string, status: 'stopped' | 'running' | 'error') {
        db.prepare('UPDATE mcp_servers SET status = ? WHERE id = ?').run(status, id);
    }

    async listTools(id: string) {
        const client = this.clients.get(id);
        if (!client) throw new Error('Server not connected');
        return await client.listTools();
    }

    async callTool(id: string, toolName: string, args: any) {
        const client = this.clients.get(id);
        if (!client) throw new Error('Server not connected');
        return await client.callTool({
            name: toolName,
            arguments: args
        });
    }

    getClient(id: string) {
        return this.clients.get(id);
    }
}

export const mcpClientService = new McpClientService();
