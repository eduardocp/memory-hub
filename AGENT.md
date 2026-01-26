# Memory Hub – Agent Instructions

## 1. Memory MCP Specification

### Purpose
Provide a minimal interface for recording, listing, and clearing memory events inside each project.

### Recommended Technology
- Language: TypeScript or JavaScript  
- Runtime: Node.js  
- Interface: MCP (Model Context Protocol) server  
- Storage: Local JSON file per project  

### Responsibilities
- Create and maintain `<project-root>/.agent/memory/memory.json` inside each project.
- Append new events.
- Return all events.
- Clear events.

### Non-responsibilities
- Triggers  
- Scheduled tasks  
- Integrations  
- Automation logic  

### File Structure
    /<project-root>/
      .agent/
        memory/
          memory.json

### JSON Format
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

### Event Types
- note  
- idea  
- task_update  
- summary  
- system
- new_bug
- bug_update
- spike_progress
- new_feat  

### MCP Tools (API Methods)
- `memory.add(text, type="note")`  
  Appends a new event to `memory.json`.

- `memory.list()`  
  Returns all events.

- `memory.clear()`  
  Removes all events.

---

## 2. Daemon Specification

### Purpose
Monitor project memory files, process events, execute triggers, run schedules, and serve data to the frontend.

### Recommended Technology
- Language: TypeScript or JavaScript  
- Runtime: Node.js  
- HTTP: Express or Fastify  
- Database: SQLite (via better-sqlite3, Prisma, or Knex)  
- File watching: chokidar  

### Responsibilities
- Watch `<project-root>/<folder_decided_by_user>/memory.json` files.
- Detect new events.
- Insert events into a global SQLite database.
- Execute triggers.
- Execute scheduled tasks.
- Provide REST API for the frontend.
- (Optional) Emit real-time updates via WebSocket or SSE.

### Non-responsibilities
- Editing project files.
- Rendering UI.
- Running inside the editor.

### Architecture (High-Level)
- File watcher  
- Event parser  
- SQLite writer  
- Trigger engine  
- Schedule runner  
- HTTP API server  
- (Optional) WebSocket/SSE server  

### API Endpoints
- `GET /status`  
- `GET /projects`  
- `GET /events`  
  - Query params: `project?`, `type?`, `from?`, `to?`, `limit?`, `offset?`

- `POST /trigger/run`  
- `POST /schedule/run`

### Event Processing Flow
1. Detect file change.  
2. Read new events.  
3. Insert new events into SQLite.  
4. Evaluate triggers.  
5. Execute trigger actions.  
6. Update schedules if needed.  

### SQLite Database Location
    ~/memory-hub/global.db

### SQLite Tables
- events  
- triggers  
- schedules  

---

## 3. Frontend Timeline Specification

### Purpose
Display all events from the daemon in a clean, Linear-inspired interface focused on clarity and productivity.

### Recommended Technology
- Framework: React (Next.js or Vite + React)  
- Language: TypeScript  
- UI: Tailwind CSS + Radix UI or shadcn/ui  
- Data fetching: React Query or SWR  

### Pages (v1)
- Timeline (main page)
- Triggers (future)
- Schedules (future)
- Settings (future)

### First Page to Implement
Timeline

### Layout – Timeline
- Header:
  - Title: “Timeline”
  - Daemon status indicator
  - Global search bar
  - “Add Note” button

- Body:
  - Events grouped by day
  - Minimalist event cards
  - Hover actions (edit, delete, details)
  - Optional drawer for event details

### Components
- TimelinePage  
- Header  
- SearchBar  
- DaemonStatusIndicator  
- EventList  
- DayGroup  
- EventCard  
- EventDetailsDrawer  
- AddNoteModal  

### Event Types (UI)
- note → neutral icon  
- idea → lightbulb icon  
- task_update → refresh/update icon  
- summary → star icon  
- system → gear icon  

### Wireframe (ASCII)
    Timeline                         ○ Daemon active
    [Search events...]               + Add Note

    Today — Jan 24, 2026
    ● Updated ABC-123 to "In Review"          00:25
      [task_update]  [Project: backend-api]

    ● Idea: automate weekly summary           00:10
      [idea]  [Project: backend-api]

    ● Note: meeting with QA at 3pm            00:05
      [note]  [Project: mobile-app]

    Yesterday — Jan 23, 2026
    ● Daily summary generated automatically   18:00
      [summary]  [Project: backend-api]

    ● Started reviewing PR #88                14:55
      [note]  [Project: backend-api]

    ● Trigger "Update Jira" executed          14:40
      [system]  [Project: backend-api]

### Styling Guidelines (Linear-inspired)
- **Theme**
  - Dark mode  
  - Background: `#1A1A1A`  
  - Cards: `#111111`  
  - Borders: `#2A2A2A`  

- **Typography**
  - Inter or similar  
  - Title: 20–22px  
  - Event text: 14–15px  
  - Timestamp: 12px  

- **Colors**
  - Primary text: `#FFFFFF`  
  - Secondary text: `#A0A0A0`  
  - Disabled: `#5A5A5A`  
  - Accent: `#7B61FF`  
  - Success: `#2ECC71`  
  - Error: `#FF5F56`  

- **Interactions**
  - Hover: subtle background change  
  - Hover actions appear only on hover  
  - Smooth transitions (150–200ms)  

---

## 4. Data Format Specification

### 4.1 memory.json Schema (per project)
    {
      "events": [
        {
          "id": "uuid",
          "timestamp": "ISO-8601",
          "type": "string",
          "text": "string",
          "project": "string"
        }
      ]
    }

### 4.2 SQLite Schema (global daemon DB)

#### Table: events
- id TEXT PRIMARY KEY  
- timestamp TEXT  
- type TEXT  
- text TEXT  
- project TEXT  
- source TEXT  
- created_at TEXT  

#### Table: triggers
- id INTEGER PRIMARY KEY AUTOINCREMENT  
- name TEXT  
- project TEXT NULL  
- event_type TEXT NULL  
- match_text TEXT NULL  
- action_type TEXT  
- action_payload TEXT  
- enabled INTEGER  
- created_at TEXT  
- updated_at TEXT  

#### Table: schedules
- id INTEGER PRIMARY KEY AUTOINCREMENT  
- name TEXT  
- cron TEXT  
- action_type TEXT  
- action_payload TEXT  
- enabled INTEGER  
- last_run_at TEXT NULL  
- created_at TEXT  
- updated_at TEXT  

---

## 5. High-Level Flow Summary

1. **Inside each project (MCP)**  
   - The agent calls `memory.add()` to record notes, ideas, updates, summaries.  
   - MCP writes/updates `<project-root>/<folder_decided_by_user>/memory.json`.

2. **Daemon**  
   - Watches for changes in `<project-root>/<folder_decided_by_user>/memory.json`.  
   - Reads new events and stores them in SQLite.  
   - Evaluates triggers and schedules.  
   - Executes actions.  
   - Exposes HTTP API for the frontend.

3. **Frontend (Timeline)**  
   - Fetches events from `GET /events`.  
   - Renders a Linear-style timeline.  
   - Allows search, filtering, and event details.  
   - (Future) Allows managing triggers and schedules.