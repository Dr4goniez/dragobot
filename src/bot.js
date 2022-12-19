import './methods';
import { lib } from './lib';
import { createServer, log } from './server';
import { markupANs } from './markup';
import { updateRFB } from './updateRFB';
import { removePp } from './removePp';
import { getMw, init } from './mw';

createServer();
init().then((mw) => {

    if (!mw) return;

    // The procedure to loop
    var runCnt = 0;
    var lastRunTs, checkBlocks, checkGlobal, checkRFB, checkProtectionTemplates;
    const bot = async () => {

        log('Current time: ' + new Date().toJSON().replace(/\.\d{3}Z$/, 'Z'));
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

        lastRunTs = new Date().toJSON().replace(/\.\d{3}Z$/, 'Z');

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
 * Check if the current month is transitioning to the next
 * @return {boolean} True if the current time is between 23:30 and 23:40 on the last day of the month (JST)
 */
function monthTransitioning() {
    const d = new Date();
    d.setHours(d.getHours() + 9); // JST
    const year = d.getFullYear(),
          month = d.getMonth() + 1,
          lastDay = lib.lastDay(year, month),
          anchorTs40 = `${year}-${month.toString().padStart(2, '0')}-${lastDay}T23:40:00Z`,
          anchorTs30 = anchorTs40.replace(/40:00Z$/, '30:00Z');
    return new Date(anchorTs40) >= d && d > new Date(anchorTs30);
}

/**
* Function to check if anyone has been manually blocked since the last run
* @param {string} ts
* @returns {Promise<boolean>}
*/
function checkNewBlocks(ts) {
    const mw = getMw();
    return new Promise(resolve => {
        mw.request({
            action: 'query',
            list: 'blocks',
            bklimit: '50',
            bkprop: 'timestamp|flags',
            formatversion: '2'
        }).then(res => {

            var resBlck;
            if (!res || !res.query || !(resBlck = res.query.blocks)) return resolve();
            if (resBlck.length === 0) return resolve();

            resBlck = resBlck.filter(obj => !obj.automatic);
            if (resBlck.some(obj => lib.compareTimestamps(ts, obj.timestamp) >= 0)) {
                resolve(true); // Returns true if someone has been manually blocked since the last run
            } else {
                resolve(false);
            }

        }).catch(err => resolve(log(err)));
    });
}