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
        description: 'Access repositories, issues, and pull requests.',
        type: 'stdio',
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-github'],
        env: {
            'GITHUB_TOKEN': '{{TOKEN}}'
        },
        auth: {
            type: 'oauth', // GitHub uses Device flow usually for CLI, but we can do Web Flow
            oauth: {
                authorizationUrl: 'https://github.com/login/oauth/authorize',
                tokenUrl: 'https://github.com/login/oauth/access_token',
                scope: 'repo user',
                clientIdEnv: 'GITHUB_CLIENT_ID',
                clientSecretEnv: 'GITHUB_CLIENT_SECRET'
            }
        }
    }
];
