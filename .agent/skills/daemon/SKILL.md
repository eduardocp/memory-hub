---
name: Daemon Development
description: Guidelines for developing the backend Daemon, including architecture, file structure, and core services.
---

# Daemon Development

The Daemon is the core backend service of Memory Hub, running as a Node.js process using **Express** and **Socket.io**. It handles file watching, AI processing, database management, and MCP server integrations.

## When to use this skill

- Use this when implementing backend logic, API endpoints, background tasks, or system integrations.
- This is helpful for navigating the daemon architecture, database interactions, and service patterns.

## Tech Stack

- **Runtime**: Node.js (ES Modules)
- **Framework**: Express (REST API)
- **Realtime**: Socket.io
- **Database**: efficient-sqlite3 (SQLite)
- **Task Scheduling**: node-cron
- **Validation**: Zod
- **AI SDKs**: Google Generative AI, Anthropic SDK, OpenAI SDK
- **MCP**: Model Context Protocol SDK

## Directory Structure (`packages/daemon/src`)

- `index.ts`: Entry point. Sets up Express server, Socket.io, and middleware.
- `db.ts`: Database connection and schema initialization (`better-sqlite3`).
- `ai.ts`: AI service integration (LLM providers).
- `git.ts`: Git operations and history tracking.
- `watcher.ts`: File system watcher (`chokidar`) implementation.
- `scheduler.ts`: Cron job management.
- `mcp-client.ts`: Client logic for connecting to MCP servers.
- `migrations/`: SQL migration files (See **Database Management** skill).
- `templates/`: Templates for generated content.

## Core Concepts

### Architecture
The daemon acts as a central hub:
1.  **REST API**: Serving the Web UI (`packages/web`).
2.  **WebSocket Server**: Pushing real-time updates (logs, file changes) to the frontend.
3.  **Background Services**:
    - **Watcher**: Monitors file changes in projects to trigger auto-syncs or AI analysis.
    - **Scheduler**: Runs periodic tasks like "Morning Reports".
    - **MCP Host**: Connects to other tools via MCP.

### Development Workflow

1.  **Start Dev Server**:
    ```bash
    npm run dev --workspace=@memory-hub/daemon
    ```
    This uses `tsx watch` to auto-restart on file changes.

2.  **Database Access**:
    Import the singleton `db` instance from `./db.ts`.
    ```typescript
    import db from './db';
    const row = db.prepare('SELECT * FROM users').get();
    ```

3.  **Environment Variables**:
    Ensure `.env` or system variables are set for sensitive keys (e.g., `GEMINI_API_KEY`, `ANTHROPIC_API_KEY`).

## Key Services

- **AI Service (`ai.ts`)**: abstract methods to call different providers. Use `generateText` or specialized methods.
- **Git Service (`git.ts`)**: Wrappers around simple-git for commit history and diffs.
- **Watcher Service (`watcher.ts`)**: specialized logic to debounce file system events and update the `project_files` table or trigger tasks.

## Error Handling

- Use standard `try/catch` blocks.
- Log errors to the console (which is captured by the daemon logger and sent to the UI).
- Return appropriate HTTP status codes in Express routes (400 for bad input, 500 for server errors).
