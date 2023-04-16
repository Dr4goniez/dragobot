import {
    ApiResponse,
    ApiParamsQueryLogEvents,
    ApiResponseQueryListLogevents,
    ApiResponseQueryListBlocks,
    ApiParamsQueryBlocks,
    ApiResponseQueryListGlobalallusers,
    ApiResponseQueryListGlobalblocks,
    ApiParamsEditPage
} from '.';
import * as lib from './lib';
import { log } from './server';

//********************** MAIN FUNCTION **********************/

interface UserANInfo {
    old: string;
    new: string;
    modified: string;
    timestamp: string;
    section: string;
    user: string;
    type: string;
    logid: string;
    diffid: string;
    none: string;
    domain: string;
    duration: string;
    flags: string;
    date: string;
    reblocked: string;
}
let UserAN: UserANInfo[];

interface IdList {
    [id: string]: string;
}

interface LogidList {
    /** An object of logid-username pairs.  */
    list: IdList;
    /** An array of logids that can't be converted to a username either by API query or by web scraping. */
    unprocessable: string[];
    /** JSON timestamp passed to the API as a list=logevents query parameter (leend). Look only for log entries newer than this timestamp. */
    lookUntil: string;
}
const Logids: LogidList = {
    list: {},
    unprocessable: [],
    lookUntil: ''
};

