const lib = require('./lib');
const {createLandingPage} = require('./server');
const {markup} = require('./markup');
const {updateRFB} = require('./updateRFB');

(async () => {

    // Create server
    createLandingPage();
    console.log('The bot started running.');

    // Login
    const token = await lib.getToken();
    if (!token) return;

    // Pages to maintain
    const ANI = 'Wikipedia:管理者伝言板/投稿ブロック',
          ANS = 'Wikipedia:管理者伝言板/投稿ブロック/ソックパペット',
          AN3RR = 'Wikipedia:管理者伝言板/3RR',
          Iccic = ANS + '/Iccic',
          ISECHIKA = ANS + '/いせちか',
          KAGE = ANS + '/影武者',
          KIYOSHIMA = ANS + '/清島達郎',
          SHINJU = ANS + '/真珠王子';
    const pages = [ANI, ANS, AN3RR, Iccic, ISECHIKA, KAGE, KIYOSHIMA, SHINJU];

    // The procedure to loop
    var runCnt = 0;
    var lastRunTs, edittedTs, checkBlocks, checkGlobal, checkRFB;
    const bot = async () => {

        console.log('Current time: ' + new Date().toJSON().replace(/\.\d{3}Z$/, 'Z'));
        checkBlocks = true;
        checkGlobal = false;
        checkRFB = monthTransitioning();
        runCnt++;

        if (runCnt % 6 === 0) {
            checkGlobal = true; // Check global block/lock status every 6 runs (1 hour)
        }

        if (lastRunTs && checkGlobal !== true) { // checkBlocks should be always true if it's the first run and if checkGlobal === true
            checkBlocks = await checkNewBlocks(lastRunTs); // Check if anyone has been manually blocked since the last run, and if not, checkBlocks = false
        }

        lastRunTs = new Date().toJSON().replace(/\.\d{3}Z$/, 'Z');

        var result;
        if (checkBlocks) {
            for (let i = 0; i < pages.length; i++) {
                console.log('Checking ' + pages[i] + '...');
                result = await markup(pages[i], token, checkGlobal, edittedTs);
                edittedTs = result ? result : edittedTs;
            }
        } else {
            console.log('Markup cancelled: No new blocks found.');
        }

        if (checkRFB) {
            result = await updateRFB(token, edittedTs);
            edittedTs = result ? result : edittedTs;
        }

    };

    bot();
    setInterval(bot, 10*60*1000);

})();

/**
* Function to check if anyone has been manually blocked since the last run
* @param {string} ts 
* @returns {Promise<boolean>}
*/
function checkNewBlocks(ts) {
    return new Promise(resolve => {
        lib.api.request({
            'action': 'query',
            'list': 'blocks',
            'bklimit': 50,
            'bkprop': 'timestamp|reason',
            'formatversion': 2
        }).then(res => {
            var resBlck;
            if (!res || !res.query) return resolve();
            if ((resBlck = res.query.blocks).length === 0) return resolve();
            if (resBlck.some(obj => obj.reason.indexOf('最近使用したため、自動ブロック') === -1 && lib.compareTimestamps(ts, obj.timestamp) >= 0)) {
                resolve(true); // Returns true if someone has been manually blocked since the last run
            } else {
                resolve(false);
            }
        }).catch(err => resolve(console.log(err)));
    });
}

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
          anchorTs40 = `${year}-${(month.toString().length === 1 ? '0' : '') + month}-${lastDay}T23:40:00Z`,
          anchorTs30 = anchorTs40.replace(/40:00Z$/, '30:00Z');
    return new Date(anchorTs40) >= d && d > new Date(anchorTs30);
}