import { exec } from 'child_process';
import util from 'util';
import db from './db.js';
import path from 'path';
import fs from 'fs';

const execPromise = util.promisify(exec);

// Cache to store last check timestamp per project to avoid heavy git logs
const lastCheck: Record<string, number> = {};

export class GitService {
    /* 
     * Scans all registered projects for git repositories 
     * and syncs commits from the current user.
     */
    async syncAllProjects() {
        const setting = db.prepare("SELECT value FROM settings WHERE key = 'system.git_sync_enabled'").get() as { value: string } | undefined;
        if (setting && setting.value === 'false') {
            // console.log('Git Sync skipped (disabled)');
            return;
        }

        console.log('Starting Git Sync...');
        const projects = db.prepare('SELECT * FROM projects').all() as { id: string, path: string, name: string }[];

        for (const project of projects) {
            try {
                await this.syncProject(project);
            } catch (error) {
                console.error(`Failed to sync git for project ${project.name}:`, error);
            }
        }
        console.log('Git Sync Completed.');
    }

    async syncProjectNow(projectPath: string) {
        // Find project by path
        const project = db.prepare('SELECT * FROM projects WHERE path = ?').get(projectPath) as { id: string, path: string, name: string } | undefined;
        if (!project) {
            // Maybe it's a subdirectory? Try to find root.
            // For now, assume exact match or close enough to be found by finding registered parents
            // Simple fallback: scan all projects and see if path starts with property
            const allProjects = db.prepare('SELECT * FROM projects').all() as { id: string, path: string, name: string }[];
            const match = allProjects.find(p => projectPath.startsWith(p.path));

            if (match) {
                await this.syncProject(match);
                return { success: true, project: match.name };
            }

            throw new Error('Project not tracked by Memory Hub');
        }

        await this.syncProject(project);
        return { success: true, project: project.name };
    }

    private findGitRoot(startPath: string): string | null {
        let current = startPath;
        const root = path.parse(current).root;

        while (current !== root) {
            if (fs.existsSync(path.join(current, '.git'))) {
                return current;
            }
            current = path.dirname(current);
        }
        // Check root one last time (though unlikely on Windows to have .git at C:\)
        if (fs.existsSync(path.join(current, '.git'))) {
            return current;
        }
        return null;
    }

    private async syncProject(project: { id: string, path: string, name: string }) {
        // ... (findGitRoot logic)
        const gitRoot = this.findGitRoot(project.path);
        if (!gitRoot) return;

        // ... (User Email logic stays same)
        let userEmail = '';
        try {
            const { stdout } = await execPromise('git config user.email', { cwd: gitRoot });
            userEmail = stdout.trim();
        } catch { return; }
        if (!userEmail) return;

        // 2. Check last event (Update query to use JOIN)
        const lastEvent = db.prepare(`
            SELECT e.timestamp 
            FROM events e 
            LEFT JOIN projects p ON e.project_id = p.id
            WHERE p.name = ? AND e.source = 'git' 
            ORDER BY e.timestamp DESC LIMIT 1
        `).get(project.name) as { timestamp: string };

        // ... (sinceOption logic stays same)
        let sinceOption = '';
        if (lastEvent) {
            const date = new Date(lastEvent.timestamp);
            date.setSeconds(date.getSeconds() + 1);
            sinceOption = `--since="${date.toISOString()}"`;
        } else {
            sinceOption = '--since="3 days ago"';
        }

        const cmd = `git log --author="${userEmail}" ${sinceOption} --pretty=format:"%H|%aI|%s" --no-merges`;

        try {
            const { stdout } = await execPromise(cmd, { cwd: gitRoot });
            if (!stdout.trim()) return;

            const lines = stdout.split('\n');
            // FIX: Use project_id
            const insert = db.prepare(`
                INSERT OR IGNORE INTO events (id, timestamp, type, text, project_id, source, created_at)
                VALUES (?, ?, 'git_commit', ?, ?, 'git', datetime('now'))
            `);

            db.transaction(() => {
                for (const line of lines) {
                    if (!line.trim()) continue;
                    const [hash, date, msg] = line.split('|');
                    const id = `git-${hash}`;

                    insert.run(id, date, msg, project.id);
                    console.log(`[Git] Imported commit: ${msg} (${project.name})`);
                }
            })();

        } catch (e) {
            console.error(`Error reading git log for ${project.name}:`, e);
        }
    }
}

export const gitService = new GitService();
