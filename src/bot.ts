import * as lib from './lib';
import { createServer, log } from './server';
import { markupANs } from './markup';
import { updateRFB } from './updateRFB';
import { removePp } from './removePp';
import { getMw, init } from './mw';
import { ApiResponse, ApiResponseError, ApiResponseQueryListBlocks } from '.';

createServer();
init().then((mw) => {

	if (!mw) return;

	// The procedure to loop
	let runCnt = 0;
	let lastRunTs: string, checkBlocks, checkGlobal, checkRFB, checkProtectionTemplates;
	const bot = async () => {

		log('Current time: ' + lib.getCurTimestamp());
		checkBlocks = true;
		checkGlobal = false;
		checkRFB = monthTransitioning();
		checkProtectionTemplates = false;
		runCnt++;

		if (runCnt % 6 === 0) { // Check global block/lock status every 6 runs (1 hour)
			checkGlobal = true;
		}
		if (runCnt % 3 === 0) { // Check inappropriate protection templates every 3 runs (30 minutes)
			checkProtectionTemplates = true;
		}

		if (lastRunTs && checkGlobal !== true) { // checkBlocks should be always true if it's the first run and if checkGlobal === true
			checkBlocks = await checkNewBlocks(lastRunTs); // Check if anyone has been manually blocked since the last run, and if not, checkBlocks = false
		}

		lastRunTs = lib.getCurTimestamp();

		// ------------------------------ markup ------------------------------
		if (checkBlocks) {
			await markupANs(checkGlobal);
		} else {
			log('Markup cancelled: No new blocks found.');
		}

		// ------------------------------ updateRFB ------------------------------
		if (checkRFB) await updateRFB();

		// ------------------------------ removePp ------------------------------
		if (checkProtectionTemplates) await removePp(lastRunTs);

	};

	bot();
	setInterval(bot, 10*60*1000);

});

/**
 * Check whether the current month is transitioning to the next.
 * @return True if the current time is between 23:30 and 23:40 on the last day of the month (JST)
 */
function monthTransitioning(): boolean {
	const d = new Date();
	d.setHours(d.getHours() + 9); // JST
	const year = d.getFullYear(),
			month = d.getMonth() + 1,
			lastDay = lib.lastDay(year, month),
			anchorTs40 = `${year}-${month.toString().padStart(2, '0')}-${lastDay}T23:40:00Z`,
			anchorTs30 = anchorTs40.replace(/40:00Z$/, '30:00Z');
	return new Date(anchorTs40) >= d && d > new Date(anchorTs30);
}

/** Check whether anyone has been manually blocked since the last run. */
function checkNewBlocks(lastRunTs: string): Promise<boolean|undefined> {
	const mw = getMw();
	return new Promise(resolve => {
		mw.request({
			action: 'query',
			list: 'blocks',
			bklimit: '50',
			bkprop: 'timestamp|flags',
			formatversion: '2'
		}).then((res: ApiResponse) => {

			let resBlck: ApiResponseQueryListBlocks[]|undefined;
			if (!res || !res.query || !(resBlck = res.query.blocks)) return resolve(undefined);
			if (resBlck.length === 0) return resolve(undefined);

			resBlck = resBlck.filter(obj => !obj.automatic);
			if (resBlck.some(obj => lib.compareTimestamps(lastRunTs, obj.timestamp) >= 0)) {
				resolve(true); // Returns true if someone has been manually blocked since the last run
			} else {
				resolve(false);
			}

		}).catch((err: ApiResponseError) => {
			log(err);
			resolve(undefined);
		});
	});
}