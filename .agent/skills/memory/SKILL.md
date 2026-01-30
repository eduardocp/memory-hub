---
name: Memory
description: Instructions to manipulate and save project context avoiding data loss
---

# Memory

The memory skill provides persistent long-term memory for the project, allowing agents to store and retrieve context, decisions, and knowledge.

## When to use this skill

- Use this at the start of every task to understand the project's history and active context.
- Use this when making significant architectural decisions or completing milestones to save state.
- This is helpful for maintaining consistency with past work and avoiding regression.

## Tools

- Project name to be used in all memory operations is: `memory-hub`
- `memory_list`: Get all project events.
- `memory_add(text, type)`: Save event. Types: `note`, `idea`, `task_update`.