#!/usr/bin/env node
import { Command } from 'commander';
import path from 'path';
import chalk from 'chalk';
import inquirer from 'inquirer';
import axios from 'axios';
import figlet from 'figlet';
import gradient from 'gradient-string';
import boxen from 'boxen';

const program = new Command();
const API_URL = 'http://localhost:3000';

// --- Helpers ---

function printBanner() {
    const text = figlet.textSync('MEMORY HUB', { font: 'Standard' });
    console.log(gradient.pastel.multiline(text));
    console.log(chalk.gray('  YOUR EXTERNAL BRAIN CLI v1.0.0\n'));
}

function printError(msg: string) {
    console.log(boxen(chalk.red(msg), {
        title: 'ERROR',
        titleAlignment: 'center',
        borderStyle: 'double',
        borderColor: 'red',
        padding: 1,
        margin: 1
    }));
}

function printSuccess(msg: string, detail?: string) {
    let content = chalk.green.bold(msg);
    if (detail) content += '\n\n' + chalk.white(detail);

    console.log(boxen(content, {
        borderStyle: 'round',
        borderColor: 'green',
        padding: 1,
        margin: 1
    }));
}

function getCurrentProjectName() {
    return path.basename(process.cwd());
}

async function checkDaemon() {
    try {
        await axios.get(`${API_URL}/status`, { timeout: 1000 });
        return true;
    } catch (e) {
        return false;
    }
}

// --- Git Hook Installation ---
import fs from 'fs';

async function installGitHook() {
    const projectPath = process.cwd();
    const gitDir = path.join(projectPath, '.git');
    const hooksDir = path.join(gitDir, 'hooks');

    if (!fs.existsSync(gitDir)) {
        printError('No .git directory found. Is this a git repository?');
        return;
    }

    if (!fs.existsSync(hooksDir)) {
        fs.mkdirSync(hooksDir, { recursive: true });
    }

    const hookPath = path.join(hooksDir, 'post-commit');

    // We use a background curl request to avoid blocking the git commit
    // Using simple "pwd" assuming standard git bash environment available on Windows Git
    // For extreme Windows robustness, we might need a node script runner, but sh is standard for hooks.

    // JSON escaping for path is tricky in shell script. 
    // We'll pass the path dynamically.
    const hookScript = `#!/bin/sh
# Memory Hub Git Hook
# Triggers daemon sync immediately after commit

# 1. Get current path (works in git bash/linux)
PROJECT_PATH=$(pwd)

# 2. Send webhook to daemon (backgrounded)
# We silent output and errors to not disrupt git flow
curl -s -X POST ${API_URL}/git/hook \\
  -H "Content-Type: application/json" \\
  -d "{\\"path\\": \\"$PROJECT_PATH\\"}" > /dev/null 2>&1 &
`;

    try {
        fs.writeFileSync(hookPath, hookScript, { mode: 0o755 }); // Executable
        printSuccess('Git Hook Installed!', `Location: ${hookPath}`);
    } catch (e: any) {
        printError(`Failed to write hook: ${e.message}`);
    }
}

// --- Commands ---

// --- Commands ---

program
    .name('mem')
    .description('CLI for Memory Hub')
    .version('1.1.0');

// 1. Core Commands (Init, Add, List)

program
    .command('init')
    .description('Register current directory as a project in Memory Hub')
    .action(async () => {
        printBanner();
        if (!await checkDaemon()) {
            printError('Memory Hub Daemon is offline.\nPlease run "npm run dev:daemon" in another termina.');
            return;
        }

        const projectPath = process.cwd();
        const projectName = getCurrentProjectName();

        try {
            await axios.post(`${API_URL}/projects`, {
                path: projectPath,
                name: projectName
            });
            printSuccess(`Project "${projectName}" registered!`, `Path: ${projectPath}`);
        } catch (error: any) {
            if (error.response?.data?.error) {
                printError(error.response.data.error);
            } else {
                printError('Failed to register project.');
            }
        }
    });

