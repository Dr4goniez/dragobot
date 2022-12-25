import {
    ApiResponse,
    ApiParamsQueryLogEvents,
    ApiResponseQueryListLogevents,
    ApiResponseQueryListBlocks,
    ApiParamsQueryBlocks,
    ApiResponseQueryListGlobalblocks,
    ApiParamsEditPage
} from '.';
import * as lib from './lib';
import { log } from './server';

//********************** MAIN FUNCTION **********************/

interface UserANInfo {
    old: string,
    new: string,
    modified: string,
    timestamp: string,
    section: string,
    user: string,
    type: string,
    logid: string,
    diffid: string,
    none: string,
    domain: string,
    duration: string,
    flags: string,
    date: string,
    reblocked: string
}
let UserAN: UserANInfo[];

interface LogidList {
    /** An array of objects consisting of API responses.  */
    list: Array<{
        logid: string,
        username: string
    }>,
    /** An array of logids that can't be converted to a username either by API query or by web scraping. */
    unprocessable: string[],
    /** JSON timestamp passed to the API as a list=logevents query parameter (leend). Look only for log entries newer than this timestamp. */
    lookUntil: string
}
const Logids: LogidList = {
    list: [],
    unprocessable: [],
    lookUntil: ''
};

interface DiffidList {
    /** An array of objects consisting of API responses.  */
    list: Array<{
        diffid: string,
        username: string
    }>,
    /** An array of diffids that can't be converted to a username. */
    unprocessable: string[],
}
const Diffids: DiffidList = {
    list: [],
    unprocessable: []
};

const ANI = 'Wikipedia:管理者伝言板/投稿ブロック',
      ANS = 'Wikipedia:管理者伝言板/投稿ブロック/ソックパペット',
      AN3RR = 'Wikipedia:管理者伝言板/3RR';

export async function markupANs(checkGlobal: boolean) {
    for (const page of [ANI, ANS, AN3RR]) {
        log(`Checking ${page}...`);
        await markup(page, checkGlobal);
    }
}

