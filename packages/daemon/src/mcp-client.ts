import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import { OAuthClientProvider } from '@modelcontextprotocol/sdk/client/auth.js';
import { OAuthTokens, OAuthClientMetadata } from '@modelcontextprotocol/sdk/shared/auth.js';
import db from './db.js';
import { v4 as uuidv4 } from 'uuid';
import { Response } from 'express';

export interface McpServerConfig {
    id: string;
    name: string;
    type: string;
    command: string;
    args: string[];
    env: Record<string, string>;
    url?: string;
    auth_config?: {
        type: 'none' | 'basic' | 'bearer' | 'custom' | 'oauth';
        data?: any;
    };
    enabled: boolean;
    status: 'stopped' | 'running' | 'error';
}

import { MCP_PRESETS } from './presets.js';

class DatabaseOAuthProvider implements OAuthClientProvider {
    constructor(private serverId: string) { }

    private getServer() {
        // We use fresh DB read to ensure we have latest tokens/state
        const row = db.prepare('SELECT auth_config FROM mcp_servers WHERE id = ?').get(this.serverId) as { auth_config: string };
        if (!row || !row.auth_config) throw new Error('Server config not found');
        return JSON.parse(row.auth_config);
    }

    private updateConfig(config: any) {
        db.prepare('UPDATE mcp_servers SET auth_config = ? WHERE id = ?')
            .run(JSON.stringify(config), this.serverId);
    }

    get redirectUrl(): URL {
        return new URL('http://localhost:3000/mcp/auth/callback');
    }

    // clientMetadata is used for Dynamic Client Registration
    // It describes what kind of client we want to register
    get clientMetadata(): any {
        return {
            redirect_uris: [this.redirectUrl.toString()],
            grant_types: ['authorization_code', 'refresh_token'],
            response_types: ['code'],
            client_name: 'Memory Hub',
            token_endpoint_auth_method: 'none' // Public client
        };
    }

    // Returns saved client information after registration, or null if not yet registered
    // SDK will call saveClientInformation after dynamic registration
    async clientInformation(): Promise<any | undefined> {
        const config = this.getServer();
        const data = config.data || {};

        // If we have saved client info from DCR, return it
        if (data.clientInfo) {
            return data.clientInfo;
        }

        // If user provided manual client_id, use that
        if (data.clientId) {
            return {
                client_id: data.clientId,
                client_secret: data.clientSecret
            };
        }

        // Return undefined to trigger Dynamic Client Registration
        return undefined;
    }

    // SDK calls this after Dynamic Client Registration succeeds
    async saveClientInformation(clientInfo: any): Promise<void> {
        const config = this.getServer();
        if (!config.data) config.data = {};
        config.data.clientInfo = clientInfo;
        this.updateConfig(config);
        console.log("Saved DCR client info:", clientInfo.client_id);
    }

    async tokens(): Promise<OAuthTokens | undefined> {
        const config = this.getServer();
        return config.data?.tokens;
    }

    async saveTokens(tokens: OAuthTokens): Promise<void> {
        const config = this.getServer();
        if (!config.data) config.data = {};
        config.data.tokens = tokens;
        this.updateConfig(config);
        console.log("Saved OAuth tokens");
    }

    async redirectToAuthorization(authorizationUrl: URL): Promise<void> {
        // SDK calls this during auth flow - we save the URL for later redirect
        const config = this.getServer();
        if (!config.data) config.data = {};
        config.data.pendingAuthUrl = authorizationUrl.toString();
        this.updateConfig(config);
        console.log("Pending authorization URL saved:", authorizationUrl.toString());
    }

    async saveCodeVerifier(codeVerifier: string): Promise<void> {
        const config = this.getServer();
        if (!config.data) config.data = {};
        config.data.codeVerifier = codeVerifier;
        this.updateConfig(config);
    }

    async codeVerifier(): Promise<string> {
        const config = this.getServer();
        return config.data?.codeVerifier || '';
    }
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

    listServers(): (McpServerConfig & { isAuthenticated?: boolean })[] {
        const rows = db.prepare('SELECT * FROM mcp_servers').all() as any[];
        return rows.map(row => {
            const auth_config = row.auth_config ? JSON.parse(row.auth_config) : undefined;
            return {
                ...row,
                args: row.args ? JSON.parse(row.args) : [],
                env: row.env ? JSON.parse(row.env) : {},
                auth_config,
                enabled: !!row.enabled,
                // Add flag to indicate if OAuth tokens exist
                isAuthenticated: !!(auth_config?.data?.tokens?.access_token)
            };
        });
    }

    getServer(id: string): McpServerConfig | undefined {
        const row = db.prepare('SELECT * FROM mcp_servers WHERE id = ?').get(id) as any;
        if (!row) return undefined;
        return {
            ...row,
            args: row.args ? JSON.parse(row.args) : [],
            env: row.env ? JSON.parse(row.env) : {},
            auth_config: row.auth_config ? JSON.parse(row.auth_config) : undefined,
            enabled: !!row.enabled
        };
    }