async function performAdd(text: string | undefined, type: string, options: any) {
    if (!await checkDaemon()) {
        printError('Memory Hub Daemon is offline.');
        return;
    }

    let eventText = text;
    let eventType = type;
    const projectName = options.project || getCurrentProjectName();

    if (!eventText) {
        // Only show banner/interactive prompt if "text" wasn't provided directly
        if (!text) printBanner();

        // If type wasn't forced (e.g. by shortcut), ask for it
        if (!eventType) {
            const answers = await inquirer.prompt([
                {
                    type: 'list',
                    name: 'type',
                    message: chalk.cyan('? What kind of memory is this?'),
                    choices: [
                        { name: '📝 Note', value: 'note' },
                        { name: '💡 Idea', value: 'idea' },
                        { name: '🔄 Task Update', value: 'task_update' },
                        { name: '🚀 New Feature', value: 'new_feat' },
                        { name: '🐛 New Bug', value: 'new_bug' },
                        { name: '🧪 Spike Progress', value: 'spike_progress' }
                    ],
                    default: 'note'
                }
            ]);
            eventType = answers.type;
        }

        const answersContext = await inquirer.prompt([
            {
                type: 'input',
                name: 'text',
                message: chalk.cyan('? Content:'),
                validate: (input) => input.trim() !== '' ? true : 'Content cannot be empty'
            }
        ]);
        eventText = answersContext.text;
    }

    try {
        await axios.post(`${API_URL}/events`, {
            text: eventText,
            type: eventType || 'note',
            project: projectName,
            source: options.source || 'cli'
        });

        if (!text) { // Detailed feedback for interactive
            printSuccess('Memory stored successfully!', `[${eventType}] ${eventText}`);
        } else { // Minimal feedback for quick commands
            let icon = '📝';
            switch (eventType) {
                case 'new_bug': icon = '🐛'; break;
                case 'new_feat': icon = '🚀'; break;
                case 'idea': icon = '💡'; break;
                case 'task_update': icon = '✅'; break;
            }
            console.log(chalk.green(`✔ ${icon} Memory added`));
        }

    } catch (error: any) {
        if (error.response?.status === 404) {
            printError(`Project "${projectName}" not found.\nRun "mem init" to register this directory.`);
        } else {
            printError(`Error adding memory: ${error.message}`);
        }
    }
}

program
    .command('add [text]')
    .description('Add a new memory event')
    .option('-t, --type <type>', 'Type of event')
    .option('-p, --project <project>', 'Project name')
    .option('-s, --source <source>', 'Source of event', 'cli')
    .action((text, options) => performAdd(text, options.type, options));

// Quick Add Shortcuts
program.command('bug <text>').description('Log a bug').action((text) => performAdd(text, 'new_bug', {}));
program.command('feat <text>').description('Log a feature').action((text) => performAdd(text, 'new_feat', {}));
program.command('idea <text>').description('Log an idea').action((text) => performAdd(text, 'idea', {}));
program.command('done <text>').description('Log a completed task').action((text) => performAdd(text, 'task_update', {}));
program.command('note <text>').description('Log a note').action((text) => performAdd(text, 'note', {}));


program
    .command('list')
    .description('List recent memories')
    .option('-n, --number <number>', 'Number of events', '10')
    .option('-p, --project <project>', 'Project name')
    .option('-a, --all', 'Show events from all projects')
    .action(async (options) => {
        await listEvents(options);
    });

async function listEvents(options: any, dateFilter?: { start: string, end: string }) {
    if (!await checkDaemon()) {
        console.log(chalk.red('Daemon offline.'));
        return;
    }

    const limit = options.number ? parseInt(options.number) : 20;
    const projectName = options.all ? undefined : (options.project || getCurrentProjectName());

    try {
        const params: any = { limit };
        if (projectName) params.project = projectName;
        if (dateFilter) {
            params.startDate = dateFilter.start;
            params.endDate = dateFilter.end;
        }

        const res = await axios.get(`${API_URL}/events`, { params });
        const events = res.data;

        if (events.length === 0) {
            console.log(boxen(chalk.yellow(`No events found.`), { padding: 1, borderStyle: 'round', borderColor: 'yellow' }));
            return;
        }

        printBanner();
        const period = dateFilter ? ' (FILTERED)' : '';
        const title = projectName ? `  ACTIVITY LOG: ${projectName}${period}  ` : `  ALL ACTIVITY${period}  `;

        console.log(chalk.bgBlue.black.bold(title));
        console.log('');

        events.forEach((e: any) => {
            const date = new Date(e.timestamp);
            const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            const dateStr = date.toLocaleDateString();

            let icon = '•';
            // let color = chalk.white; // Unused variable
            let colorFunc = chalk.white;

            switch (e.type) {
                case 'idea': icon = '💡'; colorFunc = chalk.yellow; break;
                case 'task_update': icon = '✅'; colorFunc = chalk.cyan; break;
                case 'new_feat': icon = '🚀'; colorFunc = chalk.green; break;
                case 'new_bug': icon = '🐛'; colorFunc = chalk.red; break;
                case 'system': icon = '⚙️'; colorFunc = chalk.gray; break;
                case 'summary': icon = '⭐'; colorFunc = chalk.magenta; break;
                case 'git_commit': icon = '🌿'; colorFunc = chalk.magenta; break;
            }

            const sourceTag = e.source && e.source !== 'user' && e.source !== 'cli' ? chalk.gray(` [${e.source.toUpperCase()}]`) : '';
            console.log(chalk.gray(` ${dateStr} ${timeStr}`) + '  ' + icon + sourceTag + '  ' + colorFunc(e.text));
            if (!projectName) console.log(chalk.gray(`             └─ ${e.project}`));
        });
        console.log('');

    } catch (error: any) {
        printError(error.message);
    }
}

// 2. Productivity & Status

