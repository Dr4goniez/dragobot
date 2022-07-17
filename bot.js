const lib = require('./lib');
const {createLandingPage} = require('./server');
const {markup} = require('./markup');

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
    var runCnt = 0,
        lastRunTs,
        edittedTs,
        checkGlobal = false;
    const bot = async () => {

        console.log('Current time: ' + new Date().toJSON().replace(/\.\d{3}Z$/, 'Z'));

        runCnt++;
        if (lastRunTs && runCnt % 6 !== 0) { // Compare the timestamp of the last run and timestamps in list=blocks
            const sbIsRecentlyBlocked = await checkNewBlocks(lastRunTs);
            if (!sbIsRecentlyBlocked) {
                lastRunTs = new Date().toJSON().replace(/\.\d{3}Z$/, 'Z'); // YYYY-MM-DDT00:00:00.000Z => YYYY-MM-DDT00:00:00Z
                return console.log('Stopped execution: No new blocks found.');
            }
        }

        lastRunTs = new Date().toJSON().replace(/\.\d{3}Z$/, 'Z');

        if (runCnt % 6 === 0) {
            checkGlobal = true; // Check global block/lock status every 6 runs (1 hour)
        } else {
            checkGlobal = false;
        }

        for (let i = 0; i < pages.length; i++) {
            console.log('Checking ' + pages[i] + '...');
            const result = await markup(pages[i], token, checkGlobal, edittedTs);
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