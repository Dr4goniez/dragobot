/********************** DEPENDENCIES **********************/

const my = require('./my');
const MWBot = require('mwbot');
const api = new MWBot({
    apiUrl: my.apiUrl
});
const lib = require('./lib');
const net = require('net');
const isCidr = require('is-cidr');

console.log('The bot started running.');

/********************** SCRIPT BODY **********************/

(async () => { // Just a wrapper function

/********************** STARTUP FUNCTION **********************/

// Login
const token = await api.loginGetEditToken({
    username: my.username,
    password: my.password
}).then(res => {
    if (!res) return console.log('An unexpected error occurred on login attempt.');
    return res.csrftoken;
}).catch((err) => console.log(err.login.reason));

if (!token) return;

// Pages to maintain
const ANI = 'Wikipedia:管理者伝言板/投稿ブロック';
const ANS = 'Wikipedia:管理者伝言板/投稿ブロック/ソックパペット';
const AN3RR = 'Wikipedia:管理者伝言板/3RR';
const Iccic = 'Wikipedia:進行中の荒らし行為/長期/Iccic/投稿ブロック依頼';
const ISECHIKA = 'Wikipedia:管理者伝言板/投稿ブロック/いせちか';
const KAGE = 'Wikipedia:管理者伝言板/投稿ブロック/影武者';
const KIYOSHIMA = 'Wikipedia:管理者伝言板/投稿ブロック/清島達郎';
const SHINJU = 'Wikipedia:管理者伝言板/投稿ブロック/真珠王子';

// Across-the-function variables
var UserAN = [], checkGlobal = false;
const Logids = {}, Diffs = {}; // {logid: username, logid2: username2...} & {diffid: username, diffid2: username2...}

// Run the bot
(() => {

    // Function to check if the bot should run
    const checkNewBlocks = ts => new Promise(resolve => {
        api.request({
            'action': 'query',
            'list': 'blocks',
            'bklimit': 30,
            'bkprop': 'timestamp|reason',
            'formatversion': 2
        }).then(res => {
            var resBlck;
            if (!res || !res.query) return resolve();
            if ((resBlck = res.query.blocks).length === 0) return resolve();
            for (const blck of resBlck) {
                if (blck.reason.indexOf('最近使用したため、自動ブロック') === -1 && lib.compareTimestamps(ts, blck.timestamp)) {
                    return resolve(true); // Returns true if someone has been manually blocked since the last run
                }
            }
            resolve(false);
        }).catch(() => resolve());
    });

    // Function to make an intentional 5-second delay between each edit
    const delay = () => new Promise(resolve =>  setTimeout(resolve, 5000));

    // The procedure to loop
    const pages = [ANI, ANS, AN3RR, Iccic, ISECHIKA, KAGE, KIYOSHIMA, SHINJU];
    var runCnt = 0, lastRunTs;
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

        if (runCnt % 6 === 0) {
            checkGlobal = true; // Check global block/lock status every 6 runs (1 hour)
        } else {
            checkGlobal = false;
        }

        for (let i = 0; i < pages.length; i++) {
            if (i !== 0) await delay(); // Intentional 5-sec delay in accordance with the local bot policy
            console.log('Checking ' + pages[i] + '...');
            UserAN = []; // Reset
            await checkBlockStatus(pages[i]);
        }

        lastRunTs = new Date().toJSON().replace(/\.\d{3}Z$/, 'Z');

    };

    // Run the bot
    bot();
    setInterval(bot, 10*60*1000); // Run every 10 minutes

})();

//********************** MAIN FUNCTIONS OF THE BOT **********************/

async function checkBlockStatus(pagename) {

    // Get page content
    const parsed = await lib.getLatestRevision(pagename);
    if (!parsed) return console.log('Failed to parse the page.');
    const wikitext = parsed.content;
    const templates = lib.findTemplates(wikitext, 'UserAN'); // Extract all UserAN occurrences from the page content

    // RegExps to evaluate the templates' parameters
    const paramsRegExp = {
        'useran': new RegExp('[Uu]serAN'), // Template name: The 1st letter is case-insensitive
        'user': new RegExp('^\\s*(?:1|[Uu]ser)\\s*='), // Template param: 1=, user=, or User=
        'type': new RegExp('^\\s*(?:t|[Tt]ype)\\s*='), // Template param: t=, type=, or Type=
        'status': new RegExp('^\\s*(?:状態|[Ss]tatus)\\s*='), // Template param: 状態=, status=, or Status=. ⇓ Closed verson
        'statusFilled': new RegExp('^\\s*(?:状態|[Ss]tatus)\\s*=\\s*(?:(?:not )?done|済(?:み)?|却下|非対処|取り下げ)\\s*$'),
        'status2': new RegExp('^\\s*2\\s*='), // Template param: 2=
        'status2Filled': new RegExp('^\\s*2\\s*=(?=.+)'), // 2=USERNAME (closed)
        'bot': new RegExp('^\\s*bot\\s*='), // bot=
        'botOptedOut': new RegExp('\\s*bot\\s*=\\s*no\\s*'), // bot=no
        'section': new RegExp('={2,5}[^\\S\\r\\n]*.+[^\\S\\r\\n]*={2,5}', 'g') // == sectiontitle == (2-5 levels)
    };
    const ignoreThese = [ // Commented out UserANs in the instruction on WP:AN/I
        '{{UserAN|type=IPuser2|111.222.333.444}}',
        '{{UserAN|type=IP2|111.222.333.444}}',
        '{{UserAN|利用者名}}',
        '{{UserAN|type=none|アカウント作成日時 (UTC)}}'
    ];

    // Create an array of objects out of the templates
    for (const tl of templates) {
        UserAN.push({
            'old': tl,
            'new': '',
            'closed': true,
            'ignore': false, // If true, ignore the relevant report as though it's not there
            'markup': true, // If false (bot=no), don't mark up the report
            'timestamp': '',
            'section': '',
            'user': '',
            'type': '',
            'logid': '',
            'diff': '',
            'none': '',
            // The following gets a value if the user reported by the UserAN has been blocked
            'domain': '', // Like partial block, global block, and global lock
            'duration': '',
            'date': '',
        });
    }

    // Find UserANs with open reports by evaluating their parameters
    UserAN.forEach(obj => {

        // Get the names of the sections that the UserAN belongs to
        const mtch = splitInto2(wikitext, obj.old)[0].match(paramsRegExp.section); // Split the srctxt at tpl and get the last section title in arr[0]
        if (mtch) obj.section = mtch[mtch.length - 1].replace(/^={2,5}[^\S\r\n]*/, '').replace(/[^\S\r\n]*={2,5}$/, ''); // .replace removes '='s

        // Ignore UserANs that are ungrammatical or for instructions
        if (obj.old.indexOf('|') === -1 || ignoreThese.includes(obj.old)) {
            obj.ignore = true;
            return;
        }

        // Don't mark up UserAN with a bot=no parameter
        if (obj.old.match(paramsRegExp.botOptedOut)) obj.markup = false;

        // Get an array of parameters
        var params = obj.old.replace(/^\{{2}/, '').replace(/\|*\}{2}$/, ''); // Remove the first '{{' and the last '}}' (or '|}}')
        params = params.split('|');
        params = params.filter(item => !item.match(paramsRegExp.bot)); // Remove bot= parameter if there's any
        if (!params.every(item => !item.match(/\{{2}.+\}{2}/))) { // Don't look at UserANs that nest some other templates
            obj.ignore = true;
            return;
        }

        /**********************************************************************************************************\
            A full list of parameter combinations
                params.length === 2
                - {{UserAN|username}} (open)
                params.length === 3
                - {{UserAN|t=TYPE|username}} (open)
                - {{UserAN|username|状態=}} (open)
                - {{UserAN|username|状態=X}} (closed) => UserANs with a 状態=X paremeter are always closed
                - {{UserAN|username|無期限}} (closed)
                params.length === 4
                - {{UserAN|t=TYPE|username|状態=}} (open)
                - {{UserAN|t=TYPE|username|状態=X}} (closed) => UserANs with a 状態=X paremeter are always closed
                - {{UserAN|t=TYPE|username|無期限}} (closed)
                - {{UserAN|username|状態=|無期限}} (closed)
                params.length === 5
                - {{UserAN|t=TYPE|username|状態=|無期限}} (closed)
            Only UserANs with params in one of the four patterns need to be configured with obj.closed = false
        \***********************************************************************************************************/

        if (params.filter(item => item.match(paramsRegExp.statusFilled)).length > 0) return; // 状態=X param is present: Always closed
        switch(params.length) {
            case 2: // {{UserAN|username}} (open)
                obj.closed = false;
                return;
            case 3: // {{UserAN|t=TYPE|(1=)username}} (open), {{UserAN|(1=)username|状態=}} (open), {{UserAN|(1=)username|(2=)無期限}} (closed) 
                if (params.filter(item => item.match(paramsRegExp.type)).length > 0 || // The template has a type param, or
                    params.filter(item => item.match(paramsRegExp.status)).length > 0) { // the template has a 状態= param: The request is open
                    obj.closed = false;
                }
                return;
            case 4: // {{UserAN|t=TYPE|username|状態=}} (open), {{UserAN|t=TYPE|username|無期限}} (closed), {{UserAN|username|状態=|無期限}} (closed)
                if (params.filter(item => item.match(paramsRegExp.type) && item.match(paramsRegExp.status)).length > 0) obj.closed = false;
        }

    }); // At this point each object in the array UserAN has either obj.closed = false or obj.closed = true

    // Set the 'type', 'user', and 'timestamp' properties of the object
    UserAN.filter(obj => !obj.closed).forEach(obj => { // Only look at open ones (or the code would be unnecessarily complex)

        var params = obj.old.replace(/^\{{2}/, '').replace(/\|*\}{2}$/, '').split('|');
        params = params.filter(item => !item.match(paramsRegExp.useran) && !item.match(paramsRegExp.status)); // Remove the UserAN and 状態= params

        /**********************************************************************************************************\
            A full list of parameter combinations at this point
                {{UserAN|usename}} => {{username}}
                {{UserAN|username|状態=}} => {{username}}
                {{UserAN|t=TYPE|username}} => {{t=TYPE|username}}
                {{UserAN|t=TYPE|username|状態=}} => {{t=TYPE|username}}
            Now we can differentiate these four in whether they have a t= param
        \***********************************************************************************************************/

        if (params.filter(item => item.match(paramsRegExp.type)).length === 0) { // If the template doesn't have a t= param
            obj.type = 'user2';
            obj.user = params[0].replace(/\u200e/g, '').trim();
        } else { // If the template has a t= param
            obj.type = params.filter(item => item.match(paramsRegExp.type))[0].replace(paramsRegExp.type, '').toLowerCase();
            const userParam = params.filter(item => !item.match(paramsRegExp.type))[0].replace(/\u200e/g, '').trim();
            switch(obj.type) {
                case 'user2':
                case 'unl':
                case 'usernolink':
                case 'ip2':
                case 'ipuser2':
                    obj.user = userParam;
                    break;
                case 'log':
                case 'logid':
                    if (userParam.match(/^\d+$/)) obj.logid = userParam; // Make sure that the user param is only of numerals
                    break;
                case 'dif':
                case 'diff':
                    if (userParam.match(/^\d+$/)) obj.diff = userParam;
                    break;
                case 'none': // UserANs with this type param have a random string in the username param (the block status can't be checked)
                    obj.none = userParam;
                    break;
                default: // Invalid type
            }
        }

        // Get a timestamp for obj
        const wtSplit = splitInto2(wikitext, obj.old); // Split the source text at the template and find the first signature following it
        var ts = wtSplit[1].match(/(\d{4})年(\d{1,2})月(\d{1,2})日 \((?:日|月|火|水|木|金|土)\) (\d{2}:\d{2}) \(UTC\)/); // YYYY年MM月DD日 (日) hh:mm (UTC)
        if (!ts) return;
        for (let i = 2; i <= 3; i++) {
            ts[i] = ts[i].length === 1 ? '0' + ts[i] : ts[i]; // MM and DD may be of one digit but they need to be of two digits
        }
        ts = `${ts[1]}-${ts[2]}-${ts[3]}T${ts[4]}:00Z`; // YYYY-MM-DDThh:mm:00Z (hh:mm is one capturing group)
        obj.timestamp = ts;

    });

    // Get an array of logids and diff numbers (these need to be converted to usernames through API requests before block check)
    const needBlockCheck = obj => !obj.closed && !obj.ignore && obj.markup;
    const logids = UserAN.filter(obj => needBlockCheck(obj) && obj.logid && !obj.user && !Logids[obj.logid]).map(obj => obj.logid);
    const diffs = UserAN.filter(obj => needBlockCheck(obj) && obj.diff && !obj.user && !Diffs[obj.diff]).map(obj => obj.diff);

    // Convert logids and diffids to usernames through API queries (for logids, only search for the latest 5000 logevents)
    var queries = [];
    queries.push(convertLogidsToUsernames(logids), convertDiffidsToUsernames(diffs)); // These functions save the response into Logids and Diffs
    await Promise.all(queries);
    UserAN.forEach(obj => { // Set the 'user' property of UserAN if possible
        if (obj.logid && !obj.user && Logids[obj.logid]) obj.user = Logids[obj.logid];
        if (obj.diff && !obj.user && Diffs[obj.diff]) obj.user = Diffs[obj.diff];
    });

    // Sort registered users and IPs
    const isIPAddress = ip => net.isIP(ip) || isCidr(ip);
    var users = UserAN.filter(obj => needBlockCheck(obj) && obj.user).map(obj => obj.user);
    const ips = users.filter(username => isIPAddress(username)); // An array of IPs
    users = users.filter(username => !isIPAddress(username)); // An array of registered users

    // Check if the users and IPs in the arrays are locally blocked
    queries = [];
    queries.push(getBlockedUsers(users), getBlockedIps(ips)); // Get domain/duration/date properties of UserAN if blocked
    await Promise.all(queries); // Wait until all the async procedures finish

    // --- At this point, UserANs to mark up have a 'duration' property ---

    // Check if the users and IPs in the arrays are globally (b)locked
    if (checkGlobal) {
        let gUsers = UserAN.filter(obj => needBlockCheck(obj) && obj.user && !obj.duration).map(obj => obj.user); // Only check users that aren't locally blocked
        const gIps = gUsers.filter(username => isIPAddress(username));
        gUsers = gUsers.filter(username => !isIPAddress(username));
        queries = [];
        queries.push(getLockedUsers(gUsers), getGloballyBlockedIps(gIps));
        await Promise.all(queries);
    }

    // --- At this point, UserANs to mark up have a 'duration' or 'domain' property ---

    // Final check before edit
    if (UserAN.filter(obj => obj.domain || obj.duration).length === 0) return console.log('Procedure cancelled: There\'s no UserAN to update.');
    UserAN.filter(obj => obj.domain || obj.duration).forEach(obj => { // Get new UserANs to replace old ones with
        obj.new = obj.old.replace(/\|*\}{2}$/, '') + '|' + obj.domain + obj.duration + obj.date + '}}';
    });

    // Check how many UserANs are in each section
    const replacerCnt = UserAN.filter(obj => obj.new).reduce((acc, obj) => { // Create object {sectionTitle: cnt, sectionTitle2: cnt2...}
        if (!acc[obj.section]) acc[obj.section] = 0;                          // This object counts how many UserANs are to be updated in each section
        acc[obj.section]++;
        return acc;
    }, Object.create(null));
    const openReportsCnt = UserAN.filter(obj => !obj.ignore).reduce((acc, obj) => { // This stores the number of open reports in each section
        if (!acc[obj.section]) acc[obj.section] = 0;
        if (!obj.closed && !obj.new) acc[obj.section]++;
        return acc;
    }, Object.create(null));

    // Get summary
    const getUserLink = (obj) => {
        if (obj.type.match(/^(?:user2|unl|usernolink)$/)) {
            const maxLetterCnt = containsJapaneseCharacter(obj.user) ? 10 : 20;
            if (obj.user.length > maxLetterCnt) {
                return `${obj.user.substring(0, maxLetterCnt)}.. (${obj.domain}${obj.duration})`;
            } else {
                return `[[特別:投稿記録/${obj.user}|${obj.user}]] (${obj.domain}${obj.duration})`;
            }
        } else if (obj.type.match(/^(?:ip2|ipuser2)$/)) {
            return `[[特別:投稿記録/${obj.user}|${obj.user}]] (${obj.domain}${obj.duration})`;
        } else if (obj.type.match(/^(?:log|logid)$/)) {
            return `[[特別:転送/logid/${obj.logid}|Logid/${obj.logid}]] (${obj.domain}${obj.duration})`;
        } else if (obj.type.match(/^(?:dif|diff)$/)) {
            return `[[特別:差分/${obj.diff}|差分/${obj.diff}]]の投稿者 (${obj.domain}${obj.duration})`;
        }
    };
    var summary = '';
    if (Object.keys(replacerCnt).length > 1) { // If the bot is to mark up UserANs in multiple sections
        summary += 'bot:';
        const reportsBySection = UserAN.filter(obj => obj.new).reduce((acc, obj, i) => { // {section1: [{ user: username, ...}],
            if (!acc[obj.section]) acc[obj.section] = [{...obj}];                        //  section2: [{ user: username, ...}],
            if (i !== 0 && acc[obj.section].every(obj2 => obj2.user !== obj.user)) {     //  ... } ### UserANs to update in each section
                acc[obj.section].push({...obj}); // Push the object iff loop cnt != 0 & the relevant username isn't in the array of objects
            }                                    // (This prevents the output involving the same username: One user could be reported multiple
            return acc;                          //  times in the same section)
        }, Object.create(null));
        for (let key in reportsBySection) {
            summary += ` /*${key}*/ `;
            const bool = reportsBySection[key].every((obj, i) => {
                let tempSummary = (i === 0 ? getUserLink(obj) : ', ' + getUserLink(obj));
                if ((summary + tempSummary).length <= 500) { // Prevent the summary from exceeding the max word count
                    summary += tempSummary;
                    return true; // Go on to the next loop
                } else {
                    summary += ' ほか';
                    return false; // Exit the loop
                }
            });
            summary += ` (未${openReportsCnt[key]})`;
            if (!bool) break; // array.every() returned false, which means the summary reached the word count limit
        }
    } else { // If the bot is to mark up UserANs in one section
        const userlinksArr = [];
        UserAN.filter(obj => obj.new).forEach((obj, i) => {
            const userlink = getUserLink(obj);
            if (!userlinksArr.includes(userlink)) { // Prevent the same links from being displayed
                summary += (i === 0 ? userlink : ', ' + userlink);
                userlinksArr.push(userlink);
            }
        });
        summary = `/*${Object.keys(replacerCnt)[0]}*/ bot: ` + summary + ` (未${openReportsCnt[Object.keys(replacerCnt)[0]]})`;
    }

    // Edit the relevant page
    const result = await edit(pagename, summary);
    switch(result) {
        case true:
            console.log('Edit done.');
            break;
        case false:
            console.log('Edit failed due to an unknown error.');
            break;
        default:
            console.log('Edit failed: ' + result);
    }

}