interface DiffidList {
    /** An object of diffid-username pairs.  */
    list: IdList;
    /** An array of diffids that can't be converted to a username. */
    unprocessable: string[];
}
const Diffids: DiffidList = {
    list: {},
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

            /*/********************************************************************************************************\
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

            const isUserAN = template.name === 'UserAN';
            let isBotNo = false,
                hasTypeParam = false,
                hasUnvaluedStatusParam = false;
            let integerParamCount = 0;
            const params = template.arguments.filter(({text, name, value}) => {
                if (!text) return false; // Remove empty parameters
                if (!isBotNo) isBotNo = /^bot$/i.test(name) && /^no$/i.test(value);
                if (!hasTypeParam) hasTypeParam = /^(t|[tT]ype)$/.test(name);
                if (!hasUnvaluedStatusParam) hasUnvaluedStatusParam = /^(状態|s|[sS]tatus)$/.test(name) && value === '';
                if (/^\d+$/.test(name)) integerParamCount++;
                return true;
            });
            const hasOnlyOneIntegerParam = integerParamCount === 1;

            const isOpen = (
                params.length === 1 && hasOnlyOneIntegerParam ||
                params.length === 2 && hasTypeParam && hasOnlyOneIntegerParam ||
                params.length === 2 && hasOnlyOneIntegerParam && hasUnvaluedStatusParam ||
                params.length === 3 && hasTypeParam && hasOnlyOneIntegerParam && hasUnvaluedStatusParam
            );

            return isUserAN && !isBotNo && isOpen;

        }
    });
    if (!templates.length) return log('Procedure cancelled: There\'s no UserAN to update.');

    // Initialize the 'UserAN' array of objects
    UserAN = templates.reduce((acc: UserANInfo[], obj) => {

        /*/********************************************************************************************************\
            A full list of open UserANs' parameter combinations
                [(1=)username]
                [(1=)username, 状態=] => [(1=)username]
                [t=TYPE, (1=)username]
                [t=TYPE, (1=)username, 状態=] => [t=TYPE, (1=)username]
            Now we can differentiate these four in whether they have a t= param
        \***********************************************************************************************************/

        let param1: lib.TemplateArgument|undefined,
            paramType: lib.TemplateArgument|undefined;
        const params = obj.arguments.filter((param) => { // Remove bot=, 状態=, and empty params
            const isBotParam = /^bot$/i.test(param.name);
            const isStatusParam = /^(状態|s|[sS]tatus)$/.test(param.name);
            const isEmptyParam = !param.value;
            if (!param1 && /^(1|[uU]ser)$/.test(param.name)) param1 = param;
            if (!paramType && /^(t|[tT]ype)$/.test(param.name)) paramType = param;
            return !isBotParam && !isStatusParam && !isEmptyParam;
        });

        if (params.length > 2) return acc; // Contains an undefined parameter

        // Ensure that the UserAN has a 1= param, otherwise unprocessable
        if (!param1) return acc;
        const u = lib.isIPv6Address(param1.value) ? param1.value.toUpperCase() : param1.value;

        // Get the type param
        const t = paramType ? paramType.value.toLowerCase() : 'user2';

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
                if (lib.isIPAddress(u)) {
                    info.user = u;
                    info.type = 'ip2';
                    info.modified = `{{UserAN|t=IP2|${u}}}`;
                } else {
                    info.none = u;
                }
                break;
            default: // Invalid type
                if (lib.isIPAddress(u)) {
                    info.user = u;
                    info.type = 'ip2';
                    info.modified = `{{UserAN|t=IP2|${u}}}`;
                }
        }

        // Remove UserANs that can't be forwarded to block check
        if (!info.user && !info.logid && !info.diffid) return acc;

        // Get a timestamp for the UserAN
        const wktSp = lib.split2(wkt, info.old, true); // Split the source text at the template and find the first signature following it
        const sig = wktSp[1].match(/(\d{4})年(\d{1,2})月(\d{1,2})日 \(.{1}\) (\d{2}:\d{2}) \(UTC\)/); // YYYY年MM月DD日 (日) hh:mm (UTC)
        if (!sig) return acc;
        const ts = sig.map(el => el.padStart(2, '0')); // MM and DD may be of one digit but they need to be of two digits
        info.timestamp = `${ts[1]}-${ts[2]}-${ts[3]}T${ts[4]}:00Z`; // YYYY-MM-DDThh:mm:00Z (hh:mm is one capturing group)

        // Get a section title
        const wktSp2 = lib.split2(wkt, info.old); // Split the srctxt at the template
        const headingRegex = /={2,5}[^\S\r\n]*(.+?)[^\S\r\n]*={2,5}/g;
        let m;
        while ((m = headingRegex.exec(wktSp2[0]))) {
            info.section = m[1]; // Get the last section header in wktSp2[0]
        }

        // Push the object into the array
        acc.push(info);
        return acc;

    }, []);

    /** Function to evaluate whether a given logid/diffid's corresponding username is already in the list and not listed as unprocessable. */
    const isIdAlreadyConverted = (id: string, idType: "logid"|"diffid"): boolean => {
        const ListObj = idType === 'logid' ? Logids : Diffids;
        return !!ListObj.list[id] && !ListObj.unprocessable.includes(id);
    };

    /** Function to extract logids/diffids that aren't paired with a username and haven't been forwarded to the API yet. */
    const collectIds = (idType: "logid"|"diffid") => {
        return UserAN.reduce((acc: string[], obj) => {
            const id = obj[idType];
            if (id && !obj.user && !isIdAlreadyConverted(id, idType)) {
                if (!acc.includes(id)) acc.push(id);
            }
            return acc;
        }, []);
    };

    // Get an array of logids and diff numbers (these need to be converted to usernames through API requests before block check)
    let logids = collectIds('logid');
    const diffids = collectIds('diffid');

    // Convert logids and diffids to usernames through API queries
    let usernameQueries: Promise<void|string|null|undefined>[] = [queryAccountCreations(), queryEditDiffs(diffids)];
    await Promise.all(usernameQueries);
    UserAN.forEach(obj => { // Set the 'user' property of UserAN if possible
        if (!obj.user) {
            if (obj.logid && Logids.list[obj.logid]) obj.user = Logids.list[obj.logid];
            if (obj.diffid && Diffids.list[obj.diffid]) obj.user = Diffids.list[obj.diffid];
        }
    });

    // Another attempt to convert logids
    logids = collectIds('logid');
    usernameQueries = [];
    logids.forEach(logid => {
        usernameQueries.push(
            scrapeUsernameFromLogid(logid).then(username => {
                if (typeof username === 'string') {
                    Logids.list[logid] = username;
                } else {
                    Logids.unprocessable.push(logid);
                }
            })
        );
    });
    await Promise.all(usernameQueries);
    UserAN.forEach(obj => {
        if (obj.logid && !obj.user && Logids.list[obj.logid]) obj.user = Logids.list[obj.logid];
    });

    // Sort registered users and IPs
    const users: string[] = [];
    const ips: string[] = [];
    UserAN.forEach(({user}) => {
        if (!user) {
            return;
        } else if (lib.isIPAddress(user)) {
            if (!ips.includes(user)) ips.push(user);
        } else {
            if (!users.includes(user)) users.push(user);
        }
    });
    if (!users.length && !ips.length) return log('Procedure cancelled: There\'s no UserAN to update.');

    /** An array of the names of users and IPs that need to be reblocked, prefixed by '利用者:'. */
    const usersToBeReblocked: string[] = [];

    const localBlockStatusQueryUsers = async (usersArr: string[]) => {

        if (!usersArr.length) return;

        const params: ApiParamsQueryBlocks = {
            action: 'query',
            list: 'blocks',
            bkprop: 'user|timestamp|expiry|restrictions|flags',
            bklimit: 'max',
            bkusers: usersArr,
            bkshow: pagetitle === ANS ? 'account|!temp' : '',
            formatversion: '2'
        };
        const response = await lib.massRequest(params, 'bkusers');

        response.forEach((res) => {

            let resBlck: ApiResponseQueryListBlocks[]|undefined;
            if (!res || !res.query || !(resBlck = res.query.blocks) || !resBlck.length) return;

            for (const blck of resBlck) {
                const nousertalk = !blck.allowusertalk;
                const noemail = blck.noemail;
                const partial = blck.restrictions && !Array.isArray(blck.restrictions);
                const indef = blck.expiry === 'infinity';
                UserAN.forEach(obj => {
                    if (obj.user !== blck.user) return;
                    const newlyReported = lib.compareTimestamps(obj.timestamp, blck.timestamp, true) >= 0;
                    if (newlyReported) {
                        obj.duration = indef ? '無期限' : lib.getDuration(blck.timestamp, blck.expiry)!;
                        obj.date = getBlockedDate(blck.timestamp);
                        obj.domain = partial ? '部分ブロック' : '';
                        const flags: string[] = [];
                        if (nousertalk) flags.push('会話×');
                        if (noemail) flags.push('メール×');
                        obj.flags = flags.join('・');
                    } else {
                        usersToBeReblocked.push(`利用者:${obj.user}`);
                    }
                });
            }

        });

    };

    const localBlockStatusQueryIps = async (ipsArr: string[]) => {

        if (!ipsArr.length) return;

        const params = {
            action: 'query',
            list: 'blocks',
            bkprop: 'user|timestamp|expiry|restrictions|flags',
            bklimit: 1,
            bkip: ips,
            formatversion: '2'
        };
        const response = await lib.massRequest(params, 'bkip', 1);

        response.forEach((res, i) => {

            let resBlck: ApiResponseQueryListBlocks[]|undefined;
            if (!res || !res.query || !(resBlck = res.query.blocks) || !resBlck.length) return;
            const blck = resBlck[0];

            const ip = ipsArr[i];
            const nousertalk = !blck.allowusertalk;
            const noemail = blck.noemail;
            const hardblock = !blck.anononly;
            const partial = blck.restrictions && !Array.isArray(blck.restrictions);
            const indef = blck.expiry === 'infinity';
            const rangeblock = blck.user !== ip && blck.user.slice(-3) !== ip.slice(-3);
            UserAN.forEach(obj => {
                if (obj.user !== ip) return;
                const newlyReported = lib.compareTimestamps(obj.timestamp, blck.timestamp, true) >= 0;
                if (newlyReported) {
                    obj.duration = indef ? '無期限' : lib.getDuration(blck.timestamp, blck.expiry)!;
                    if (rangeblock) obj.duration = blck.user.substring(blck.user.length - 3) + 'で' + obj.duration;
                    obj.date = getBlockedDate(blck.timestamp);
                    obj.domain = partial ? '部分ブロック' : '';
                    const flags: string[] = [];
                    if (nousertalk) flags.push('会話×');
                    if (noemail) flags.push('メール×');
                    if (hardblock) flags.push('ハードブロック');
                    obj.flags = flags.join('・');
                } else {
                    usersToBeReblocked.push(`利用者:${ip}`);
                }
            });

        });
    };

    // Check if the users and IPs in the arrays are locally blocked
    const blockQueries = [localBlockStatusQueryUsers(users), localBlockStatusQueryIps(ips)];
    await Promise.all(blockQueries); // Get domain/duration/date properties of UserAN if blocked

    /**
     * @param usersArr Each element must be prefixed by '利用者:'.
     */
    const reblockStatusQuery = async (usersArr: string[]) => {

        if (!usersArr.length) return;

        const params = {
            action: 'query',
            list: 'logevents',
            letype: 'block',
            letitle: usersArr,
            formatversion: '2'
        };
        const response = await lib.massRequest(params, 'letitle', 1);

        const cleanupBlockLog = (obj: ApiResponseQueryListLogevents, username: string) => {

            if (!obj.params) obj.params = {};
            if (!obj.params.flags) obj.params.flags = [];

            // Make sure that both elements have a 'expiry' property (the prop is undefined in the case of indefinite block)
            if (obj.params.duration === 'infinity' && !obj.params.expiry) obj.params.expiry = 'infinity';

            // Remove 'nocreate' and 'noautoblock' because they're irrelevant
            let elementIdx: number;
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

        };

        response.forEach((res, i) => {

            let resLgev: ApiResponseQueryListLogevents[]|undefined;
            if (!res || !res.query || !(resLgev = res.query.logevents) || !resLgev.length) return;
            const username = usersArr[i].replace(/^利用者:/, '');

            // Shrink the resLgev array to two elements
            // [
            //      {...}, => Latest block/reblock log
            //      {...}  => Initial block log or an older reblock log generated at least 30 minutes before the latest reblock
            // ]
            let latestBlockTs = '';
            let initialBlockFetched = false;
            resLgev = resLgev.filter((obj) => {

                if (!obj.action || !obj.timestamp) return false;

                if (['block', 'reblock'].includes(obj.action)) {
                    if (obj.action === 'reblock' && !latestBlockTs) {
                        latestBlockTs = obj.timestamp;
                        cleanupBlockLog(obj, username);
                        return true;
                    } else if (!initialBlockFetched && lib.compareTimestamps(obj.timestamp, latestBlockTs) > 30*60*1000) {
                        initialBlockFetched = true;
                        cleanupBlockLog(obj, username);
                        return true;
                    } else {
                        return false;
                    }
                } else {
                    return false;
                }

            });
            if (resLgev.length !== 2 || !latestBlockTs || !initialBlockFetched) return;

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
            } else {
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
            const flags: string[] = [];
            const diff = lib.arrayDiff(olderBlock.params!.flags!, latestBlock.params!.flags!);
            if (diff.added.length || diff.removed.length) {

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

                [diff.added, diff.removed].forEach((arr, j) => {
                    const removed = j === 1;
                    arr.forEach((el) => {
                        if (typeof el === 'string') {
                            flags.push(translate(el, removed));
                        }
                    });
                });

            }

            // Set properties of the UserAN array
            UserAN.forEach((obj) => {
                if (obj.user !== username) return;
                const newlyReported = lib.compareTimestamps(obj.timestamp, latestBlock.timestamp!, true) >= 0;
                if (newlyReported) {
                    obj.domain = domain;
                    obj.duration = duration === 'infinity' ? '無期限' : duration ? lib.getDuration(latestBlock.timestamp!, duration)! : duration;
                    obj.flags = flags.join('・');
                    obj.date = getBlockedDate(latestBlock.timestamp!);
                    obj.reblocked = '条件変更';
                }
            });

        });
    };
    await reblockStatusQuery(usersToBeReblocked);

    // Check if the users and IPs in the arrays are globally (b)locked
    if (checkGlobal) {

        // Only check users that aren't locally blocked
        const gUsers: string[] = [];
        const gIps: string[] = [];
        UserAN.forEach(({user, date}) => {
            if (!user || date) { // Updated UserANs have a nonempty 'date' property
                return;
            } else if (lib.isIPAddress(user)) {
                if (!gIps.includes(user)) gIps.push(user);
            } else {
                if (!gUsers.includes(user)) gUsers.push(user);
            }
        });

        const globalLockStatusQuery = async (usersArr: string[]) => {

            if (!usersArr.length) return;

            const params = {
                action: 'query',
                list: 'globalallusers',
                agufrom: usersArr,
                aguto: usersArr,
                aguprop: 'lockinfo',
                agulimit: 1,
                formatversion: '2'
            };
            const response = await lib.massRequest(params, ['agufrom', 'aguto'], 1);

            const lockedUsers = response.reduce((acc: string[], res, i) => {
                let resLck: ApiResponseQueryListGlobalallusers[]|undefined;
                if (!res || !res.query || !(resLck = res.query.globalallusers) || !resLck.length) return acc;
                const username = usersArr[i];
                if (resLck[0].locked === '' && !acc.includes(username)) {
                    acc.push(username);
                }
                return acc;
            }, []);

            const lockedDate = getBlockedDate();
            UserAN.forEach((obj) => {
                if (obj.date || !lockedUsers.includes(obj.user)) return;
                obj.domain = 'グローバルロック';
                obj.date = lockedDate;
            });

        };

        const globalBlockStatusQuery = async (ipsArr: string[]) => {

            if (!ipsArr.length) return;

            const params = {
                action: 'query',
                list: 'globalblocks',
                bgip: ipsArr,
                bgprop: 'address|expiry|timestamp',
                bglimit: 1,
                formatversion: '2'
            };
            const response = await lib.massRequest(params, 'bgip', 1);

            response.forEach((res, i) => {

                let resGBlck: ApiResponseQueryListGlobalblocks[]|undefined;
                if (!res || !res.query || !(resGBlck = res.query.globalblocks) || !resGBlck.length) return;

                const ip = ipsArr[i];
                const gBlck = resGBlck[0];
                const indef = (gBlck.expiry === 'infinity');
                UserAN.forEach((obj) => {
                    if (obj.date || obj.user !== ip) return;
                    const newlyReported = lib.compareTimestamps(obj.timestamp, gBlck.timestamp, true) >= 0;
                    if (newlyReported) {
                        obj.duration = indef ? '無期限' : lib.getDuration(gBlck.timestamp, gBlck.expiry)!;
                        obj.date = getBlockedDate(gBlck.timestamp);
                        obj.domain = 'グローバルブロック';
                    }
                });

            });

        };

        const globalStatusQueries = [globalLockStatusQuery(gUsers), globalBlockStatusQuery(gIps)];
        await Promise.all(globalStatusQueries);

    }

    // --- Note: UserANs to mark up all have a 'date' property at this point ---

    // Final check before edit
    let newlyBlocked = false;
    let newlyModified = false;
    let modOnly = false; // True if no user is newly blocked but some UserANs need to be modified
    UserAN.forEach((obj) => {
        if (!newlyBlocked) newlyBlocked = !!obj.date;
        if (!newlyModified) newlyModified = !!obj.modified;
        if (obj.date) {
            const display = [obj.domain + obj.duration, obj.flags, obj.date].filter(el => el);
            obj.new = (obj.modified || obj.old).replace(/\|*\}{2}$/, '') + '|' + display.join(' ') + '}}';
        } else if (obj.modified) {
            obj.new = obj.modified;
        }
    });
    if (!newlyBlocked && !newlyModified) {
        return log('Procedure cancelled: There\'s no UserAN to update.');
    } else if (!newlyBlocked) {
        modOnly = true;
    }

    // Get summary
    let summary = 'Bot:';
    if (!modOnly) {

        /** Creates a contribs link from an object that is an element of the 'UserAN' array. */
        const getUserLink = (obj: UserANInfo) => {
            const condition = obj.reblocked || obj.domain + obj.duration;
            if (/^(?:user2|unl|usernolink)$/.test(obj.type)) {
                const maxLetterCnt = containsJapaneseCharacter(obj.user) ? 10 : 20;
                if (obj.user.length > maxLetterCnt) {
                    return `${obj.user.substring(0, maxLetterCnt)}.. (${condition})`;
                } else {
                    return `[[特別:投稿記録/${obj.user}|${obj.user}]] (${condition})`;
                }
            } else if (/^ip(user)?2$/.test(obj.type)) {
                return `[[特別:投稿記録/${obj.user}|${obj.user}]] (${condition})`;
            } else if (/^log(id)?$/.test(obj.type)) {
                return `[[特別:転送/logid/${obj.logid}|Logid/${obj.logid}]] (${condition})`;
            } else if (/^diff?$/.test(obj.type)) {
                return `[[特別:差分/${obj.diffid}|差分/${obj.diffid}]]の投稿者 (${condition})`;
            }
        };

        // Filter out objects that are elements of the UserAN array and create a new object with its keys named after each section title.
        interface ReportsBySection {
            /** The array set as the object's properties only contains UserANs that need to be updated. */
            [sectiontitle: string]: UserANInfo[];
        }
        const reportsBySection: ReportsBySection = UserAN.reduce((acc: ReportsBySection, obj) => {

            if (!obj.new || !obj.date) return acc; // Filter out UserANs that need to be marked up
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
    UserAN.forEach((obj) => {
        if (!obj.new) return;
        newContent = newContent.split(obj.old).join(obj.new);
    });

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
    await lib.edit(editParams);

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

    let ts = '';
    const list = response.reduce((acc: IdList, obj) => {
        let resLgev: ApiResponseQueryListLogevents[]|undefined;
        if (obj && obj.query && (resLgev = obj.query.logevents)) {
            const innerList = resLgev.reduce((accLg: IdList, objLg) => {
                if (!ts && objLg.timestamp) ts = objLg.timestamp;
                if (objLg.logid !== undefined && objLg.title) {
                    accLg[objLg.logid.toString()] = objLg.title.replace(/^利用者:/, '');
                }
                return accLg;
            }, Object.create(null));
            Object.assign(acc, innerList);
        }
        return acc;
    }, Object.create(null));

    if (ts) Logids.lookUntil = ts;
    Object.assign(Logids.list, list);

}

/** Query the API and update Diffids.list. */
async function queryEditDiffs(diffIdsArr: string[]) {

    const params = {
        action: 'query',
        revids: diffIdsArr,
        prop: 'revisions',
        rvprop: 'ids|user',
        formatversion: '2'
    };
    const response: (ApiResponse|null)[] = await lib.massRequest(params, 'revids');

    const list = response.reduce((acc: IdList, obj) => {
        if (obj && obj.query) {
            (obj.query.pages || []).forEach((objPg) => {
                const innerList = (objPg.revisions || []).reduce((accRv: IdList, objRv) => {
                    if (objRv.revid !== undefined && objRv.user) {
                        accRv[objRv.revid.toString()] = objRv.user;
                    }
                    return accRv;
                }, Object.create(null));
                Object.assign(acc, innerList);
            });
            Object.keys(obj.query.badrevids || {}).forEach((badrevid) => {
                if (!Diffids.unprocessable.includes(badrevid)) Diffids.unprocessable.push(badrevid);
            });
        }
        return acc;
    }, Object.create(null));

    Object.assign(Diffids.list, list);

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

/** Get '(MM/DD)' from a JSON timestamp or the current time. */
function getBlockedDate(timestamp?: string): string {
    const d = timestamp ? new Date(timestamp) : new Date();
    d.setHours(d.getHours() + 9);
    return `(${d.getMonth() + 1}/${d.getDate()})`;
}

/** Check whether a string contains a Japanese character. */
function containsJapaneseCharacter(str: string): boolean {
    return str.match(/[\u30a0-\u30ff\u3040-\u309f\u3005-\u3006\u30e0-\u9fcf]+/) ? true : false;
}