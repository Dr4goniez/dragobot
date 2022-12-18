import { lib } from './lib';

//********************** MAIN FUNCTION **********************/

/** @type {Array} */
var UserAN;
/** {logid: username, logid2: username2...} */
const Logids = {};
/** {diffid: username, diffid2: username2...} */
const Diffs = {};
/** @type {Array} */
var unprocessableLogids = [];
var leend, apilimit;
const ANI = 'Wikipedia:管理者伝言板/投稿ブロック',
      ANS = 'Wikipedia:管理者伝言板/投稿ブロック/ソックパペット',
      AN3RR = 'Wikipedia:管理者伝言板/3RR';

/**
 * @param {string} token
 * @param {boolean} checkGlobal
 * @param {string} [editedTs]
 * @returns {Promise<{editedTs: string|undefined, token: string|null}>} token has a value only if re-logged in
 */
async function markupUserANs(token, checkGlobal, editedTs) {

    var result,
        reloggedin = false;
    for (const page of [ANI, ANS, AN3RR]) {
        lib.log(`Checking ${page}...`);
        result = await markup(page, token, checkGlobal, editedTs);
        editedTs = result ? result : editedTs;
        if (result === null) {
            lib.log('Edit token seems to have expired. Re-logging in...');
            reloggedin = true;
            token = await lib.getToken();
        }
    }

    return {
        editedTs: editedTs,
        token : reloggedin ? token : null
    };

}
module.exports.markupUserANs = markupUserANs;

/**
 * @param {string} pagename
 * @param {string} token
 * @param {boolean} checkGlobal
 * @param {string} [editedTs] Timestamp of last edit
 * @param {boolean} [noapihighlimit]
 * @returns {Promise<string|undefined|null>} JSON timestamp if the target page is edited, or else undefined (null if re-login is needed)
 */
