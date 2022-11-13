const express = require('express');
const app = express();
app.set('view engine', 'ejs');
var logline = '';

/**
 * @param {boolean} [debugMode]
 */
function createServer(debugMode) {

    const port = debugMode ? 8080 : parseInt(process.env.PORT, 10);

    app.get('/', (req, res) => {
        res.render('index', {logline: logline});
    });
    
    app.listen(port);

}
module.exports.createServer = createServer;

/**
 * @param {*} str
 */
function log(str) {
    if (typeof str !== 'string') str = JSON.stringify(str);
    logline = logline ? logline + '\n' + str : str;
    app.get('/', (req, res) => {
        res.update('index', {logline: logline});
    });
    console.log(str);
}
module.exports.log = log;