ALTER TABLE mcp_servers ADD COLUMN auth_config TEXT; -- JSON object { type: 'none'|'basic'|'bearer'|'custom', data: { ... } }