async function markup(pagename, token, checkGlobal, editedTs, noapihighlimit) {

    apilimit = noapihighlimit ? 50 : 500;

    // Get page content
    const parsed = await lib.getLatestRevision(pagename);
    if (!parsed) return lib.log('Failed to parse the page.');
    /** @type {string} */
    const wikitext = parsed.content;
    var templates = lib.getOpenUserANs(wikitext);
    if (templates.length === 0) return lib.log('Procedure cancelled: There\'s no UserAN to update.');

    // Remove redundant UserANs
    templates = templates.filter(template => !template.match(/\|\s*bot\s*=\s*no/)); // Remove UserANs with a bot=no parameter

    // Create an array of objects out of the templates
    UserAN = templates.map(tl => {
        return {
            old: tl,
            new: '',
            modified: '',
            timestamp: '',
            section: '',
            user: '',
            type: '',
            logid: '',
            diff: '',
            none: '',
            // The following gets a value if the user reported by the UserAN has been blocked
            domain: '', // Like partial block, global block, and global lock
            duration: '',
            flags: '',
            date: '',
            reblocked: ''
        };
    });

    // RegExps to evaluate the templates' parameters
    const paramsRegExp = {
        bot: /'^\s*bot\s*=/, // bot=
        user: /^\s*(?:1|[Uu]ser)\s*=/, // Template param: 1=, user=, or User=
        type: /^\s*(?:t|[Tt]ype)\s*=/, // Template param: t=, type=, or Type=
        statusS: /^\s*(?:状態|s|[Ss]tatus)\s*=/, // Template param: 状態=, s=, status=, or Status=. ⇓ Closed verson
        section: /={2,5}[^\S\r\n]*.+[^\S\r\n]*={2,5}/g // == sectiontitle == (2-5 levels)
    };

    // Set the 'type', 'user', 'section', and 'timestamp' properties of the object
    UserAN.forEach(obj => {

        var params = lib.getTemplateParams(obj.old);
        params = params.filter(item => !item.match(paramsRegExp.bot) && !item.match(paramsRegExp.statusS)); // Remove bot= and 状態= params

        /**********************************************************************************************************\
            A full list of open UserANs' parameter combinations
                [(1=)username]
                [(1=)username, 状態=] => [(1=)username]
                [t=TYPE, (1=)username]
                [t=TYPE, (1=)username, 状態=] => [t=TYPE, (1=)username]
            Now we can differentiate these four in whether they have a t= param
        \***********************************************************************************************************/

        if (params.length > 2) return; // Contains an undefined parameter

        if (params.filter(item => item.match(paramsRegExp.type)).length === 0) { // If the template doesn't have a t= param
            const userParam = params[0].trim2();
            obj.user = userParam;
            obj.type = 'user2';
            if (lib.isIPAddress(userParam)) {
                obj.modified = `{{UserAN|t=IP2|${userParam}}}`;
                obj.type = 'ip2';
            }
        } else { // If the template has a t= param
            obj.type = params.filter(item => item.match(paramsRegExp.type))[0].replace(paramsRegExp.type, '').trim2().toLowerCase();
            let userParam = params.filter(item => !item.match(paramsRegExp.type))[0].replace(paramsRegExp.user, '').trim2();
            if (lib.isIPv6(userParam)) userParam = userParam.toUpperCase();
            switch (obj.type) {
                case 'user2':
                case 'unl':
                case 'usernolink':
                    obj.user = userParam;
                    if (lib.isIPAddress(userParam)) {
                        obj.modified = `{{UserAN|t=IP2|${userParam}}}`;
                        obj.type = 'ip2';
                    }
                    break;
                case 'ip2':
                case 'ipuser2':
                    obj.user = userParam;
                    if (!lib.isIPAddress(userParam)) {
                        obj.modified = `{{UserAN|${userParam}}}`;
                        obj.type = 'user2';
                    }
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
                    if (lib.isIPAddress(userParam)) {
                        obj.user = userParam;
                        obj.type = 'ip2';
                        obj.modified = `{{UserAN|t=IP2|${userParam}}}`;
                    }
            }
        }

        // Get a timestamp for obj
        const wtSplit = wikitext.split2(obj.old, true); // Split the source text at the template and find the first signature following it
        var ts = wtSplit[1].match(/(\d{4})年(\d{1,2})月(\d{1,2})日 \(.{1}\) (\d{2}:\d{2}) \(UTC\)/); // YYYY年MM月DD日 (日) hh:mm (UTC)
        if (!ts) return;
        for (let i = 2; i <= 3; i++) {
            ts[i] = ts[i].length === 1 ? '0' + ts[i] : ts[i]; // MM and DD may be of one digit but they need to be of two digits
        }
        ts = `${ts[1]}-${ts[2]}-${ts[3]}T${ts[4]}:00Z`; // YYYY-MM-DDThh:mm:00Z (hh:mm is one capturing group)
        obj.timestamp = ts;

        // Get a section title
        const mtch = wikitext.split2(obj.old)[0].match(paramsRegExp.section); // Split the srctxt at tpl and get the last section title in arr[0]
        if (mtch) obj.section = mtch[mtch.length - 1].replace(/(^={2,5}[^\S\r\n]*|[^\S\r\n]*={2,5}$)/g, ''); // Remove '='s

    });
    UserAN = UserAN.filter(obj => obj.user || obj.logid || obj.diff); // Remove UserANs that can't be forwarded to block check

    // Get an array of logids and diff numbers (these need to be converted to usernames through API requests before block check)
    const collectLogids = function() {
        return UserAN.filter(obj => obj.logid && !obj.user && !Logids[obj.logid]).map(obj => obj.logid).filter(logid => !unprocessableLogids.includes(logid)).undup();
    };
    var logids = collectLogids();
    const diffs = UserAN.filter(obj => obj.diff && !obj.user && !Diffs[obj.diff]).map(obj => obj.diff);

    // Convert logids and diffids to usernames through API queries (for logids, only search for the latest 5000 logevents)
    var queries = [];
    queries.push(convertLogidsToUsernames(logids), convertDiffidsToUsernames(diffs)); // These functions save the response into Logids and Diffs
    await Promise.all(queries);
    UserAN.forEach(obj => { // Set the 'user' property of UserAN if possible
        if (obj.logid && !obj.user && Logids[obj.logid]) obj.user = Logids[obj.logid];
        if (obj.diff && !obj.user && Diffs[obj.diff]) obj.user = Diffs[obj.diff];
    });

    // Another attempt to convert logids
    logids = collectLogids();
    queries = [];
    logids.forEach(logid => {
        queries.push(lib.scrapeUsernameFromLogid(logid));
    });
    const scrapedUsernames = await Promise.all(queries);
    scrapedUsernames.forEach((u, i) => {
        if (!u) return;
        var logid = logids[i];
        if (!Logids[logid]) Logids[logid] = u;
    });
    UserAN.forEach(obj => {
        if (obj.logid && !obj.user && Logids[obj.logid]) obj.user = Logids[obj.logid];
    });
    logids = collectLogids();
    unprocessableLogids = unprocessableLogids.concat(logids).undup();

    // Sort registered users and IPs
    var users = UserAN.filter(obj => obj.user).map(obj => obj.user).undup();
    const ips = users.filter(username => lib.isIPAddress(username)); // An array of IPs
    users = users.filter(username => !lib.isIPAddress(username)); // An array of registered users

    // Check if the users and IPs in the arrays are locally blocked
    queries = [];
    queries.push(getBlockedUsers(users, pagename === ANS), getBlockedIps(ips)); // Get domain/duration/date properties of UserAN if blocked
    const result = await Promise.all(queries); // Wait until all the async procedures finish
    const usersForReblock = result.flat();
    queries = [];
    usersForReblock.forEach(user => queries.push(getReblockStatus(user)));
    await Promise.all(queries);
    // UserAN.slice().filter(obj => usersForReblock.includes(obj.user)).forEach(obj => console.log(obj));

    // --- Note: UserANs to mark up all have a 'date' property at this point ---

    // Check if the users and IPs in the arrays are globally (b)locked
    if (checkGlobal) {
        let gUsers = UserAN.filter(obj => obj.user && !obj.date).map(obj => obj.user).undup(); // Only check users that aren't locally blocked
        const gIps = gUsers.filter(username => lib.isIPAddress(username));
        gUsers = gUsers.filter(username => !lib.isIPAddress(username));
        queries = [];
        queries.push(getLockedUsers(gUsers), getGloballyBlockedIps(gIps));
        await Promise.all(queries);
    }

    // Final check before edit
    var modOnly = false; // True if no user is newly blocked but some UserANs need to be modified
    if (UserAN.some(obj => obj.date)) { // Someone is newly blocked
        UserAN.filter(obj => obj.modified).forEach(obj => obj.new = obj.modified);
        UserAN.filter(obj => obj.date).forEach(obj => { // Get new UserANs to replace old ones with
            const replacee = obj.modified ? obj.modified : obj.old;
            obj.new = replacee.replace(/\|*\}{2}$/, '') + '|' + obj.domain + obj.duration + obj.flags + obj.date + '}}';
        });
    } else if (UserAN.some(obj => obj.modified)) {
        modOnly = true;
        UserAN.filter(obj => obj.modified).forEach(obj => obj.new = obj.modified); // Get the modified UserANs to replace old ones with
    } else {
        return lib.log('Procedure cancelled: There\'s no UserAN to update.');
    }
    // UserAN.slice().filter(obj => obj.new).forEach(obj => console.log(obj));

    // Get summary
    var summary = 'Bot:';
    if (!modOnly) {

        /**
         * Creates a contribs link from an object that is an element of the 'UserAN' array
         * @param {object} obj
         * @returns {string}
         */
        const getUserLink = obj => {
            var condition = obj.reblocked || obj.domain + obj.duration;
            if (obj.type.match(/^(?:user2|unl|usernolink)$/)) {
                const maxLetterCnt = containsJapaneseCharacter(obj.user) ? 10 : 20;
                if (obj.user.length > maxLetterCnt) {
                    return `${obj.user.substring(0, maxLetterCnt)}.. (${condition})`;
                } else {
                    return `[[特別:投稿記録/${obj.user}|${obj.user}]] (${condition})`;
                }
            } else if (obj.type.match(/^(?:ip2|ipuser2)$/)) {
                return `[[特別:投稿記録/${obj.user}|${obj.user}]] (${condition})`;
            } else if (obj.type.match(/^(?:log|logid)$/)) {
                return `[[特別:転送/logid/${obj.logid}|Logid/${obj.logid}]] (${condition})`;
            } else if (obj.type.match(/^(?:dif|diff)$/)) {
                return `[[特別:差分/${obj.diff}|差分/${obj.diff}]]の投稿者 (${condition})`;
            }
        };

        /**
         * Filter out objects that are elements of the UserAN array and create a new object with its keys named after each section title.
         * @type {{section1: Array<{}>, section2: Array<{}>, ...}} The array set as the object's properties only contains UserANs that need to be updated.
         */
        const reportsBySection = UserAN.filter(obj => obj.new && obj.date).reduce((acc, obj, i) => {
            if (!acc[obj.section]) acc[obj.section] = [{...obj}];
            if (i !== 0 && acc[obj.section].every(obj2 => obj2.user !== obj.user)) {
                acc[obj.section].push({...obj});
            }                                    // Push the object iff loop cnt != 0 & the relevant username isn't in the array of objects
            return acc;                          // (This prevents the output involving the same username: One user could be reported multiple
        }, Object.create(null));                 //  times in the same section)

        for (const sectiontitle in reportsBySection) { // Loop through all keys of the created object (i.e. section titles)

            // Loop through the elements of the array that is the property of the corresponding key until the loop returns false
            const bool = reportsBySection[sectiontitle].every(obj => {

                const userlink = getUserLink(obj);
                if (summary.includes(userlink)) return true; // Do nothing if the summary already has a link for the relevant user

                const sectionlink = ` /*${sectiontitle}*/`;
                var sectionlinkAdded = false;
                if (!summary.includes(sectionlink)) {
                    summary += sectionlink;
                    sectionlinkAdded = true;
                }
                var tempSummary = (sectionlinkAdded ? '' : ', ') + userlink;
                if ((summary + tempSummary).length <= 500 - 3) { // Prevent the summary from exceeding the max word count
                    summary += tempSummary;
                    return true; // Go on to the next loop
                } else {
                    summary += ' ほか';
                    return false; // Exit the loop
                }

            });
            if (!bool) break; // array.every() returned false, which means the summary reached the word count limit

        }

    } else {
        summary = ' UserANの修正';
    }

    // Get the latest revision and its timestamp(s)
    const lr = await lib.getLatestRevision(pagename);
    if (!lr) return 'Failed to get the latest revision.';
    var newContent = lr.content;

    // Update UserANs in the source text
    UserAN.filter(obj => obj.new).forEach(obj => newContent = newContent.split(obj.old).join(obj.new));

    // Edit the page
    const params = {
        action: 'edit',
        title: pagename,
        text: newContent,
        summary: summary,
        minor: true,
        basetimestamp: lr.basetimestamp,
        starttimestamp: lr.curtimestamp,
        token: token
    };
    if (modOnly) params.bot = true;

    const ts = await lib.editPage(params, editedTs);
    return ts;

}
module.exports.markup = markup; // Used only for debugging purposes when called outside the module

