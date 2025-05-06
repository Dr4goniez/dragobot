/**
 * @module
 *
 * Node.js tools hosted on Toolforge must serve a landing page over HTTP;
 * otherwise, the process receives a SIGTERM and is terminated.
 *
 * This module starts a server that serves `public/index.html`.
 */

import express from 'express';
import path from 'path';

const root = path.resolve(__dirname, '../public');

export function createServer(): void {
	const app = express();

	// Serve static files (like index.html)
	app.use(express.static(root));

	// Fallback (in case someone accesses '/')
	app.get('/', (_, res) => {
		res.sendFile(path.join(root, 'index.html'));
	});

	// Use Toolforge's PORT or default to 8080
	const port = parseInt(process.env.PORT ?? '8080', 10);
	app.listen(port, () => {
		console.log(`The server has started on port ${port}.`);
	});
}
