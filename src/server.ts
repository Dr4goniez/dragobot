import express from 'express';
import { DynamicObject } from '.';

const app = express();
app.set('view engine', 'ejs');
let logline = '';

/**
 * @param {boolean} [debugMode]
 */
export const createServer = (debugMode?: boolean) => {

	// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
	const port = debugMode ? 8080 : parseInt(process.env.PORT!, 10);

	app.get('/', (req, res) => {
		res.render('index', {logline: logline});
	});
	
	app.listen(port);

	log('The server has started running.');

};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function log(str: any) {
	console.log(str);
	if (typeof str !== 'string') {
		if (typeof str === 'object') {
			str = JSON.stringify(str, Object.getOwnPropertyNames(str));
		} else {
			str = JSON.stringify(str);
		}
	}
	logline = logline ? logline + '\n' + str : str;
	app.get('/', (req, res: DynamicObject) => {
		res.update('index', {logline: logline});
	});
}
export { log };