async function edit(pagename, summary) {

    // Get the latest revision and its timestamp(s)
    const parsed = await lib.getLatestRevision(pagename);
    if (!parsed) return 'Failed to get the latest revision.';
    var wikitext = parsed.content;

    // Update UserANs in the source text
    UserAN.filter(obj => obj.new).forEach(obj => wikitext = wikitext.split(obj.old).join(obj.new));

    // Edit the page
    return new Promise(resolve => {
        api.request({
            'action': 'edit',
            'title': pagename,
            'text': wikitext,
            'summary': summary,
            'minor': true,
            //'bot': true,
            'basetimestamp': parsed.basetimestamp,
            'starttimestamp': parsed.curtimestamp,
            'token': token
        }).then(res => {
            if (res && res.edit) {
                if (res.edit.result === 'Success') return resolve(true);
            }
            resolve(false);
        }).catch((err) => resolve(err));
    });

}

//********************** UTILITY FUNCTIONS **********************/

/**
 * Split a string into two
 * @param {string} str 
 * @param {string} delimiter 
 * @returns {Array}
 */
function splitInto2(str, delimiter) {
    const index = str.lastIndexOf(delimiter);
    if (index === -1) return;
    const firstPart = str.substring(0, index);
    const secondPart = str.substring(index + 1);
    return [firstPart, secondPart];
}

