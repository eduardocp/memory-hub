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
        const gitRoot = this.findGitRoot(project.path);

        if (!gitRoot) {
            // console.log(`[Git] No .git found for ${project.name} (checked up to root)`);
            return;
        }

        // 1. Get User Email
        let userEmail = '';
        try {
            const { stdout } = await execPromise('git config user.email', { cwd: gitRoot });
            userEmail = stdout.trim();
        } catch {
            return; // Git config not found or error
        }

        if (!userEmail) return;

        // 2. Determine time range (default to 24h ago if first run, or last check)
        // Actually, we should check DB for latest git event to be safer across restarts
        const lastEvent = db.prepare("SELECT timestamp FROM events WHERE project = ? AND source = 'git' ORDER BY timestamp DESC LIMIT 1").get(project.name) as { timestamp: string };

        let sinceOption = '';
        if (lastEvent) {
            // Add 1 second to avoid duplicates boundary
            const date = new Date(lastEvent.timestamp);
            date.setSeconds(date.getSeconds() + 1);
            sinceOption = `--since="${date.toISOString()}"`;
        } else {
            // If never synced, get last 7 days maybe? Or just today? Let's do 3 days safe.
            sinceOption = '--since="3 days ago"';
        }

        // 3. Fetch Commits
        // Format: Hash|ISO-Date|Message
        const cmd = `git log --author="${userEmail}" ${sinceOption} --pretty=format:"%H|%aI|%s" --no-merges`;

        try {
            const { stdout } = await execPromise(cmd, { cwd: gitRoot });
            if (!stdout.trim()) return;

            const lines = stdout.split('\n');
            const insert = db.prepare(`
                INSERT OR IGNORE INTO events (id, timestamp, type, text, project, source)
                VALUES (?, ?, 'git_commit', ?, ?, 'git')
            `);

            db.transaction(() => {
                for (const line of lines) {
                    if (!line.trim()) continue;
                    const [hash, date, msg] = line.split('|');

                    // ID will be "git-<hash>" to ensure global uniqueness and idempotency
                    const id = `git-${hash}`;

                    insert.run(id, date, msg, project.name);
                    console.log(`[Git] Imported commit: ${msg} (${project.name})`);
                }
            })();

        } catch (e) {
            console.error(`Error reading git log for ${project.name}:`, e);
        }
    }
}

export const gitService = new GitService();
