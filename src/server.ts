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

const app = express();

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '../public'));

const startedAt = new Date();

export function createServer() {
	app.get('/', (_, res) => {
		res.render('index', {startedAt});
	});

	// Use Toolforge's PORT or default to 8080
	const port = parseInt(process.env.PORT ?? '8080', 10);
	app.listen(port, () => {
		console.log(`The server has started on port ${port}.`);
	});
}