async function convertLogidsToUsernames(arr) {

    if (arr.length === 0) return [];
    var logidsArr = JSON.parse(JSON.stringify(arr));
    var cnt = 0;
    return await logidQuery();

    function logidQuery(lecontinue) {
        cnt++;
        return new Promise(resolve => {
            api.request({
                'action': 'query',
                'list': 'logevents',
                'leprop': 'ids|user',
                'letype': 'newusers',
                'lelimit': 'max',
                'lecontinue': lecontinue,
                'formatversion': 2
            }).then(async res => {
                var resLgEv;
                if (!res || !res.query) return resolve();
                if ((resLgEv = res.query.logevents).length === 0) return resolve();
                resLgEv.forEach(obj => {
                    let logid = obj.logid.toString();
                    if (!Logids[logid]) Logids[logid] = obj.user;
                });
                logidsArr = logidsArr.filter(item => !Logids[item]); // Remove logids that have already been converted
                if (logidsArr.length !== 0 && res.continue && cnt <= 10) await logidQuery(res.continue.lecontinue);
                resolve();
            }).catch(() => resolve());
        });
    }

}

async function convertDiffidsToUsernames(arr) {
    if (arr.length === 0) return [];
    return new Promise(resolve => {
        api.request({
            'action': 'query',
            'revids': arr.slice(0, 50).join('|'),
            'prop': 'revisions',
            'formatversion': 2
        }).then(res => {
            var resPgs;
            if (!res || !res.query) return resolve();
            if ((resPgs = res.query.pages).length === 0) return resolve();
            resPgs.forEach(page => {
                let revid = page.revisions[0].revid.toString();
                if (!Diffs[revid]) Diffs[revid] = page.revisions[0].user;
            });
            resolve();
        }).catch(() => resolve(returnArr));
    });
}

