# Memory Hub

> Your External Brain - All-in-one package for managing project memories.

## Installation

```bash
npm install -g @memory-hub/app
```

## Quick Start

```bash
# Start the daemon (runs web UI at http://localhost:3000)
memory-hub start

# Open web UI in browser
memory-hub open

# In any project directory, register it
cd /path/to/your/project
mem init

# Add a memory
mem add "Implemented user authentication"

# List recent memories
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

- `-t, --type <type>` - Type of event (note, idea, task_update, new_feat, new_bug, spike_progress)
- `-p, --project <name>` - Project name (defaults to directory name)

## Data Storage

All data is stored in `~/.memory-hub/`:

- `memory-hub.db` - SQLite database with events and settings
- `daemon.log` - Daemon logs
- `daemon.pid` - PID file for daemon management

## MCP Server

Memory Hub includes an MCP server for integration with AI assistants like Claude or Cursor.

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

## License

MIT