//********************** UTILITY FUNCTIONS **********************/

/**
 * @param {Array<string>} logidsArr
 * @returns {Promise}
 */
async function convertLogidsToUsernames(logidsArr) {

    if (logidsArr.length === 0) return [];
    logidsArr = logidsArr.slice(); // Create a deep copy
    var cnt = 0;
    var firstTs;
    await logidQuery();
    if (firstTs) leend = firstTs;
    return;

    function logidQuery(lecontinue) {
        cnt++;
        return new Promise(resolve => {
            lib.api.request({
                action: 'query',
                list: 'logevents',
                leprop: 'ids|title|timestamp',
                letype: 'newusers',
                leend: leend,
                lelimit: 'max',
                lecontinue: lecontinue,
                formatversion: '2'
            }).then(async res => {

                var resLgEv, resCont;
                if (!res || !res.query || !(resLgEv = res.query.logevents)) return resolve();
                if (resLgEv.length === 0) return resolve();

                resLgEv.forEach(obj => {
                    if (!firstTs) {
                        firstTs = obj.timestamp;
                        firstTs = new Date(firstTs);
                        firstTs.setSeconds(firstTs.getSeconds() + 1);
                        firstTs = firstTs.toJSON().replace(/\.\d{3}Z$/, 'Z');
                    }
                    if (typeof obj.title === 'undefined') return;
                    const logid = obj.logid.toString();
                    if (!Logids[logid]) Logids[logid] = obj.title.replace(/^利用者:/, '');
                });
                logidsArr = logidsArr.filter(item => !Logids[item]); // Remove logids that have already been converted

                if (logidsArr.length !== 0 && cnt <= 10) {
                    if (res && res.continue && (resCont = res.continue.lecontinue)) {
                        await logidQuery(resCont);
                    }
                }
                resolve();

            }).catch(err => resolve(lib.log(err)));
        });
    }

}