async function getBlockedUsers(usersArr) {

    if (usersArr.length === 0) return;
    const users = JSON.parse(JSON.stringify(usersArr));
    const queries = [];
    while (users.length !== 0) {
        queries.push(blockQuery(users.slice(0, 50)));
        users.splice(0, 50);
    }
    await Promise.all(queries);
    return;

    function blockQuery(arr) {
        return new Promise(resolve => {
            api.request({
                'action': 'query',
                'list': 'blocks',
                'bklimit': 50,
                'bkusers': arr.join('|'),
                'bkprop': 'user|timestamp|expiry|restrictions',
                'formatversion': 2
            }).then(res => {
                var resBlck;
                if (!res || !res.query) return resolve();
                if ((resBlck = res.query.blocks).length === 0) return resolve();
                for (const blck of resBlck) {
                    const partial = blck.restrictions && !Array.isArray(blck.restrictions);
                    const indef = (blck.expiry === 'infinity');
                    UserAN.forEach(obj => {
                        if (obj.user === blck.user) {
                            const newlyReported = lib.compareTimestamps(obj.timestamp, blck.timestamp);
                            let duration;
                            if (newlyReported) {
                                if (!indef) duration = lib.getDuration(blck.timestamp, blck.expiry);
                                obj.duration = indef ? '無期限' : duration;
                                obj.date = getBlockedDate(blck.timestamp);
                                obj.domain = partial ? '部分ブロック ' : '';
                            }
                        }
                    });
                }
                resolve();
            }).catch((err) => resolve(console.log(err.error.info)));
        });
    }
}

