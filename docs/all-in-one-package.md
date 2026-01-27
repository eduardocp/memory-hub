# Memory Hub - All-in-One Package

> Your External Brain - A single package that installs CLI, daemon, web UI, and MCP server.

## Installation

```bash
npm install -g @memory-hub/app
```

## Quick Start

```bash
# 1. Start the daemon (runs web UI at http://localhost:3000)
memory-hub start

# 2. Open web UI in browser
memory-hub open

# 3. In any project folder, register it
cd /path/to/your/project
mem init

# 4. Add a memory
mem add "Implemented user authentication"

# 5. List recent memories
mem list
```

## Commands

### Main Commands (`memory-hub`)

| Command | Description |
|---------|-------------|
| `memory-hub start` | Start the daemon and web server |
| `memory-hub stop` | Stop the daemon |
| `memory-hub restart` | Restart the daemon |
| `memory-hub status` | Show daemon status |
| `memory-hub logs` | Show daemon logs |
| `memory-hub open` | Open web UI in browser |

### CLI Commands (`mem`)

| Command | Description |
|---------|-------------|
| `mem init` | Register current directory as a project |
| `mem add [text]` | Add a new memory event |
| `mem list` | List recent memories |

### Options for `mem add`

- `-t, --type <type>` - Event type (note, idea, task_update, new_feat, new_bug, spike_progress)
- `-p, --project <name>` - Project name (defaults to directory name)

## Data Storage

All data is stored in `~/.memory-hub/`:

| File | Description |
|------|-------------|
| `memory-hub.db` | SQLite database with events and settings |
| `daemon.log` | Daemon logs |
| `daemon.pid` | PID file for daemon management |

## MCP Server

Memory Hub includes an MCP server for integration with AI assistants like Claude or Cursor.

### Configuration for Claude Desktop

```json
{
  "mcpServers": {
    "memory-hub": {
      "command": "npx",
      "args": ["@memory-hub/app", "mcp"]
    }
  }
}
```

### Configuration for Cursor

Add to your `.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "memory-hub": {
      "command": "npx",
      "args": ["@memory-hub/mcp-server"],
      "env": {
        "MEMORY_FOLDER_PATH": "/path/to/project"
      }
    }
  }
}
```

## Development

```bash
# Clone the repository
git clone https://github.com/eduardocp/memory-hub.git
cd memory-hub

# Install dependencies
npm install

# Build all packages
npm run build:app

# Link for local testing
cd packages/app
npm link
```

## Architecture

```
+-------------------------------------------------------------------+
|                        @memory-hub/app                            |
+-------------------------------------------------------------------+
|  bin/                                                             |
|    - memory-hub.js  --> Manager (start/stop/status)               |
|    - mem.js         --> CLI (init/add/list)                       |
+-------------------------------------------------------------------+
|  daemon/            --> Express + Socket.io + SQLite              |
|  web/               --> React + Vite (static build)               |
|  cli/               --> Commander.js CLI                          |
|  mcp-server/        --> MCP Protocol Server                       |
+-------------------------------------------------------------------+
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `WEB_DIST_PATH` | Path to built frontend | Automatic |
| `MEMORY_HUB_DATA_DIR` | Data directory | `~/.memory-hub` |
| `MEMORY_FOLDER_PATH` | Path for MCP server | Current directory |

## Data Flow

```
+----------+     +----------+     +----------+
|   CLI    |---->|  Daemon  |<----|   Web    |
|  (mem)   |     |  (API)   |     | (React)  |
+----------+     +----+-----+     +----------+
                      |
              +-------+-------+
              |               |
              v               v
        +----------+   +-------------+
        |  SQLite  |   | memory.json |
        | (global) |   | (per proj.) |
        +----------+   +-------------+
```

## Requirements

- Node.js >= 18.0.0
- npm >= 8.0.0

## License

MIT