/**
 * @param {Array<string>} diffIdsArr
 * @returns {Promise}
 */
async function convertDiffidsToUsernames(diffIdsArr) {
    if (diffIdsArr.length === 0) return;
    return new Promise(resolve => {
        lib.api.request({
            action: 'query',
            revids: diffIdsArr.slice(0, apilimit).join('|'),
            prop: 'revisions',
            formatversion: '2'
        }).then(res => {

            var resPgs;
            if (!res || !res.query || !(resPgs = res.query.pages)) return resolve();
            if (resPgs.length === 0) return resolve();

            resPgs.forEach(page => {
                var revid = page.revisions[0].revid.toString();
                if (!Diffs[revid]) Diffs[revid] = page.revisions[0].user;
            });

            resolve();

        }).catch(err => resolve(lib.log(err)));
    });
}

/**
 * @param {Array<string>} usersArr
 * @param {boolean} indefOnly If true, only looks at indef blocks (for ANS)
 * @returns {Promise<Array<string>>} Returns an array of users who need to be reblocked
 */
async function getBlockedUsers(usersArr, indefOnly) {

    if (usersArr.length === 0) return [];
    usersArr = usersArr.slice();
    const queries = [];
    while (usersArr.length !== 0) {
        queries.push(blockQuery(usersArr.splice(0, apilimit)));
    }
    var result = await Promise.all(queries);
    result = result.filter(el => el).flat().undup();
    return result;

    /**
     * @param {Array<string>} arr
     * @returns {Promise<Array<string>|undefined>} An array of users who need to be reblocked
     */
    function blockQuery(arr) {
        return new Promise(resolve => {
            lib.api.request({
                action: 'query',
                list: 'blocks',
                bklimit: 'max',
                bkusers: arr.join('|'),
                bkprop: 'user|timestamp|expiry|restrictions|flags',
                formatversion: '2'
            }).then(res => {

                var resBlck;
                if (!res || !res.query || !(resBlck = res.query.blocks)) return resolve();
                if (resBlck.length === 0) return resolve();

                if (indefOnly) resBlck = resBlck.filter(obj => obj.expiry === 'infinity');
                const needReblock = [];
                for (const blck of resBlck) {
                    const nousertalk = !blck.allowusertalk,
                          noemail = blck.noemail,
                          partial = blck.restrictions && !Array.isArray(blck.restrictions),
                          indef = blck.expiry === 'infinity';
                    UserAN.filter(obj => obj.user === blck.user).forEach(obj => {
                        const newlyReported = lib.compareTimestamps(obj.timestamp, blck.timestamp, true) >= 0;
                        if (newlyReported) {
                            obj.duration = indef ? '無期限' : lib.getDuration(blck.timestamp, blck.expiry);
                            obj.date = getBlockedDate(blck.timestamp);
                            obj.domain = partial ? '部分ブロック ' : '';
                            if (nousertalk && noemail) {
                                obj.flags = ' 会話×・メール×';
                            } else if (nousertalk) {
                                obj.flags = ' 会話×';
                            } else if (noemail) {
                                obj.flags = ' メール×';
                            }
                        } else {
                            needReblock.push(obj.user);
                        }
                    });
                }

                resolve(needReblock);

            }).catch((err) => resolve(lib.log(err)));
        });
    }
}

