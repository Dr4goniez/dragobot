"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createServer = createServer;
const express_1 = __importDefault(require("express"));
const path_1 = __importDefault(require("path"));
const root = path_1.default.resolve(__dirname, '../public');
function createServer() {
    const app = (0, express_1.default)();
    // Serve static files (like index.html)
    app.use(express_1.default.static(root));
    // Fallback (in case someone accesses '/')
    app.get('/', (_, res) => {
        res.sendFile(path_1.default.join(root, 'index.html'));
    });
    // Use Toolforge's PORT or default to 8080
    const port = parseInt(process.env.PORT ?? '8080', 10);
    app.listen(port, () => {
        console.log(`The server has started on port ${port}.`);
    });
}