async function getBlockedIps(ipsArr) {

    if (ipsArr.length === 0) return;
    const queries = [];
    for (let i = 0; i < ipsArr.length; i++) queries.push(blockQuery(ipsArr[i]));
    await Promise.all(queries);
    return;

    function blockQuery(ip) {
        return new Promise(resolve => {
            api.request({
                'action': 'query',
                'list': 'blocks',
                'bklimit': 1,
                'bkip': ip,
                'bkprop': 'user|timestamp|expiry|restrictions',
                'formatversion': 2
            }).then(res => {
                var resBlck;
                if (!res || !res.query) return resolve();
                if ((resBlck = res.query.blocks).length === 0) return resolve();
                resBlck = resBlck[0];
                const rangeBlocked = (resBlck.user !== ip && resBlck.user.substring(resBlck.user.length - 3) !== ip.substring(ip.length - 3));
                const partial = resBlck.restrictions && !Array.isArray(resBlck.restrictions);
                const indef = (resBlck.expiry === 'infinity');
                UserAN.forEach(obj => {
                    if (obj.user === ip) {
                        const newlyReported = lib.compareTimestamps(obj.timestamp, resBlck.timestamp);
                        let duration;
                        if (newlyReported) {
                            if (!indef) duration = lib.getDuration(resBlck.timestamp, resBlck.expiry);
                            obj.duration = indef ? '無期限' : duration;
                            if (rangeBlocked) obj.duration = resBlck.user.substring(resBlck.user.length - 3) + 'で' + obj.duration;
                            obj.date = getBlockedDate(resBlck.timestamp);
                            obj.domain = partial ? '部分ブロック ' : '';
                        }
                    }
                });
                resolve();
            }).catch((err) => resolve(console.log(err.error.info)));
        });
    }

}