/**
 * @param {Array<string>} ipsArr
 * @returns {Promise<Array<string>>} Returns an array of IPs that need to be reblocked
 */
async function getBlockedIps(ipsArr) {

    if (ipsArr.length === 0) return [];
    const queries = [];
    ipsArr.forEach(ip => queries.push(blockQuery(ip)));
    var result = await Promise.all(queries);
    result = result.filter(el => el).undup();
    return result;

    /**
     * @param {string} ip
     * @returns {Promise<string|undefined>} Returns the queried IP only if it needs to be reblocked
     */
    function blockQuery(ip) {
        return new Promise(resolve => {
            lib.api.request({
                action: 'query',
                list: 'blocks',
                bklimit: '1',
                bkip: ip,
                bkprop: 'user|timestamp|expiry|restrictions|flags',
                formatversion: '2'
            }).then(res => {

                var resBlck;
                if (!res || !res.query || !(resBlck = res.query.blocks)) return resolve();
                if (resBlck.length === 0) return resolve();

                resBlck = resBlck[0];
                const nousertalk = !resBlck.allowusertalk,
                      noemail = resBlck.noemail,
                      hardblock = !resBlck.anononly,
                      partial = resBlck.restrictions && !Array.isArray(resBlck.restrictions),
                      indef = resBlck.expiry === 'infinity',
                      rangeblock = resBlck.user !== ip && resBlck.user.substring(resBlck.user.length - 3) !== ip.substring(ip.length - 3);
                var needReblock;
                UserAN.filter(obj => obj.user === ip).forEach(obj => {
                    const newlyReported = lib.compareTimestamps(obj.timestamp, resBlck.timestamp, true) >= 0;
                    if (newlyReported) {
                        obj.duration = indef ? '無期限' : lib.getDuration(resBlck.timestamp, resBlck.expiry);
                        if (rangeblock) obj.duration = resBlck.user.substring(resBlck.user.length - 3) + 'で' + obj.duration;
                        obj.date = getBlockedDate(resBlck.timestamp);
                        obj.domain = partial ? '部分ブロック ' : '';
                        if (nousertalk && noemail) {
                            obj.flags = ' 会話×・メール×';
                        } else if (nousertalk) {
                            obj.flags = ' 会話×';
                        } else if (noemail) {
                            obj.flags = ' メール×';
                        }
                        if (hardblock) obj.flags = ' ハードブロック' + (obj.flags ? obj.flags.replace(/^ /, '・') : '');
                    } else {
                        needReblock = ip;
                    }
                });

                resolve(needReblock);

            }).catch((err) => resolve(lib.log(err)));
        });
    }

}

