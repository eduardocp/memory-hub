export interface McpPreset {
    id: string;
    name: string;
    description: string;
    icon?: string; // Lucide icon name
    command?: string;
    args?: string[];
    env?: Record<string, string>;
    url?: string; // For SSE/HTTP
    type: 'stdio' | 'sse' | 'http';
    auth: {
        type: 'oauth' | 'basic' | 'bearer' | 'none';
        oauth?: {
            authorizationUrl: string;
            tokenUrl: string;
            scope: string;
            // We might expect Client ID/Secret to be injected via env vars or settings
            clientIdEnv?: string;
            clientSecretEnv?: string;
        }
    }
}

export const MCP_PRESETS: McpPreset[] = [
    {
        id: 'jira',
        name: 'Jira',
        description: 'Connect to Atlassian Jira to manage issues and projects.',
        type: 'sse',
        url: 'https://mcp.atlassian.com/v1/sse',
        auth: {
            type: 'oauth'
            // No manual OAuth config needed - Atlassian MCP supports Dynamic Client Registration
        }
    },
    {
        id: 'github',
        name: 'GitHub',
        description: 'Official GitHub MCP Server. Requires a Personal Access Token (PAT) with appropriate scopes.',
        type: 'http',
        url: 'https://api.githubcopilot.com/mcp/',
        auth: {
            type: 'bearer'
        }
    }
];
