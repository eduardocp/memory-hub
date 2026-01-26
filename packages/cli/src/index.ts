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

// --- Commands ---

program
    .name('mem')
    .description('CLI for Memory Hub')
    .version('1.0.0');

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

program
    .command('add [text]')
    .description('Add a new memory event')
    .option('-t, --type <type>', 'Type of event', 'note')
    .option('-p, --project <project>', 'Project name')
    .option('-s, --source <source>', 'Source of event', 'cli')
    .action(async (text, options) => {
        if (!await checkDaemon()) {
            printError('Memory Hub Daemon is offline.');
            return;
        }

        let eventText = text;
        let eventType = options.type;
        const projectName = options.project || getCurrentProjectName();

        if (!eventText) {
            printBanner(); // Show banner only in interactive mode

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
                },
                {
                    type: 'input',
                    name: 'text',
                    message: chalk.cyan('? Content:'),
                    validate: (input) => input.trim() !== '' ? true : 'Content cannot be empty'
                }
            ]);
            eventText = answers.text;
            eventType = answers.type;
        }

        try {
            await axios.post(`${API_URL}/events`, {
                text: eventText,
                type: eventType,
                project: projectName,
                source: options.source
            });

            if (!text) { // Interactive feedback
                printSuccess('Memory stored successfully!', `[${eventType}] ${eventText}`);
            } else { // Quick mode feedback
                console.log(chalk.green('✔ Memory added'));
            }

        } catch (error: any) {
            if (error.response?.status === 404) {
                printError(`Project "${projectName}" not found.\nRun "mem init" to register this directory.`);
            } else {
                printError(`Error adding memory: ${error.message}`);
            }
        }
    });

program
    .command('list')
    .description('List recent memories')
    .option('-n, --number <number>', 'Number of events', '10')
    .option('-p, --project <project>', 'Project name')
    .option('-a, --all', 'Show events from all projects')
    .action(async (options) => {
        if (!await checkDaemon()) {
            console.log(chalk.red('Daemon offline.'));
            return;
        }

        const limit = parseInt(options.number);
        const projectName = options.project || getCurrentProjectName();

        try {
            const params: any = { limit };
            if (!options.all) params.project = projectName;

            const res = await axios.get(`${API_URL}/events`, { params });
            const events = res.data;

            if (events.length === 0) {
                console.log(boxen(chalk.yellow(`No events found for project "${projectName}".`), { padding: 1, borderStyle: 'round', borderColor: 'yellow' }));
                return;
            }

            printBanner();
            const title = options.all ? '  ALL RECENT ACTIVITY  ' : `  ACTIVITY LOG: ${projectName}  `;
            console.log(chalk.bgBlue.black.bold(title));
            console.log('');

            events.forEach((e: any) => {
                const date = new Date(e.timestamp);
                const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                const dateStr = date.toLocaleDateString();

                let icon = '•';
                let color = chalk.white;

                switch (e.type) {
                    case 'idea': icon = '💡'; color = chalk.yellow; break;
                    case 'task_update': icon = '🔄'; color = chalk.cyan; break;
                    case 'new_feat': icon = '🚀'; color = chalk.green; break;
                    case 'new_bug': icon = '🐛'; color = chalk.red; break;
                    case 'system': icon = '⚙️'; color = chalk.gray; break;
                    case 'summary': icon = '⭐'; color = chalk.magenta; break;
                    case 'git_commit': icon = '🌿'; color = chalk.magenta; break;
                }

                const sourceTag = e.source && e.source !== 'user' && e.source !== 'file' ? chalk.gray(` [${e.source.toUpperCase()}]`) : '';
                console.log(chalk.gray(` ${dateStr} ${timeStr}`) + '  ' + icon + sourceTag + '  ' + color(e.text));
                if (options.all) console.log(chalk.gray(`             └─ ${e.project}`));
            });
            console.log('');

        } catch (error: any) {
            printError(error.message);
        }
    });

program.parse(process.argv);

if (!process.argv.slice(2).length) {
    printBanner();
    program.outputHelp();
    process.exit(0);
}