/**
 * @param {string} blockedusername
 * @returns {Promise}
 */
function getReblockStatus(blockedusername) {
    return new Promise(resolve => {
        lib.api.request({
            action: 'query',
            list: 'logevents',
            letype: 'block',
            letitle: '利用者:' + blockedusername,
            formatversion: '2'
        }).then(res => {

            var resLgev;
            if (!res || !res.query || !(resLgev = res.query.logevents)) return resolve();
            if (resLgev.length === 0) return resolve();
            resLgev = resLgev.filter(obj => obj.action !== 'unblock'); // Rm irrelevant unblock logs

            // Get the latest block and reblocks (e.g. [reblock, reblock, block, reblock, block] => [reblock, reblock, block])
            var latestBlockIndex;
            for (let i = 0; i < resLgev.length; i++) {
                if (resLgev[i].action === 'block') {
                    latestBlockIndex = i;
                    break;
                }
            }
            resLgev = resLgev.slice(0, latestBlockIndex + 1);
            if (!resLgev.some(obj => obj.action === 'reblock')) return resolve();

            // Filter out 2 of the relevant blocks (Note: The response array always has at least one length because the user passed as the param
            // is blocked at the time. Reblock logs have been filtered out in the code above, and thus resLgev has TWO OR MORE elements when the
            // code reaches the lines below; in other words, we don't need any condition for when the array has exactly two elements in it.)
            if (resLgev.length > 2) { // If reblocked multiple times
                const base = resLgev.reduce((acc, obj) => { // Get the first element in the array that is action=block, or action=reblock
                    if (acc.length !== 0) return acc;       // that was applied more than 1 hour before the latest reblock
                    if (obj.action === 'block' || lib.compareTimestamps(obj.timestamp, resLgev[0].timestamp) > 1*60*60*1000) {
                        acc.push(obj);
                    }
                    return acc;
                }, []);
                resLgev = [].concat(resLgev[0], base);
            }

            // Clean up some properties
            resLgev.forEach(obj => {

                // Make sure that both elements have a 'expiry' property (the prop is undefined in the case of indefinite block)
                if (obj.params.duration === 'infinity' && !obj.params.expiry) obj.params.expiry = 'infinity';

                // Remove 'nocreate' and 'noautoblock' because they're irrelevant
                var i;
                if ((i = obj.params.flags.indexOf('nocreate')) !== -1) obj.params.flags.splice(i, 1);
                if ((i = obj.params.flags.indexOf('noautoblock')) !== -1) obj.params.flags.splice(i, 1);

                // If the user is an IP, change 'anononly' to 'hardblock'
                if (lib.isIPAddress(blockedusername)) {
                    if ((i = obj.params.flags.indexOf('anononly')) !== -1) {
                        obj.params.flags.splice(i, 1);
                    } else {
                        obj.params.flags.unshift('hardblock');
                    }
                }

            });

            // Get what's changed
            const b1st = resLgev[1],
                  b2nd = resLgev[0];

            // Domain
            var domain = '';
            if (b1st.params.sitewide && b2nd.params.sitewide) {
                // Do nothing
            } else if (b1st.params.sitewide && !b2nd.params.sitewide) {
                domain = '部分ブロック';
            } else if (!b1st.params.sitewide && b2nd.params.sitewide) {
                domain = 'サイト全体';
            } else { // !b1st.params.sitewide && !b2nd.params.sitewide
                if (JSON.stringify(b1st.params.restrictions) === JSON.stringify(b2nd.params.restrictions)) {
                    // Do nothing
                } else {
                    domain = '部分ブロック条件変更';
                }
            }

            // Duration (if changed, substitute the 'duration' variable with the new expiry)
            var duration = '';
            if (b1st.params.expiry !== b2nd.params.expiry) duration = b2nd.params.expiry;

            // Flags
            var flags = '';
            if (JSON.stringify(b1st.params.flags) !== JSON.stringify(b2nd.params.flags)) {

                /**
                 * @param {string} str
                 * @param {boolean} removed
                 */
                const translate = (str, removed) => {
                    switch (str) {
                        case 'hardblock':
                            return removed ? 'ソフトブロック' : 'ハードブロック';
                        case 'noemail':
                            return 'メール' + (removed ? '〇' : '×');
                        case 'nousertalk':
                            return '会話' + (removed ? '〇' : '×');
                        default:
                            return lib.log('translate() encountered an unrecognized value of ' + str + '.');
                    }
                };

                if (b1st.params.flags.length > b2nd.params.flags.length) { // Flags removed
                    flags = b1st.params.flags.filter(el => !b2nd.params.flags.includes(el));
                    flags = flags.map(el => translate(el, true));
                } else { // Flags added
                    flags = b2nd.params.flags.filter(el => !b1st.params.flags.includes(el));
                    flags = flags.map(el => translate(el, false));
                }
                flags = flags.join('・');

            }

            // Set properties of the UserAN array
            UserAN.filter(obj => obj.user === blockedusername).forEach(obj => {
                const newlyReported = lib.compareTimestamps(obj.timestamp, b2nd.timestamp, true) >= 0;
                if (newlyReported) {
                    obj.domain = domain;
                    obj.duration = duration === 'infinity' ? '無期限' : duration ? lib.getDuration(b2nd.timestamp, duration) : duration;
                    if (domain) obj.duration = ' ' + obj.duration;
                    obj.flags = (domain || duration ? ' ' : '') + flags;
                    obj.date = getBlockedDate(b2nd.timestamp);
                    obj.reblocked = 'ブロック条件変更';
                }
            });
            resolve();

        }).catch((err) => resolve(lib.log(err)));
    });
}

