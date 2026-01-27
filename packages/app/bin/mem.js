#!/usr/bin/env node

/**
 * Wrapper for the Memory Hub CLI.
 * This simply re-exports the CLI from the bundled cli package.
 */

import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Find CLI path
const bundledPath = path.join(__dirname, '..', 'cli', 'index.js');
const devPath = path.join(__dirname, '..', '..', 'cli', 'dist', 'index.js');

let cliPath;
if (fs.existsSync(bundledPath)) {
    cliPath = bundledPath;
} else if (fs.existsSync(devPath)) {
    cliPath = devPath;
} else {
    console.error('CLI not found. Please run build first.');
    process.exit(1);
}

// Execute CLI using dynamic import
await import(cliPath);
