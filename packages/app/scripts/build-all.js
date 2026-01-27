#!/usr/bin/env node

/**
 * Build script that compiles all packages and bundles them into the app package.
 */

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const ROOT = path.join(__dirname, '..', '..', '..');
const APP_DIR = path.join(__dirname, '..');

const packages = [
    { name: 'daemon', src: 'packages/daemon', dist: 'dist' },
    { name: 'cli', src: 'packages/cli', dist: 'dist' },
    { name: 'mcp-server', src: 'packages/mcp-server', dist: 'dist' },
    { name: 'web', src: 'packages/web', dist: 'dist' }
];

function log(msg) {
    console.log(`\x1b[36m[build]\x1b[0m ${msg}`);
}

function error(msg) {
    console.error(`\x1b[31m[error]\x1b[0m ${msg}`);
}

function copyDir(src, dest) {
    if (!fs.existsSync(src)) return;

    fs.mkdirSync(dest, { recursive: true });

    const entries = fs.readdirSync(src, { withFileTypes: true });

    for (const entry of entries) {
        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);

        if (entry.isDirectory()) {
            copyDir(srcPath, destPath);
        } else {
            fs.copyFileSync(srcPath, destPath);
        }
    }
}

function cleanDir(dir) {
    if (fs.existsSync(dir)) {
        fs.rmSync(dir, { recursive: true, force: true });
    }
    fs.mkdirSync(dir, { recursive: true });
}

async function build() {
    log('Starting build process...');

    // Build each package
    for (const pkg of packages) {
        const pkgPath = path.join(ROOT, pkg.src);
        const pkgJson = path.join(pkgPath, 'package.json');

        if (!fs.existsSync(pkgJson)) {
            error(`Package ${pkg.name} not found at ${pkgPath}`);
            continue;
        }

        log(`Building ${pkg.name}...`);

        try {
            execSync('npm run build', {
                cwd: pkgPath,
                stdio: 'inherit'
            });
        } catch (e) {
            error(`Failed to build ${pkg.name}`);
            process.exit(1);
        }

        // Copy dist to app package
        const srcDist = path.join(pkgPath, pkg.dist);
        const destDir = path.join(APP_DIR, pkg.name);

        log(`Copying ${pkg.name} to app package...`);
        cleanDir(destDir);
        copyDir(srcDist, destDir);

        // For daemon, also copy node_modules (native deps like better-sqlite3)
        if (pkg.name === 'daemon') {
            const nodeModules = path.join(pkgPath, 'node_modules');
            if (fs.existsSync(nodeModules)) {
                log('Copying daemon node_modules (native deps)...');
                copyDir(nodeModules, path.join(destDir, 'node_modules'));
            }
        }
    }

    log('Build complete!');
    log(`Output: ${APP_DIR}`);
}

build().catch(e => {
    error(e.message);
    process.exit(1);
});