/**
 * Get an array of locked users from an array of registered users
 * @param {Array<string>} regUsersArr
 * @returns {Promise<Array<string>>}
 */
async function getLockedUsers(regUsersArr) {

    if (regUsersArr.length === 0)  return [];

    const glockQuery = user => new Promise(resolve => {
        lib.api.request({
            action: 'query',
            list: 'globalallusers',
            agulimit: '1',
            agufrom: user,
            aguto: user,
            aguprop: 'lockinfo'
        }).then(res => {
            var resLck;
            if (!res || !res.query || !(resLck = res.query.globalallusers)) return resolve();
            if (resLck.length === 0) return resolve(false); // The array is empty: not locked
            resolve(resLck[0].locked !== undefined); // resLck[0].locked === '' if locked, otherwise undefined
        }).catch((err) => resolve(lib.log(err)));
    });

    const lockedDate = getBlockedDate();

    const queries = [], lockedUsers = [];
    for (const user of regUsersArr) {
        queries.push(
            glockQuery(user).then(locked => {
                if (locked) lockedUsers.push(user);
            })
        );
    }
    await Promise.all(queries);
    lockedUsers.undup().forEach(username => {
        UserAN.filter(obj => obj.user === username).forEach(obj => {
            obj.domain = 'グローバルロック';
            obj.date = lockedDate;
        });
    });

}