export async function markup(pagetitle: string, checkGlobal: boolean): Promise<void> {

    // Get page content
    let lr = await lib.getLatestRevision(pagetitle);
    if (!lr) return log('Failed to parse the page.');
    const wkt = lr.content;

    // Get open UserANs
    const templates = lib.parseTemplates(wkt, {
        templatePredicate: (template) => {

            const isUserAN = template.name === 'UserAN';
            const params = template.arguments.filter(param => param.text); // Remove empty parameters
            const isBotNo = params.filter(param => /bot/i.test(param.name) && /no/i.test(param.value)).length > 0;

            /**********************************************************************************************************\
                A full list of parameter combinations
                    params.length === 1
                    - [(1=)username] (open)
                    params.length === 2
                    - [t=TYPE, (1=)username] (open)
                    - [(1=)username, 状態=] (open)
                    - [(1=)username, 状態=X] (closed) => UserANs with a 状態=X paremeter are always closed
                    - [(1=)username, (2=)無期限] (closed)
                    params.length === 3
                    - [t=TYPE, (1=)username, 状態=] (open)
                    - [t=TYPE, (1=)username, 状態=X] (closed) => UserANs with a 状態=X paremeter are always closed
                    - [t=TYPE, (1=)username, (2=)無期限] (closed)
                    - [(1=)username, 状態=, (2=)無期限] (closed)
                    params.length === 4
                    - [t=TYPE, (1=)username, 状態=, (2=)無期限] (closed)
                Only UserANs with params in one of the four patterns need to be configured with obj.closed = false
            \***********************************************************************************************************/

            const hasOnlyOneIntegerParam = params.filter(param => /^\d+$/.test(param.name)).length === 1;
            const hasTypeParam = params.filter(param => /t|[tT]ype/.test(param.name)).length === 1;
            const hasUnvaluedStatusParam = params.filter(param => /状態|s|[Ss]tatus/.test(param.name) && param.value === '').length === 1;

            const isOpen = (
                params.length === 1 && hasOnlyOneIntegerParam ||
                params.length === 2 && hasTypeParam && hasOnlyOneIntegerParam ||
                params.length === 2 && hasOnlyOneIntegerParam && hasUnvaluedStatusParam ||
                params.length === 3 && hasTypeParam && hasOnlyOneIntegerParam && hasUnvaluedStatusParam
            );

            return isUserAN && !isBotNo && isOpen;

        }
    });
    if (templates.length === 0) return log('Procedure cancelled: There\'s no UserAN to update.');

    // Initialize the 'UserAN' array of objects
    UserAN = templates.reduce((acc: UserANInfo[], obj) => {

        const params = obj.arguments
            .filter(param => { // Remove bot=, 状態=, and empty params
                const isBotParam = /bot/i.test(param.name);
                const isStatusParam = /状態|s|[Ss]tatus/.test(param.name);
                const isEmptyParam = !param.value;
                return !isBotParam && !isStatusParam && !isEmptyParam;
            });

        /**********************************************************************************************************\
            A full list of open UserANs' parameter combinations
                [(1=)username]
                [(1=)username, 状態=] => [(1=)username]
                [t=TYPE, (1=)username]
                [t=TYPE, (1=)username, 状態=] => [t=TYPE, (1=)username]
            Now we can differentiate these four in whether they have a t= param
        \***********************************************************************************************************/

        if (params.length > 2) return acc; // Contains an undefined parameter

        // Ensure that the UserAN has a 1= param, otherwise unprocessable
        let u;
        if ((u = params.filter(param => param.name === '1'))) {
            u = u[0].value;
        } else {
            return acc;
        }
        if (lib.isIPv6Address(u)) u = u.toUpperCase();

        // Get the type param
        let ttemp;
        const t = (ttemp = params.filter(param => /t|[tT]ype/.test(param.name))).length > 0 ? ttemp[0].value.toLowerCase() : 'user2';

        // Create the object to push into the array
        const info = {
            old: obj.text,
            new: '',
            modified: '',
            timestamp: '',
            section: '',
            user: '',
            type: t,
            logid: '',
            diffid: '',
            none: '',
            // The following gets a value if the user reported by the UserAN has been blocked
            domain: '', // Like partial block, global block, and global lock
            duration: '',
            flags: '',
            date: '',
            reblocked: ''
        };

        // Type-dependent modification
        switch (t) {
            case 'user2':
            case 'unl':
            case 'usernolink':
                info.user = u;
                if (lib.isIPAddress(u)) {
                    info.modified = `{{UserAN|t=IP2|${u}}}`;
                    info.type = 'ip2';
                }
                break;
            case 'ip2':
            case 'ipuser2':
                info.user = u;
                if (!lib.isIPAddress(u)) {
                    info.modified = `{{UserAN|${u}}}`;
                    info.type = 'user2';
                }
                break;
            case 'log':
            case 'logid':
                if (/^\d+$/.test(u)) info.logid = u; // Make sure that the user param is only of numerals
                break;
            case 'dif':
            case 'diff':
                if (/^\d+$/.test(u)) info.diffid = u;
                break;
            case 'none': // UserANs with this type param have a random string in the username param (the block status can't be checked)
                info.none = u;
                break;
            default: // Invalid type
                if (lib.isIPAddress(u)) {
                    info.user = u;
                    info.type = 'ip2';
                    info.modified = `{{UserAN|t=IP2|${u}}}`;
                }
        }

        // Get a timestamp for the UserAN
        const wktSp = lib.split2(wkt, info.old, true); // Split the source text at the template and find the first signature following it
        const sig = wktSp[1].match(/(\d{4})年(\d{1,2})月(\d{1,2})日 \(.{1}\) (\d{2}:\d{2}) \(UTC\)/); // YYYY年MM月DD日 (日) hh:mm (UTC)
        if (!sig) return acc;
        const ts = sig.map(el => el.padStart(2, '0')); // MM and DD may be of one digit but they need to be of two digits
        info.timestamp = `${ts[1]}-${ts[2]}-${ts[3]}T${ts[4]}:00Z`; // YYYY-MM-DDThh:mm:00Z (hh:mm is one capturing group)

        // Get a section title
        const wktSp2 = lib.split2(wkt, info.old);
        const headers = wktSp2[0].match(/={2,5}[^\S\r\n]*.+[^\S\r\n]*={2,5}/g); // Split the srctxt at tpl and get the last section header in arr[0]
        if (headers) info.section = headers[headers.length - 1].replace(/(^={2,5}[^\S\r\n]*|[^\S\r\n]*={2,5}$)/g, ''); // Remove '='s

        // Push the object into the array
        acc.push(info);
        return acc;

    }, []);
    UserAN = UserAN.filter(obj => obj.user || obj.logid || obj.diffid); // Remove UserANs that can't be forwarded to block check

    // Some functions to process logids and diffids

    // Function to evaluate whether a given logid's corresponding username is already in the list and not listed as unprocessable
    const isLogidAlreadyConverted = (logid: string): boolean => {
        return Logids.list.filter(obj => obj.logid === logid).length > 0 && !Logids.unprocessable.includes(logid);
    };
    // Function to extract logids that aren't paired with a username and haven't been forwarded to the API yet
    const collectLogids = () => {
        return UserAN
            .filter(obj => obj.logid && !obj.user && !isLogidAlreadyConverted(obj.logid))
            .map(obj => obj.logid)
            .filter((el, i, arr) => arr.indexOf(el) === i);
    };
    // Function to extract diffids that aren't paired with a username and haven't been forwarded to the API yet
    const isDiffidAlreadyConverted = (diffid: string): boolean => {
        return Diffids.list.filter(obj => obj.diffid === diffid).length > 0 && !Diffids.unprocessable.includes(diffid)
    };

    // Get an array of logids and diff numbers (these need to be converted to usernames through API requests before block check)
    let logids = collectLogids();
    const diffids = UserAN.filter(obj => obj.diffid && !obj.user && !isDiffidAlreadyConverted(obj.diffid)).map(obj => obj.diffid);

    // Convert logids and diffids to usernames through API queries
    let usernameQueries: Promise<void|string|null|undefined>[] = [queryAccountCreations(), queryEditDiffs(diffids)];
    await Promise.all(usernameQueries);
    UserAN.forEach(obj => { // Set the 'user' property of UserAN if possible
        let arr;
        if (obj.logid && !obj.user && (arr = Logids.list.filter(objL => objL.logid === obj.logid)).length > 0) obj.user = arr[0].username;
        if (obj.diffid && !obj.user && (arr = Diffids.list.filter(objD => objD.diffid === obj.diffid)).length > 0) obj.user = arr[0].username;
    });

    // Another attempt to convert logids
    logids = collectLogids();
    usernameQueries = [];
    logids.forEach(logid => {
        usernameQueries.push(
            scrapeUsernameFromLogid(logid).then(username => {
                if (typeof username === 'string') {
                    Logids.list.push({logid: logid, username: username});
                } else if (typeof username === 'undefined') {
                    Logids.unprocessable.push(logid);
                }
            })
        );
    });
    await Promise.all(usernameQueries);
    UserAN.forEach(obj => {
        let arr;
        if (obj.logid && !obj.user && (arr = Logids.list.filter(objL => objL.logid === obj.logid)).length > 0) obj.user = arr[0].username;
    });

    // Sort registered users and IPs
    let users = UserAN.filter(obj => obj.user).map(obj => obj.user).filter((el, i, arr) => arr.indexOf(el) === i);
    const ips = users.filter(username => lib.isIPAddress(username)); // An array of IPs
    users = users.filter(username => !lib.isIPAddress(username)); // An array of registered users

    // Check if the users and IPs in the arrays are locally blocked
    const blockQueries = [];
    const blockQueryParams: ApiParamsQueryBlocks = {
        action: 'query',
        list: 'blocks',
        bkprop: 'user|timestamp|expiry|restrictions|flags',
        formatversion: '2'
    };
    blockQueries.push( // Get domain/duration/date properties of UserAN if blocked
        lib.massRequest({...blockQueryParams, bklimit: 'max', bkusers: users, bkshow: pagetitle === ANS ? 'account|!temp' : ''}, 'bkusers'),
        lib.massRequest({...blockQueryParams, bkip: ips, bklimit: 1}, 'bkip', 1)
    );
    const blockQueryResult = await Promise.all(blockQueries); // Wait until all the async procedures finish
    const queryResultUsers: (ApiResponse|null)[] = blockQueryResult[0];
    const queryResultIps: (ApiResponse|null)[] = blockQueryResult[1];

    // Update the UserAN array for blocked registered users
    const resBlckUsers = queryResultUsers
        .filter(obj => obj && obj.query && obj.query.blocks)
        .map(obj => obj!.query!.blocks!)
        .flat();

    // Stores the names of registered users and IPs that need to be reblocked. This array will contain users that are currently blocked but reported
    // after that block. This can't be dealt with only by list=blocks because it returns the timestamp of the initial block and doesn't let us know
    // when a given reblock is applied.  
    const usersToBeReblocked: string[] = [];

    for (const blck of resBlckUsers) {
        const nousertalk = !blck.allowusertalk;
        const noemail = blck.noemail;
        const partial = blck.restrictions && !Array.isArray(blck.restrictions);
        const indef = blck.expiry === 'infinity';
        UserAN.filter(obj => obj.user === blck.user).forEach(obj => {
            const newlyReported = lib.compareTimestamps(obj.timestamp, blck.timestamp, true) >= 0;
            if (newlyReported) {
                obj.duration = indef ? '無期限' : lib.getDuration(blck.timestamp, blck.expiry)!;
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
                usersToBeReblocked.push(obj.user);
            }
        });
    }

    // Update the UserAN array for blocked IPs
    // It's a bit complicated here. IPs can be range-blocked but the API only returns the blocked IP itself, for example if 255.255.255.255 is
    // range-blocked by 255.255.255.0/24, the response only involves the range, not the queried IP. If we simply do a .filter().map().flat() to
    // concatenate res.query.blocks just as we do for registered users above, res.query.blocks that are empty arrays (meaning the relevant IP
    // isn't blocked) and those that are of the value null (meaning the Promise was rejected) are just gone, and there'll be no way to figure out
    // which element of the concatenated res.query.blocks array is for which IP. Below is a workaround for this. (One could prepare an independent
    // function and pass to it one IP for one API call alternatively, though.)
    const queriedIps: string[] = [];
    let resBlckIps: ApiResponseQueryListBlocks[] = [];
    for (let i = 0; i < queryResultIps.length; i++) {
        const res = queryResultIps[i];
        if (res && res.query && res.query.blocks && res.query.blocks.length !== 0) {
            queriedIps.push(ips[i]);
            resBlckIps = resBlckIps.concat(res.query.blocks);
        }
    }

    for (let i = 0; i < resBlckIps.length; i++) {
        const ip = queriedIps[i];
        const blck = resBlckIps[i];
        const nousertalk = !blck.allowusertalk;
        const noemail = blck.noemail;
        const hardblock = !blck.anononly;
        const partial = blck.restrictions && !Array.isArray(blck.restrictions);
        const indef = blck.expiry === 'infinity';
        const rangeblock = blck.user !== ip && blck.user.slice(-3) !== ip.slice(-3);
        UserAN.filter(obj => obj.user === ip).forEach(obj => {
            const newlyReported = lib.compareTimestamps(obj.timestamp, blck.timestamp, true) >= 0;
            if (newlyReported) {
                obj.duration = indef ? '無期限' : lib.getDuration(blck.timestamp, blck.expiry)!;
                if (rangeblock) obj.duration = blck.user.substring(blck.user.length - 3) + 'で' + obj.duration;
                obj.date = getBlockedDate(blck.timestamp);
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
                usersToBeReblocked.push(ip);
            }
        });
    }

    // Check for reblocked users and IPs
    const reblockQueryParams = {
        action: 'query',
        list: 'logevents',
        letype: 'block',
        letitle: usersToBeReblocked.map(name => `利用者:${name}`),
        formatversion: '2'
    };
    const reblockQueryResult = await lib.massRequest(reblockQueryParams, 'letitle', 1);

    for (let i = 0; i < reblockQueryResult.length; i++) {

        let resLgev: ApiResponseQueryListLogevents[];
        const res = reblockQueryResult[i];
        const username = usersToBeReblocked[i];
        if (!res || !res.query || !res.query.logevents || (resLgev = res.query.logevents).length === 0) continue;
        resLgev = resLgev.filter(obj => obj.action !== 'unblock'); // Remove irrelevant unblock logs

        // Get the latest block and reblocks (e.g. [reblock, reblock, block, reblock, block] => [reblock, reblock, block])
        let latestBlockIndex: number;
        for (let j = 0; j < resLgev.length; j++) {
            if (resLgev[j].action === 'block') {
                latestBlockIndex = j;
                break;
            }
        }
        resLgev = resLgev.slice(0, latestBlockIndex! + 1); // latestBlockIndex is never undefined because we're processing information about blocked users
        if (!resLgev.some(obj => obj.action === 'reblock')) continue; // Go on to the next loop if there's no reblock log

        // ---- At this point, resLgev has two or more block logs (the log of the initial block, that of a reblock, +α) ----

        // Shrink the resLgev array to two elements
        // [
        //      {...}, => Reblock log generated after the user was reported
        //      {...}  => Initial block log or an older reblock log generated at least 1 hour before the latest reblock
        // ]
        if (resLgev.length > 2) { // If reblocked multiple times
            // Get the element that's to be the second in the array (action=block, or action=reblock applied more than 1 hour before the latest reblock)
            const base = resLgev.find((obj, i, arr) => {
                return obj.action === 'block' || lib.compareTimestamps(obj.timestamp!, arr[0].timestamp!) > 1*60*60*1000
            });
            const latest = resLgev[0];
            resLgev = [latest, base!];
        }

        // Clean up some properties
        resLgev.forEach(obj => {

            if (!obj.params) obj.params = {};
            if (!obj.params.flags) obj.params.flags = [];

            // Make sure that both elements have a 'expiry' property (the prop is undefined in the case of indefinite block)
            if (obj.params.duration === 'infinity' && !obj.params.expiry) obj.params.expiry = 'infinity';

            // Remove 'nocreate' and 'noautoblock' because they're irrelevant
            let elementIdx;
            if ((elementIdx = obj.params.flags.indexOf('nocreate')) !== -1) obj.params.flags.splice(elementIdx, 1);
            if ((elementIdx = obj.params.flags.indexOf('noautoblock')) !== -1) obj.params.flags.splice(elementIdx, 1);

            // If the user is an IP, change 'anononly' to 'hardblock'
            if (lib.isIPAddress(username)) {
                if ((elementIdx = obj.params.flags.indexOf('anononly')) !== -1) {
                    obj.params.flags.splice(elementIdx, 1);
                } else {
                    obj.params.flags.unshift('hardblock');
                }
            }

        });

        // Get what's changed
        const latestBlock = resLgev[0];
        const olderBlock = resLgev[1];

        // Domain
        let domain = '';
        if (olderBlock.params!.sitewide && latestBlock.params!.sitewide) {
            // Do nothing
        } else if (olderBlock.params!.sitewide && !latestBlock.params!.sitewide) {
            domain = '部分ブロック';
        } else if (!olderBlock.params!.sitewide && latestBlock.params!.sitewide) {
            domain = 'サイト全体';
        } else { // !olderBlock.params.sitewide && !latestBlock.params.sitewide
            if (JSON.stringify(olderBlock.params!.restrictions) === JSON.stringify(latestBlock.params!.restrictions)) {
                // Do nothing
            } else {
                domain = '部分ブロック条件変更';
            }
        }

        // Duration (if changed, substitute the 'duration' variable with the new expiry)
        let duration = '';
        if (olderBlock.params!.expiry! !== latestBlock.params!.expiry!) duration = latestBlock.params!.expiry!;

        // Flags
        let flags: string|string[];
        if (!lib.arraysEqual(olderBlock.params!.flags!, latestBlock.params!.flags!, true)) {

            const translate = (str: string, removed: boolean): string => {
                switch (str) {
                    case 'hardblock':
                        return removed ? 'ソフトブロック' : 'ハードブロック';
                    case 'noemail':
                        return 'メール' + (removed ? '〇' : '×');
                    case 'nousertalk':
                        return '会話' + (removed ? '〇' : '×');
                    default:
                        log('translate() encountered an unrecognized value of ' + str + '.');
                        return '';
                }
            };

            if (olderBlock.params!.flags!.length > latestBlock.params!.flags!.length) { // Flags removed
                flags = olderBlock.params!.flags!.filter(el => !latestBlock.params!.flags!.includes(el));
                flags = flags.map(el => translate(el, true));
            } else { // Flags added
                flags = latestBlock.params!.flags!.filter(el => !olderBlock.params!.flags!.includes(el));
                flags = flags.map(el => translate(el, false));
            }
            if (flags.includes('')) continue;
            flags = flags.join('・');

        }

        // Set properties of the UserAN array
        UserAN.filter(obj => obj.user === username).forEach(obj => {
            const newlyReported = lib.compareTimestamps(obj.timestamp, latestBlock.timestamp!, true) >= 0;
            if (newlyReported) {
                obj.domain = domain;
                obj.duration = duration === 'infinity' ? '無期限' : duration ? lib.getDuration(latestBlock.timestamp!, duration)! : duration;
                if (domain) obj.duration = ' ' + obj.duration;
                obj.flags = (domain || duration ? ' ' : '') + flags;
                obj.date = getBlockedDate(latestBlock.timestamp);
                obj.reblocked = '条件変更';
            }
        });

    }

    // Check if the users and IPs in the arrays are globally (b)locked
    if (checkGlobal) {

        // Only check users that aren't locally blocked
        let gUsers = UserAN.filter(obj => obj.user && !obj.date).map(obj => obj.user).filter((el, i, arr) => arr.indexOf(el) === i);
        const gIps = gUsers.filter(username => lib.isIPAddress(username));
        gUsers = gUsers.filter(username => !lib.isIPAddress(username));

        const globalStatusQueries = [];
        const globalStatusQueryParamUsers = {
            action: 'query',
            list: 'globalallusers',
            agufrom: gUsers,
            aguto: gUsers,
            aguprop: 'lockinfo',
            agulimit: 1,
            formatversion: '2'
        };
        const globalStatusQueryParamIps = {
            action: 'query',
            list: 'globalblocks',
            bgip: gIps,
            bgprop: 'address|expiry|timestamp',
            bglimit: 1,
            formatversion: '2'
        };
        globalStatusQueries.push(
            lib.massRequest(globalStatusQueryParamUsers, ['agufrom', 'aguto'], 1),
            lib.massRequest(globalStatusQueryParamIps, 'bgip', 1)
        );
        const globalStatusQueryResult = await Promise.all(globalStatusQueries);
        const globalStatusResponseUsers = globalStatusQueryResult[0];
        const globalStatusResponseIps = globalStatusQueryResult[1];

        const resGLock = globalStatusResponseUsers
            .filter(obj => obj && obj.query && obj.query.globalallusers)
            .map(obj => obj!.query!.globalallusers)
            .flat();
        const globallyLockedUseres = resGLock
            .filter(obj => obj && obj.locked === '')
            .map(obj => obj!.name);
        const lockedDate = getBlockedDate();
        globallyLockedUseres.forEach(lockedUser => {
            UserAN.filter(obj => obj.user === lockedUser).forEach(obj => {
                obj.domain = 'グローバルロック';
                obj.date = lockedDate;
            });
        });

        const gQueriedIps: string[] = [];
        let resGBlock: ApiResponseQueryListGlobalblocks[] = [];
        for (let i = 0; i < queryResultIps.length; i++) {
            const res = globalStatusResponseIps[i];
            if (res && res.query && res.query.globalblocks && res.query.globalblocks.length !== 0) {
                gQueriedIps.push(gIps[i]);
                resGBlock = resGBlock.concat(res.query.globalblocks);
            }
        }

        for (let i = 0; i < resGBlock.length; i++) {
            const ip = gQueriedIps[i];
            const gBlck = resGBlock[i];
            const indef = (gBlck.expiry === 'infinity');
            UserAN.filter(obj => obj.user === ip).forEach(obj => {
                const newlyReported = lib.compareTimestamps(obj.timestamp, gBlck.timestamp, true) >= 0;
                if (newlyReported) {
                    obj.duration = indef ? '無期限' : lib.getDuration(gBlck.timestamp, gBlck.expiry)!;
                    obj.date = getBlockedDate(gBlck.timestamp);
                    obj.domain = 'グローバルブロック ';
                }
            });
        }
        
    }

    // --- Note: UserANs to mark up all have a 'date' property at this point ---

    // Final check before edit
    let modOnly = false; // True if no user is newly blocked but some UserANs need to be modified
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
        return log('Procedure cancelled: There\'s no UserAN to update.');
    }

    // Get summary
    let summary = 'Bot:';
    if (!modOnly) {

        /** Creates a contribs link from an object that is an element of the 'UserAN' array. */
        const getUserLink = (obj: UserANInfo) => {
            const condition = obj.reblocked || obj.domain + obj.duration;
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
                return `[[特別:差分/${obj.diffid}|差分/${obj.diffid}]]の投稿者 (${condition})`;
            }
        };

        // Filter out objects that are elements of the UserAN array and create a new object with its keys named after each section title.
        interface ReportsBySection {
            /** The array set as the object's properties only contains UserANs that need to be updated. */
            [sectiontitle: string]: UserANInfo[]
        }
        const reportsBySection: ReportsBySection = UserAN
            .filter(obj => obj.new && obj.date) // Filter out UserANs that need to be marked up
            .reduce((acc, obj) => {
                if (!acc[obj.section]) acc[obj.section] = []; // Create key and set an empty array as its value
                // Push the current object only if the array doesn't contain an object whose 'user' property is the same as the current object's
                //  'user' property. This prevents the output from having multiple occurrences of the same username. (One user could be reported
                // multiple times in one section.)
                if (acc[obj.section].every((obj2: UserANInfo) => obj2.user !== obj.user)) {
                    acc[obj.section].push({...obj});
                }
                return acc;
            }, Object.create(null));

        for (const sectiontitle in reportsBySection) { // Loop through all keys of the created object (i.e. section titles)

            // Loop through the elements of the array that is the property of the corresponding key until the loop returns false
            const bool = reportsBySection[sectiontitle].every(obj => {
                const userlink = getUserLink(obj)!;
                if (summary.includes(userlink)) return true; // Do nothing if the summary already has a link for the relevant user
                const sectionLink = ` /*${sectiontitle}*/`;
                let sectionLinkAdded = false;
                if (!summary.includes(sectionLink)) {
                    summary += sectionLink;
                    sectionLinkAdded = true;
                }
                const tempSummary = (sectionLinkAdded ? '' : ', ') + userlink;
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
        summary += ' UserANの修正';
    }

    // Get the latest revision again because the procedure above can take a while to finish
    lr = await lib.getLatestRevision(pagetitle);
    if (!lr) return log('Failed to get the latest revision.');
    let newContent = lr.content;

    // Update UserANs in the source text
    UserAN.filter(obj => obj.new).forEach(obj => newContent = newContent.split(obj.old).join(obj.new));

    // Edit the page
    const editParams: ApiParamsEditPage = {
        title: pagetitle,
        text: newContent,
        summary: summary,
        minor: true,
        basetimestamp: lr.basetimestamp,
        starttimestamp: lr.curtimestamp,
    };
    if (modOnly) editParams.bot = true;
    lib.edit(editParams);

}

//********************** UTILITY FUNCTIONS **********************/

/** Query the API and update Logids.list. */
async function queryAccountCreations() {

    const params: ApiParamsQueryLogEvents = {
        action: 'query',
        list: 'logevents',
        leprop: 'ids|title|timestamp',
        letype: 'newusers',
        lelimit: 'max',
        formatversion: '2'
    };
    if (Logids.lookUntil) Object.assign(params, {leend: Logids.lookUntil});

    const response: ApiResponse[] = await lib.continuedRequest(params);
    const resLgev = response
        .filter((obj) => {
            return obj && obj.query && obj.query.logevents;
        }).map(obj => {
            return obj.query && obj.query.logevents;
        }).flat();
    if (resLgev[0] && resLgev[0].timestamp) Logids.lookUntil = resLgev[0].timestamp;

    let list = resLgev.filter((obj): obj is ApiResponseQueryListLogevents => typeof obj === 'object').filter((obj) => obj && obj.title).map(({logid, title}) => {
        return {
            logid: logid!.toString(),
            username: title!.replace(/^利用者:/, '')
        };
    });
    list = list.filter(obj => !Logids.list.some(({logid}) => obj.logid === logid)); // Filter out log entries that are not in Logids.list

    Logids.list = list.concat(Logids.list);

}

/** Query the API and update Diffids.list. */
async function queryEditDiffs(diffIdsArr: string[]) {

    const params = {
        action: 'query',
        revids: diffIdsArr,
        prop: 'revisions',
        formatversion: '2'
    };
    let response: (ApiResponse|null)[] = await lib.massRequest(params, 'revids');
    response = response.filter((obj) => obj && obj.query); // Remove null elements from the result

    const diffidUsernameList = response
        .filter(obj => obj && obj.query && obj.query.pages)
        .map(obj => obj!.query!.pages!)
        .flat()
        .filter(obj => obj && obj.revisions)
        .map(obj => obj.revisions!)
        .flat()
        .filter(({revid}) => !Diffids.list.some(({diffid}) => revid.toString() === diffid))
        .map(({revid, user}) => ({diffid: revid.toString(), username: user}));
    Diffids.list = Diffids.list.concat(diffidUsernameList);

    const badRevids = response
        .filter(obj => obj && obj.query && obj.query.badrevids)
        .map(obj => obj!.query!.badrevids)
        .flat()
        .filter(obj => obj)
        .map(obj => Object.keys(obj!).map(key => key))
        .flat();
    Diffids.unprocessable = Diffids.unprocessable.concat(badRevids).filter((el, i, arr) => arr.indexOf(el) === i);

}

/** Get a username from an account creation logid by scraping [[Special:Log/newusers]]. */
async function scrapeUsernameFromLogid(logid: string|number): Promise<string|undefined> {

    const url = 'https://ja.wikipedia.org/w/index.php?title=%E7%89%B9%E5%88%A5:%E3%83%AD%E3%82%B0&logid=' + logid;
    const $ = await lib.scrapeWebpage(url);
    if (!$) return;

    let $newusers = $('.mw-logline-newusers');
    if ($newusers.length === 0) return;
    $newusers = $newusers.eq(0);

    let username;
    switch($newusers.attr('data-mw-logaction')) {
        case 'newusers/create':
        case 'newusers/autocreate':
        case 'newusers/create2': // Created by an existing user
        case 'newusers/byemail': // Created by an existing user and password sent off
            username = $newusers.children('a.mw-userlink').eq(0).text();
            break;
        case 'newusers/forcecreatelocal':
            username = $newusers.children('a').last().text().replace(/^利用者:/, '');
            break;
        default:
    }

    return username;

}

/** Get ' (MM/DD)' from a JSON timestamp or the current time. */
function getBlockedDate(timestamp?: string): string {
    const d = timestamp ? new Date(timestamp) : new Date();
    d.setHours(d.getHours() + 9);
    return ` (${d.getMonth() + 1}/${d.getDate()})`;
}

/** Check whether a string contains a Japanese character. */
function containsJapaneseCharacter(str: string): boolean {
    return str.match(/[\u30a0-\u30ff\u3040-\u309f\u3005-\u3006\u30e0-\u9fcf]+/) ? true : false;
}