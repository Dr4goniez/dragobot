import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';

try {
	console.log('Installing dependencies...');
	execSync('npm ci', {stdio: 'inherit'});

	console.log('Building...');
	execSync('npm run build', {stdio: 'inherit'});

	console.log('Starting app...');
	if (!existsSync('dist/entry.js')) {
		throw new Error('dist/entry.js not found. Build may have failed.');
	}
	execSync('node logger.mjs src/entry.ts _node', {stdio: 'inherit'});
} catch (err) {
	console.error('Startup failed:', err);
	process.exit(1); // Exit gracefully; don't crash the pod repeatedly
}