/**
 * @param {Array<string>} ipsArr
 * @returns {Promise}
 */
async function getGloballyBlockedIps(ipsArr) {

    if (ipsArr.length === 0) return;

    const gblockQuery = ip => {
        return new Promise(resolve => {
            lib.api.request({
                action: 'query',
                list: 'globalblocks',
                bgip: ip,
                bglimit: '1',
                bgprop: 'address|expiry|timestamp',
                formatversion: '2'
            }).then(res => {

                var resGblck;
                if (!res || !res.query || !(resGblck = res.query.globalblocks)) return resolve();
                if (resGblck.length === 0) return resolve(); // If the array in the reponse is empty, the IP isn't g-blocked

                resGblck = resGblck[0];
                const indef = (resGblck.expiry === 'infinity');
                UserAN.filter(obj => obj.user === ip).forEach(obj => {
                    const newlyReported = lib.compareTimestamps(obj.timestamp, resGblck.timestamp, true) >= 0;
                    var duration;
                    if (newlyReported) {
                        if (!indef) duration = lib.getDuration(resGblck.timestamp, resGblck.expiry);
                        obj.duration = indef ? '無期限' : duration;
                        obj.date = getBlockedDate(resGblck.timestamp);
                        obj.domain = 'グローバルブロック ';
                    }
                });

                resolve();

            }).catch((err) => resolve(lib.log(err)));
        });
    };

    const queries = [];
    for (const ip of ipsArr) queries.push(gblockQuery(ip));
    await Promise.all(queries);

}

/**
 * Get ' (MM/DD)' from a JSON timestamp or the current time
 * @param {string} [timestamp] JSON timestamp in UTC
 * @returns {string} ' (MM/DD)'
 */
 function getBlockedDate(timestamp) {
    const d = timestamp ? new Date(timestamp) : new Date();
    d.setHours(d.getHours() + 9);
    return ` (${d.getMonth() + 1}/${d.getDate()})`;
}

/**
 * Check if a string contains a Japanese character
 * @param {string} str
 * @returns {boolean}
 */
function containsJapaneseCharacter(str) {
    return str.match(/[\u30a0-\u30ff\u3040-\u309f\u3005-\u3006\u30e0-\u9fcf]+/) ? true : false;
}