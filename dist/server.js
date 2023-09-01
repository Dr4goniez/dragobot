"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.log = exports.createServer = void 0;
const express_1 = __importDefault(require("express"));
const app = (0, express_1.default)();
app.set('view engine', 'ejs');
let logline = '';
/**
 * @param {boolean} [debugMode]
 */
const createServer = (debugMode) => {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const port = debugMode ? 8080 : parseInt(process.env.PORT, 10);
    app.get('/', (req, res) => {
        res.render('index', { logline: logline });
    });
    app.listen(port);
    log('The server has started running.');
};
exports.createServer = createServer;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function log(str) {
    console.log(str);
    if (typeof str !== 'string') {
        if (typeof str === 'object' && str !== null) {
            str = JSON.stringify(str, Object.getOwnPropertyNames(str));
        }
        else {
            str = JSON.stringify(str);
        }
    }
    logline = logline ? logline + '\n' + str : str;
    app.get('/', (req, res) => {
        res.update('index', { logline: logline });
    });
}
exports.log = log;
