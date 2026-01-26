# Memory Hub

Memory Hub is an application for managing contextual events across projects. The main components include:

## Components

### MCP (Model Context Protocol)
Local event management per project via a minimal MCP server interface.

**Responsibilities:**
- Create and maintain `<folder_decided_by_user>/memory.json` inside each project
- Append new events
- Return all events
- Clear events

**API Methods:**
- `memory.add(text, type="note")` - Appends a new event
- `memory.list()` - Returns all events
- `memory.clear()` - Removes all events

**Event Types:** `note`, `idea`, `task_update`, `summary`, `system`

---

### Daemon
Central watchdog service that monitors project memory files, processes events, executes triggers, runs schedules, and serves data to the frontend.

**Responsibilities:**
- Watch `<folder_decided_by_user>/memory.json` files
- Detect new events and insert into global SQLite database
- Execute triggers and scheduled tasks
- Provide REST API for the frontend

**API Endpoints:**
- `GET /status`
- `GET /projects`
- `GET /events` (with query params: `project?`, `type?`, `from?`, `to?`, `limit?`, `offset?`)
- `POST /trigger/run`
- `POST /schedule/run`

**Database Location:** `~/memory-hub/global.db`

---

### Frontend (Timeline)
A clean, Linear-inspired interface for displaying all events with clarity and focus on productivity.

**Features:**
- Timeline page with events grouped by day
- Dark mode theme
- Search and filtering
- Daemon status indicator
- Event details drawer

---

## Project Structure

```
/<project-root>/
  <folder_decided_by_user>/
    memory.json

~/memory-hub/
  global.db
```

## Data Format

### memory.json Schema (per project)
```json
{
  "events": [
    {
      "id": "uuid",
      "timestamp": "ISO-8601",
      "type": "note",
      "text": "content",
      "project": "project-name"
    }
  ]
}
```

### SQLite Tables
- **events** - id, timestamp, type, text, project, source, created_at
- **triggers** - id, name, project, event_type, match_text, action_type, action_payload, enabled, created_at, updated_at
- **schedules** - id, name, cron, action_type, action_payload, enabled, last_run_at, created_at, updated_at

---

## Technology Stack

- **Language:** TypeScript
- **Runtime:** Node.js
- **MCP Interface:** Model Context Protocol server
- **Daemon:** Express/Fastify + chokidar + better-sqlite3
- **Frontend:** React (Next.js or Vite) + Tailwind CSS + Radix UI/shadcn

---

## Getting Started

_Coming soon..._

---

## License

MIT