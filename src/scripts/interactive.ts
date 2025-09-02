import * as readline from 'node:readline';

// Create a readline interface for terminal interaction
const rl = readline.createInterface({
	input: process.stdin,
	output: process.stdout,
});

// Set raw mode to true to listen for single keypresses
if (process.stdin.isTTY) {
	process.stdin.setRawMode(true);
}

/**
 * Prompts the user for an action and returns a symbolic result.
 *
 * @param prompt The prompt message. Defaults to
 * `'Press Enter to continue, "s" to skip, "q" to quit: '`.
 */
export async function waitForUserAction(
	prompt: string = 'Press Enter to continue, "s" to skip, "q" to quit: '
): Promise<'continue' | 'skip' | 'quit'> {
	if (!process.stdin.isTTY) {
		throw new Error('TTY is required for interactive input.');
	}

	return new Promise(resolve => {
		process.stdout.write(prompt);

		const handler = async (buffer: Buffer) => {
			const key = buffer.toString();
			process.stdin.setRawMode(false);
			process.stdin.removeListener('data', handler);
			rl.close();
			process.stdout.write('\n');

			if (key === '\r') {
				resolve('continue'); // Enter
			} else if (key === 's') {
				resolve('skip');
			} else if (key === 'q') {
				resolve('quit');
			} else {
				// Invalid input → recursively call again
				const retry = await waitForUserAction(prompt);
				resolve(retry);
			}
		};

		process.stdin.on('data', handler);
	});
}
