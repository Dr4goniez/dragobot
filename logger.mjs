/**
 * @module logger
 *
 * Executes a specified `.js` or `.ts` script and logs its stdout and stderr output
 * to a timestamped file in the `logs/` directory.
 *
 * The script is run using `node` for JavaScript files or `ts-node` for TypeScript files,
 * depending on the file extension. After execution, a symbolic link named `latest.txt` is
 * created or updated to point to the most recent log file, allowing for convenient access.
 *
 * Example usage (in package.json scripts):
 * - "start": "node logger.mjs dist/entry.js"
 * - "test-log": "node logger.mjs src/test.ts _test"
 *
 * Usage:
 * - node logger.mjs <scriptPath> [logSuffix]
 *
 * Parameters:
 * - scriptPath  - Path to the script to execute (.ts or .js)
 * - logSuffix   - Optional suffix to append to the log filename (e.g., '_test')
 *
 * Output:
 * - A file will be created in ./logs/, e.g., logs/2025-05-01T16_30_45_000Z_test.txt
 * - A symlink logs/latest.txt will point to the latest log file
 *
 * Requirements:
 * - `ts-node` must be available if running a TypeScript script.
 * - This script must be executed in a Node.js environment that supports ES Modules (ESM).
 *
 * Notes:
 * - The `logs/` directory will be created automatically if it does not exist.
 * - Any errors thrown by the executed script are captured in the log file.
 * - The symlink makes it easy to inspect the most recent output via commands like `more logs/latest.txt`.
 */

import { execSync } from 'node:child_process';
import { mkdirSync, existsSync, symlinkSync, unlinkSync } from 'node:fs';
import { resolve, dirname, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// Get __dirname in an ES Module context
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Parse command-line arguments
const [,, scriptPath, logSuffix = ''] = process.argv;

if (!scriptPath) {
	console.error('Usage: node logger.mjs <scriptPath> [logSuffix]');
	process.exit(1);
}

const logDir = resolve(__dirname, './logs');
if (!existsSync(logDir)) mkdirSync(logDir);

// Generate timestamped filename and determine script runner
const timestamp = new Date().toISOString().replace(/[:.]/g, '_');
const logFile = join(logDir, `${timestamp}${logSuffix}.txt`);
const ext = extname(scriptPath);
const runner = ext === '.ts' ? 'ts-node' : 'node';
const command = `${runner} ${scriptPath} > "${logFile}" 2>&1`;

// Execute the script and log its output
execSync(command, { stdio: 'inherit' });

// Create or update a symbolic link pointing to the latest log file
const latestLink = join(logDir, 'latest.txt');

try {
	unlinkSync(latestLink); // Remove existing symlink if present
} catch (err) {
	if (err.code !== 'ENOENT') throw err; // Rethrow unexpected errors
}

try {
	symlinkSync(logFile, latestLink);
	console.log(`Created symlink: ${latestLink} -> ${logFile}`);
} catch (err) {
	console.error(`Symlink creation failed (${latestLink} -> ${logFile}):`, err.message);
}