    addServer(config: Omit<McpServerConfig, 'id' | 'status'>) {
        const id = uuidv4();
        db.prepare(`
            INSERT INTO mcp_servers (id, name, type, command, args, env, url, auth_config, enabled, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'stopped')
        `).run(
            id,
            config.name,
            config.type || 'stdio',
            config.command || '',
            JSON.stringify(config.args || []),
            JSON.stringify(config.env || {}),
            config.url || null,
            config.auth_config ? JSON.stringify(config.auth_config) : null,
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
        if (config.auth_config !== undefined) { updates.push('auth_config = ?'); values.push(JSON.stringify(config.auth_config)); }
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

                let authProvider;
                const headers: Record<string, string> = {};

                if (config.auth_config) {
                    const { type, data } = config.auth_config;
                    if (type === 'basic' && data?.username && data?.password) {
                        const encoded = Buffer.from(`${data.username}:${data.password}`).toString('base64');
                        headers['Authorization'] = `Basic ${encoded}`;
                    } else if (type === 'bearer' && data?.token) {
                        headers['Authorization'] = `Bearer ${data.token}`;
                    } else if (type === 'custom' && data?.headers) {
                        try {
                            const customHeaders = typeof data.headers === 'string' ? JSON.parse(data.headers) : data.headers;
                            Object.assign(headers, customHeaders);
                        } catch (e) {
                            console.error("Failed to parse custom headers", e);
                        }
                    } else if (type === 'oauth') {
                        authProvider = new DatabaseOAuthProvider(id);
                    }
                }

                // SSE Client Transport for SDK
                transport = new SSEClientTransport(new URL(config.url), {
                    eventSourceInit: { headers } as any,
                    requestInit: { headers },
                    authProvider: authProvider
                });
            } else {
                let finalEnv = { ...process.env, ...config.env } as Record<string, string>;

                // If OAuth, inject tokens into Env if placeholders exist
                if (config.auth_config?.type === 'oauth') {
                    try {
                        const authProvider = new DatabaseOAuthProvider(id);
                        const tokens = await authProvider.tokens();
                        if (tokens?.access_token) {
                            for (const key in config.env) {
                                if (config.env[key] === '{{TOKEN}}') {
                                    finalEnv[key] = tokens.access_token;
                                }
                            }
                        }
                    } catch (e) {
                        console.warn("Failed to inject OAuth tokens into Stdio env", e);
                    }
                }

                transport = new StdioClientTransport({
                    command: config.command,
                    args: config.args,
                    env: finalEnv
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

    // --- OAuth Flows ---

    // Initiate auth by attempting connection - SDK will populate pendingAuthUrl
    async startAuth(id: string, res: Response) {
        const config = this.getServer(id);
        if (!config) throw new Error('Server not found');

        // Clear any existing auth data to start fresh
        if (config.auth_config?.data) {
            delete config.auth_config.data.tokens;
            delete config.auth_config.data.clientInfo;
            delete config.auth_config.data.pendingAuthUrl;
            this.updateServer(id, { auth_config: config.auth_config });
        }

        // Attempt connection - will fail with UnauthorizedError but populate pendingAuthUrl
        try {
            await this.connect(id);
        } catch (e: any) {
            // Expected to fail with Unauthorized on first run
            console.log("Auth initiation:", e.message);
        }

        // Read back the pending auth URL saved by redirectToAuthorization
        const updatedConfig = this.getServer(id);
        const pendingUrl = updatedConfig?.auth_config?.data?.pendingAuthUrl;

        if (pendingUrl) {
            res.redirect(pendingUrl);
        } else {
            res.status(400).send('Failed to initiate OAuth flow. Server may not require authentication or there was an error.');
        }
    }

    async handleAuthCallback(code: string, state: string, res: Response) {
        try {
            // state contains the server ID, decode it
            let id: string;
            try {
                const stateJson = Buffer.from(state, 'base64').toString('ascii');
                id = JSON.parse(stateJson).id;
            } catch {
                // state is raw server id
                id = state;
            }

            if (!id) throw new Error("Invalid state: missing server id");

            const config = this.getServer(id);
            if (!config) throw new Error('Server not found');

            // Create transport with auth provider for token exchange
            const provider = new DatabaseOAuthProvider(id);

            // Create a temporary transport just to finish auth
            const transport = new SSEClientTransport(new URL(config.url!), {
                authProvider: provider
            });

            // Let SDK exchange the code for tokens
            await transport.finishAuth(code);

            res.send(`
                <html>
                <body style="background:#111; color:white; font-family:sans-serif; text-align:center; padding-top:50px;">
                    <h1>Authentication Successful</h1>
                    <p>You have successfully connected the MCP Server.</p>
                    <p>You can close this window now.</p>
                    <script>
                        if (window.opener) {
                            window.opener.postMessage('mcp-auth-success', '*');
                            window.close();
                        }
                    </script>
                </body>
                </html>
            `);

            // Try to auto-connect now that we have tokens
            this.connect(id).catch(e => console.error("Post-auth connect failed:", e));

        } catch (e: any) {
            console.error("Handle Callback Failed:", e);
            res.status(500).send(`Authentication Failed: ${e.message}`);
        }
    }
}

export const mcpClientService = new McpClientService();
