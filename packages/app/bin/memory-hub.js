#!/usr/bin/env node

import { Command } from 'commander';
import path from 'path';
import fs from 'fs';
import spawn from 'cross-spawn';
import chalk from 'chalk';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const program = new Command();

// Paths
const HOME = process.env.HOME || process.env.USERPROFILE;
const DATA_DIR = path.join(HOME, '.memory-hub');
const PID_FILE = path.join(DATA_DIR, 'daemon.pid');
const LOG_FILE = path.join(DATA_DIR, 'daemon.log');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

function getDaemonPath() {
    // In development, daemon is in sibling package
    // In production (npm installed), it's bundled
    const bundledPath = path.join(__dirname, '..', 'daemon', 'index.js');
    const devPath = path.join(__dirname, '..', '..', 'daemon', 'dist', 'index.js');

    if (fs.existsSync(bundledPath)) return bundledPath;
    if (fs.existsSync(devPath)) return devPath;

    return null;
}

function isRunning() {
    if (!fs.existsSync(PID_FILE)) return false;

    try {
        const pid = parseInt(fs.readFileSync(PID_FILE, 'utf-8').trim());
        process.kill(pid, 0); // Check if process exists
        return pid;
    } catch (e) {
        // Process doesn't exist, clean up stale PID file
        try { fs.unlinkSync(PID_FILE); } catch { }
        return false;
    }
}

function startDaemon() {
    const daemonPath = getDaemonPath();

    if (!daemonPath) {
        console.log(chalk.red('✖ Daemon not found. Please run build first.'));
        process.exit(1);
    }

    const runningPid = isRunning();
    if (runningPid) {
        console.log(chalk.yellow(`⚠ Daemon already running (PID: ${runningPid})`));
        console.log(chalk.gray(`  Frontend: http://localhost:3000`));
        return;
    }

    console.log(chalk.cyan('Starting Memory Hub daemon...'));

    // Open log file for writing
    const logStream = fs.openSync(LOG_FILE, 'a');

    // Spawn daemon as detached process
    const child = spawn('node', [daemonPath], {
        detached: true,
        stdio: ['ignore', logStream, logStream],
        env: {
            ...process.env,
            WEB_DIST_PATH: path.join(__dirname, '..', 'web'),
            MEMORY_HUB_DATA_DIR: DATA_DIR
        }
    });

    // Save PID
    fs.writeFileSync(PID_FILE, child.pid.toString());

    // Detach child process
    child.unref();

    console.log(chalk.green(`✔ Daemon started (PID: ${child.pid})`));
    console.log(chalk.gray(`  Frontend: http://localhost:3000`));
    console.log(chalk.gray(`  Logs: ${LOG_FILE}`));
}

function stopDaemon() {
    const pid = isRunning();

    if (!pid) {
        console.log(chalk.yellow('⚠ Daemon is not running'));
        return;
    }

    try {
        process.kill(pid, 'SIGTERM');
        try { fs.unlinkSync(PID_FILE); } catch { }
        console.log(chalk.green(`✔ Daemon stopped (PID: ${pid})`));
    } catch (e) {
        console.log(chalk.red(`✖ Failed to stop daemon: ${e.message}`));
    }
}

function showStatus() {
    const pid = isRunning();

    if (pid) {
        console.log(chalk.green(`✔ Daemon is running (PID: ${pid})`));
        console.log(chalk.gray(`  Frontend: http://localhost:3000`));
        console.log(chalk.gray(`  Data: ${DATA_DIR}`));
    } else {
        console.log(chalk.yellow('○ Daemon is not running'));
        console.log(chalk.gray(`  Run "memory-hub start" to start`));
    }
}

function showLogs(lines = 50) {
    if (!fs.existsSync(LOG_FILE)) {
        console.log(chalk.yellow('No logs available'));
        return;
    }

    const content = fs.readFileSync(LOG_FILE, 'utf-8');
    const logLines = content.split('\n').slice(-lines);
    console.log(logLines.join('\n'));
}

// CLI Commands
program
    .name('memory-hub')
    .description('Memory Hub - Your External Brain')
    .version('1.0.0');

program
    .command('start')
    .description('Start the Memory Hub daemon')
    .action(startDaemon);

program
    .command('stop')
    .description('Stop the Memory Hub daemon')
    .action(stopDaemon);

program
    .command('restart')
    .description('Restart the Memory Hub daemon')
    .action(() => {
        stopDaemon();
        setTimeout(startDaemon, 500);
    });

program
    .command('status')
    .description('Show daemon status')
    .action(showStatus);

program
    .command('logs')
    .description('Show daemon logs')
    .option('-n, --lines <number>', 'Number of lines to show', '50')
    .action((options) => showLogs(parseInt(options.lines)));

program
    .command('open')
    .description('Open Memory Hub in browser')
    .action(() => {
        const url = 'http://localhost:3000';
        const start = process.platform === 'win32' ? 'start' :
            process.platform === 'darwin' ? 'open' : 'xdg-open';
        spawn(start, [url], { shell: true });
        console.log(chalk.cyan(`Opening ${url} in browser...`));
    });

program.parse(process.argv);

if (!process.argv.slice(2).length) {
    program.outputHelp();
}
