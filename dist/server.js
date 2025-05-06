"use strict";
/**
 * @module
 *
 * Node.js tools hosted on Toolforge must serve a landing page over HTTP;
 * otherwise, the process receives a SIGTERM and is terminated.
 *
 * This module starts a server that serves `public/index.html`.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createServer = createServer;
const express_1 = __importDefault(require("express"));
const path_1 = __importDefault(require("path"));
const app = (0, express_1.default)();
app.set('view engine', 'ejs');
app.set('views', path_1.default.join(__dirname, '../public'));
const startedAt = new Date();
function createServer() {
    app.get('/', (_, res) => {
        res.render('index', { startedAt });
    });
    // Use Toolforge's PORT or default to 8080
    const port = parseInt(process.env.PORT ?? '8080', 10);
    app.listen(port, () => {
        console.log(`The server has started on port ${port}.`);
    });
}