/**
 * Get an array of locked users from an array of registered users
 * @param {Array} regUsersArr 
 * @returns {Promise<Array>}
 */
async function getLockedUsers(regUsersArr) {

    if (regUsersArr.length === 0)  return [];

    const glockQuery = user => new Promise(resolve => {
        api.request({
            action: 'query',
            list: 'globalallusers',
            agulimit: 1,
            agufrom: user,
            aguto: user,
            aguprop: 'lockinfo'
        }).then(res => {
            var resLck;
            if (!res || !res.query) return resolve();
            if ((resLck = res.query.globalallusers).length === 0) return resolve(false); // The array is empty: not locked
            resolve(resLck[0].locked !== undefined); // resLck[0].locked === '' if locked, otherwise undefined
        }).catch((err) => resolve(console.log(err.error.info)));
    });

    const queries = [], lockedUsers = [];
    for (const user of regUsersArr) {
        queries.push(glockQuery(user).then(locked => {
            if (locked) lockedUsers.push(user);
        }));
    }
    await Promise.all(queries);
    lockedUsers.forEach(username => {
        UserAN.forEach(obj => {
            if (obj.user === username) obj.domain = 'グローバルロック';
        });
    });

}

async function getGloballyBlockedIps(arr) {

    if (arr.length === 0) return;

    const gblockQuery = ip => {
        return new Promise(resolve => {
            api.request({
                'action': 'query',
                'list': 'globalblocks',
                'bgip': ip,
                'bglimit': 1,
                'bgprop': 'address|expiry|timestamp',
                'formatversion': 2
            }).then(res => {
                var resGblck;
                if (!res || !res.query) return resolve();
                if ((resGblck = res.query.globalblocks).length === 0) return resolve(); // If the array in the reponse is empty, the IP isn't g-blocked
                resGblck = resGblck[0];
                const indef = (resGblck.expiry === 'infinity');
                UserAN.forEach(obj => {
                    if (obj.user === ip) {
                        const newlyReported = lib.compareTimestamps(obj.timestamp, resGblck.timestamp);
                        let duration;
                        if (newlyReported) {
                            if (!indef) duration = lib.getDuration(resGblck.timestamp, resGblck.expiry);
                            obj.duration = indef ? '無期限' : duration;
                            obj.date = getBlockedDate(resGblck.timestamp);
                            obj.domain = 'グローバルブロック ';
                        }
                    }
                });
                resolve();
            }).catch((err) => resolve(console.log(err.error.info)));
        });
    };

    const queries = [];
    for (const ip of arr) queries.push(gblockQuery(ip));
    await Promise.all(queries);

}

function getBlockedDate(timestamp) {
    const d = new Date(timestamp);
    d.setHours(d.getHours() + 9);
    const ts = d.toJSON().replace(/\.\d{3}Z$/, 'Z');
    const mtch = ts.match(/^\d{4}-(\d{2})-(\d{2})T\d{2}:\d{2}:\d{2}Z$/);
    for (let i = 1; i <= 2; i++) {
        if (mtch[i].indexOf('0') === 0) mtch[i] = mtch[i].substring(1);
    }
    return ` (${mtch[1]}/${mtch[2]})`;
}

function containsJapaneseCharacter(str) {
    return str.match(/[\u30a0-\u30ff\u3040-\u309f\u3005-\u3006\u30e0-\u9fcf]+/) ? true : false;
}

//*******************************************/

})(); // IIFE closure