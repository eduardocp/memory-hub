import cron from 'node-cron';
import { generateDailySummary } from './ai.js';
import { generateReport } from './reports.js';
import db from './db.js';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';

const jobs: Record<string, cron.ScheduledTask> = {};

export function initScheduler() {
    console.log('Initializing Scheduler...');
    const triggers = db.prepare("SELECT * FROM triggers WHERE enabled = 1 AND type = 'cron'").all() as any[];

    triggers.forEach(t => {
        scheduleTrigger(t);
    });

    console.log(`Scheduler: ${triggers.length} tasks active.`);
}

export function scheduleTrigger(trigger: any) {
    // Stop existing if any (re-scheduling)
    if (jobs[trigger.id]) {
        jobs[trigger.id].stop();
        delete jobs[trigger.id];
    }

    if (!trigger.enabled) return;

    if (!cron.validate(trigger.schedule)) {
        console.error(`Invalid cron schedule for trigger ${trigger.name} (${trigger.id}): ${trigger.schedule}`);
        return;
    }

    console.log(`Scheduling trigger '${trigger.name}' for ${trigger.schedule}`);

    jobs[trigger.id] = cron.schedule(trigger.schedule, async () => {
        console.log(`🕒 Trigger FIRED: ${trigger.name}`);
        try {
            await executeAction(trigger);

            // Update last_run
            db.prepare('UPDATE triggers SET last_run = ? WHERE id = ?')
                .run(new Date().toISOString(), trigger.id);

        } catch (e: any) {
            console.error(`❌ Trigger execution failed (${trigger.name}):`, e);
        }
    });
}

export function removeTriggerJob(id: string) {
    if (jobs[id]) {
        jobs[id].stop();
        delete jobs[id];
    }
}

async function executeAction(trigger: any) {
    let config: any = {};
    try {
        config = JSON.parse(trigger.config || '{}');
    } catch (e) {
        console.error("Invalid trigger config JSON");
        return;
    }

    if (trigger.action === 'daily_summary') {
        const project = config.project;
        if (project) {
            console.log(`Running Daily Summary for ${project}`);
            await generateDailySummary(project);
        } else {
            console.log("Running Global Daily Summary (Iterating all active projects)");
            const projects = db.prepare('SELECT name FROM projects WHERE watch_enabled = 1').all() as { name: string }[];
            for (const p of projects) {
                try {
                    await generateDailySummary(p.name);
                } catch (e) {
                    console.error(`Failed summary for ${p.name}:`, e);
                }
            }
        }
    }
    else if (trigger.action === 'generate_report') {
        const { templateId, project } = config;

        console.log(`Running Report ${templateId} for ${project}`);
        const result = await generateReport(templateId, project);

        // Save logic (similar to ai.ts, should probably be centralized)
        if (project && result.report) {
            saveEvent(project, {
                type: 'report',
                text: `# ${result.template}\n\n${result.report}`,
                source: 'scheduler'
            });
        }
    }
}

// Helper duplicating logic from AI/Git to save event. 
// Refactor opportunity: Move 'saveEvent' to a shared service.
function saveEvent(projectName: string, eventData: any) {
    const projectRow = db.prepare('SELECT path FROM projects WHERE name = ?').get(projectName) as { path: string } | undefined;
    if (!projectRow) return;

    const memoryPath = path.join(projectRow.path, 'memory.json');
    let memory = { events: [] as any[] };

    if (fs.existsSync(memoryPath)) {
        try {
            memory = JSON.parse(fs.readFileSync(memoryPath, 'utf-8'));
        } catch { }
    }

    const newEvent = {
        id: uuidv4(),
        timestamp: new Date().toISOString(),
        ...eventData,
        project: projectName
    };

    memory.events.push(newEvent);
    fs.writeFileSync(memoryPath, JSON.stringify(memory, null, 2));

    // Also insert to DB? (The watcher does this, but direct write might be faster/safer)
    // For now, rely on Watcher to pick up file change.
}