program
    .command('status')
    .description('Show project status and stats')
    .action(async () => {
        if (!await checkDaemon()) return printError('Daemon offline');

        const project = getCurrentProjectName();
        const now = new Date();
        const startOfDay = new Date(now.setHours(0, 0, 0, 0)).toISOString();
        const startOfWeek = new Date(now.setDate(now.getDate() - now.getDay())).toISOString();

        try {
            // Parallel fetches
            const [todayRes, weekRes] = await Promise.all([
                axios.get(`${API_URL}/events`, { params: { project, startDate: startOfDay, limit: 100 } }),
                axios.get(`${API_URL}/events`, { params: { project, startDate: startOfWeek, limit: 500 } })
            ]);

            const todayCount = todayRes.data.length;
            const weekCount = weekRes.data.length;

            // Simple Streak Calc (mockish implementation based on week data)
            // Real impl would need day-by-day buckets from DB
            const streak = "Calculate via DB";

            printBanner();
            console.log(boxen(
                chalk.bold(`📊 PROJECT: ${project.toUpperCase()}\n\n`) +
                `📅 Today:    ${chalk.green(todayCount + ' events')}\n` +
                `📈 This Week: ${chalk.cyan(weekCount + ' events')}\n` +
                `🔥 Streak:    ${chalk.yellow('Active')}`, // Placeholder
                { padding: 1, borderStyle: 'round', borderColor: 'blue' }
            ));

            console.log(chalk.gray('\nRecent activity:'));
            await listEvents({ project, number: 5 });

        } catch (e: any) {
            printError(e.message);
        }
    });

program
    .command('today')
    .description('Show activities from today')
    .action(() => {
        const start = new Date(); start.setHours(0, 0, 0, 0);
        const end = new Date(); end.setHours(23, 59, 59, 999);
        listEvents({}, { start: start.toISOString(), end: end.toISOString() });
    });

program
    .command('week')
    .description('Show activities from this week')
    .action(() => {
        const d = new Date();
        const day = d.getDay();
        const diff = d.getDate() - day + (day == 0 ? -6 : 1); // adjust when day is sunday
        const start = new Date(d.setDate(diff)); start.setHours(0, 0, 0, 0);
        const end = new Date(); end.setHours(23, 59, 59, 999);
        listEvents({}, { start: start.toISOString(), end: end.toISOString() });
    });


// 3. Search & AI

program
    .command('search <query>')
    .description('Semantic search in your memories')
    .option('-p, --project <project>', 'Project scope')
    .action(async (query, options) => {
        if (!await checkDaemon()) return printError('Daemon offline');
        const project = options.project || getCurrentProjectName();

        console.log(chalk.gray(`🔍 Searching brain for: "${query}"...`));

        try {
            // Use RAG endpoint
            const res = await axios.post(`${API_URL}/ai/chat`, {
                query,
                project
            });

            const { success, answer } = res.data;

            if (success && answer) {
                console.log(boxen(
                    chalk.bold('🤖 AI RESPONSE') + '\n\n' +
                    chalk.white(answer.user_response),
                    { padding: 1, borderStyle: 'round', borderColor: 'green', margin: 1 }
                ));

                if (answer.related_memories?.length > 0) {
                    console.log(chalk.gray('📚 Related Memories:'));
                    answer.related_memories.forEach((m: any) => {
                        console.log(chalk.gray(`- [${new Date(m.date).toLocaleDateString()}] ${m.excerpt}`));
                    });
                }
            } else {
                printError('No results found.');
            }

        } catch (e: any) {
            printError('Search failed: ' + e.message);
        }
    });

program
    .command('standup')
    .description('Generate daily standup report')
    .option('--copy', 'Copy to clipboard (requires system support)')
    .action(async (options) => {
        if (!await checkDaemon()) return printError('Daemon offline');

        console.log(chalk.yellow('⏳ Generating standup report...'));

        try {
            // Assuming we have a template named "Daily Standup" or we fetch templates first
            const tplRes = await axios.get(`${API_URL}/templates`);
            const standupTpl = tplRes.data.find((t: any) => t.name.includes('Standup'));

            if (!standupTpl) return printError('Standup template not found.');

            const res = await axios.post(`${API_URL}/reports/generate`, {
                templateId: standupTpl.id,
                project: getCurrentProjectName(),
                options: { includeCommits: true }
            });

            if (res.data.success) {
                const report = res.data.data.report;
                console.log(boxen(report, { padding: 1, borderStyle: 'single' }));

                if (options.copy) {
                    // Need a clipboard lib for node, usually not standard.
                    // For now just say we printed it.
                    console.log(chalk.green('Report generated!'));
                }
            }
        } catch (e: any) {
            printError('Failed to generate standup: ' + e.message);
        }
    });

// Git Integration
program
    .command('git:install')
    .description('Install git post-commit hooks for instant sync')
    .action(async () => {
        if (!await checkDaemon()) return printError('Daemon offline');
        await installGitHook();
    });

program.parse(process.argv);

if (!process.argv.slice(2).length) {
    printBanner();
    program.outputHelp();
    process.exit(0);
}
