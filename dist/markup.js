"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.markup = exports.markupANs = void 0;
const server_1 = require("./server");
const wikitext_1 = require("./wikitext");
const lib = __importStar(require("./lib"));
const string_1 = require("./string");
class IDList {
    constructor() {
        this.list = {};
        this.processing = [];
        this.unprocessable = [];
    }
    /**
     * Evaluate an ID and check whether it needs to be processed (i.e. whether we need to convert the ID to a username).
     * If it doesn't (i.e. `list` already has an ID-username pair for it), the relevant username is returned.
     * Otherwise, the ID is pushed into the `processing` array if it isn't unprocessable.
     * @param id
     * @returns
     */
    evaluate(id) {
        if (this.list[id]) {
            return this.list[id];
        }
        else if (!this.processing.includes(id) && !this.isUnprocessable(id)) {
            this.processing.push(id);
        }
        return null;
    }
    /**
     * Get IDs that are being processed.
     * @returns A deep copy of the `processing` array.
     */
    getProcessing() {
        return this.processing.slice();
    }
    /**
     * Newly register ID-username pairs into the `list` object, and remove the processed IDs
     * from the `processing` array.
     * @param list
     */
    register(list) {
        Object.keys(list).forEach((id) => {
            const username = list[id];
            if (!this.isUnprocessable(id)) {
                this.list[id] = username;
            }
            const idx = this.processing.indexOf(id);
            if (idx !== -1) {
                this.processing.splice(idx, 1);
            }
        });
        return this;
    }
    /**
     * Abandon an ID (i.e. stop processing it and mark it as unprocessable).
     * @param id
     */
    abandon(id) {
        delete this.list[id];
        const idx = this.processing.indexOf(id);
        if (idx !== -1) {
            this.processing.splice(idx, 1);
        }
        if (!this.isUnprocessable(id)) {
            this.unprocessable.push(id);
        }
        return this;
    }
    /**
     * Check whether an ID is unprocessable.
     * @param id
     * @returns
     */
    isUnprocessable(id) {
        return this.unprocessable.includes(id);
    }
}
const LogIDList = new IDList();
const DiffIDList = new IDList();
const ANI = 'Wikipedia:管理者伝言板/投稿ブロック';
const ANS = 'Wikipedia:管理者伝言板/投稿ブロック/ソックパペット';
const AN3RR = 'Wikipedia:管理者伝言板/3RR';
/** Mark up UserANs on the administrators' noticeboards. */
async function markupANs(checkGlobal) {
    for (const page of [ANI, ANS, AN3RR]) {
        (0, server_1.log)(`Checking ${page}...`);
        await markup(page, checkGlobal);
    }
}
exports.markupANs = markupANs;
/** Mark up UserANs on a specific page. */
async function markup(pagetitle, checkGlobal) {
    // Get page content
    const Wkt = await wikitext_1.Wikitext.newFromTitle(pagetitle);
    if (!Wkt)
        return (0, server_1.log)('Failed to parse the page.');
    // Find UserANs
    const rawUserANs = Wkt.parseTemplates({
        namePredicate: (name) => name === 'UserAN',
        recursivePredicate: (Temp) => !Temp || Temp.getName('clean') !== 'UserAN',
        hierarchy: [
            ['1', 'user', 'User'],
            ['t', 'type', 'Type'],
            ['状態', 's', 'status', 'Status']
        ]
    });
    if (!rawUserANs.length)
        return (0, server_1.log)('Procedure cancelled: There is no UserAN on this page.');
    const sections = Wkt.parseSections();
    let UserAN = rawUserANs.reduce((acc, Temp) => {
        /*/********************************************************************************************************\
            A full list of argument combinations
                args.length === 1
                - [(1=)username] (open)
                args.length === 2
                - [t=TYPE, (1=)username] (open)
                - [(1=)username, 状態=] (open)
                - [(1=)username, 状態=X] (closed)
                - [(1=)username, (2=)無期限] (closed)
                args.length === 3
                - [t=TYPE, (1=)username, 状態=] (open)
                - [t=TYPE, (1=)username, 状態=X] (closed)
                - [t=TYPE, (1=)username, (2=)無期限] (closed)
                - [(1=)username, 状態=, (2=)無期限] (closed)
                args.length === 4
                - [t=TYPE, (1=)username, 状態=, (2=)無期限] (closed)
        \***********************************************************************************************************/
        let user = '';
        let typeKey = '';
        let typeVal = '';
        let botTs = '';
        let hasEmptyManualStatusArg = false;
        for (let { name, value } of Temp.args) {
            name = lib.clean(name);
            value = lib.clean(value);
            if (name === '2' && value) {
                return acc;
            }
            else if (name === 'bot') {
                if (value === 'no') {
                    return acc;
                }
                else {
                    let m;
                    if ((m = value.match(/20\d{2}-(?:0[1-9]|1[0-2])-(?:[0-2]\d|3[01])T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\dZ?/))) {
                        botTs = m[0];
                    }
                    Temp.deleteArg(name);
                }
            }
            else if (value && /^(1|[uU]ser)$/.test(name)) {
                user = value;
            }
            else if (/^(t|[tT]ype)$/.test(name)) {
                typeKey = name;
                typeVal = value.toLowerCase();
            }
            else if (/^(状態|s|[sS]tatus)$/.test(name)) {
                hasEmptyManualStatusArg = !value;
            }
            else {
                Temp.deleteArg(name); // Unsupported argument
            }
        }
        const len = Temp.args.length;
        const isOpen = ( // Any of the 4 "open" combinations in the list above
        len === 1 && user ||
            len === 2 && user && (typeKey || hasEmptyManualStatusArg) ||
            len === 3 && user && typeKey && hasEmptyManualStatusArg);
        if (!isOpen) { // This condition includes "!user"
            return acc;
        }
        else if (lib.isIPv6Address(user, true)) {
            user = user.toUpperCase();
        }
        const isIp = lib.isIPAddress(user, true);
        typeKey = typeKey || 't';
        typeVal = typeVal || (isIp ? 'ip2' : 'user2');
        if (!isIp && /[/@#<>[\]|{}:]|^(\d{1,3}\.){3}\d{1,3}$/.test(user)) {
            // Ensure the username doesn't contain invalid characters
            return acc;
        }
        // Type-dependent modifications
        let modified = false;
        let logid = '';
        let diffid = '';
        switch (typeVal) {
            case 'user2':
            case 'unl':
            case 'usernolink':
                if (isIp) {
                    typeVal = 'ip2';
                    Temp.addArgs([{ name: typeKey, value: typeVal }]);
                    modified = true;
                }
                break;
            case 'ip2':
            case 'ipuser2':
                if (!isIp) {
                    typeVal = 'user2';
                    Temp.addArgs([{ name: typeKey, value: typeVal }]);
                    modified = true;
                }
                break;
            case 'log':
            case 'logid':
                if (/^\d+$/.test(user)) { // Make sure that the user param is only of numerals
                    logid = user;
                    user = LogIDList.evaluate(user) || '';
                }
                break;
            case 'diff':
            case 'diffid':
                if (/^\d+$/.test(user)) {
                    diffid = user;
                    user = DiffIDList.evaluate(user) || '';
                }
                break;
            default: // 'none' or Invalid typeVal (the block status can't be checked)
                if (isIp) {
                    typeVal = 'ip2';
                    Temp.addArgs([{ name: typeKey, value: typeVal }]);
                    modified = true;
                }
                else {
                    user = '';
                }
        }
        if (!user && !logid && !diffid) { // Can't be forwarded to block check
            return acc;
        }
        // Create an information object
        const info = {
            modified,
            timestamp: (() => {
                const sig = Wkt.wikitext.slice(Temp.getEndIndex()).match(/(\d{4})年(\d{1,2})月(\d{1,2})日 \(.{1}\) (\d{2}:\d{2}) \(UTC\)/);
                if (!sig)
                    return '';
                const ts = sig.map(el => el.padStart(2, '0')); // MM and DD may be of one digit but they must be of two digits
                return `${ts[1]}-${ts[2]}-${ts[3]}T${ts[4]}:00Z`; // YYYY-MM-DDThh:mm:00Z (hh:mm is one capturing group)
            })(),
            section: (() => {
                let sectionTitle = '';
                const tempIdx = Temp.getStartIndex();
                for (let i = 0; i < sections.length; i++) {
                    if (sections[i].startIndex <= tempIdx) {
                        sectionTitle = sections[i].title;
                    }
                    else {
                        break;
                    }
                }
                return sectionTitle; // Supposed never to be an empty string
            })(),
            user: ucfirst(user.replace(/_/g, ' ')),
            type: typeVal,
            logid,
            diffid,
            after: botTs,
            // The following gets a value if the user turns out to be blocked
            duration: '',
            date: '',
            domain: '',
            flags: '',
            reblocked: ''
        };
        if (info.timestamp) {
            acc.push({ Temp, info });
        }
        return acc;
    }, []);
    if (!UserAN.length)
        return (0, server_1.log)('Procedure cancelled: No open UserANs have been found.');
    // Convert logids and diffids to usernames
    const [logidList, diffidList] = await Promise.all([queryAccountCreations(), queryEditDiffs(DiffIDList.getProcessing())]);
    LogIDList.register(logidList);
    DiffIDList.register(diffidList);
    // Another attempt to convert logids to usernames
    const remainingLogids = LogIDList.getProcessing();
    if (remainingLogids.length) {
        const scrapeQueries = [];
        remainingLogids.forEach((id) => {
            scrapeQueries.push(scrapeUsernameFromLogid(id));
        });
        const scrapedUsernames = await Promise.all(scrapeQueries);
        remainingLogids.forEach((logid, i) => {
            const username = scrapedUsernames[i];
            if (username) {
                LogIDList.register({ [logid]: username });
            }
        });
    }
    // Sort registered users and IPs
    const users = [];
    const ips = [];
    UserAN = UserAN.filter(({ info }) => {
        // Process converted IDs
        const { logid, diffid } = info;
        if (!info.user) {
            if (logid) {
                const username = LogIDList.evaluate(logid) || '';
                if (username) {
                    info.user = username;
                }
                else {
                    LogIDList.abandon(logid);
                }
            }
            if (diffid) {
                const username = DiffIDList.evaluate(diffid);
                if (username) {
                    info.user = username;
                }
                else {
                    DiffIDList.abandon(diffid);
                }
            }
        }
        const user = info.user;
        if (!user) {
            // ID conversion attempts won't be made any further, meaning that UserANs without a username at this point
            // can't be processed (impossible to forward to block check)
            return false;
        }
        else if (lib.isIPAddress(user, true)) {
            if (!ips.includes(user))
                ips.push(user);
        }
        else {
            if (!users.includes(user))
                users.push(user);
        }
        return true;
    });
    if (!users.length && !ips.length)
        return (0, server_1.log)('Procedure cancelled: No UserANs can be marked up.');
    // Check if the users and IPs in the arrays are locally blocked
    const [bkUsers, bkIps] = await Promise.all([queryBlockedUsers(users, pagetitle === ANS), queryBlockedIps(ips)]);
    const blockInfo = { ...bkUsers, ...bkIps };
    const toBeReblocked = UserAN.reduce((acc, { info }) => {
        // Process the return value and at the same time filter out users that need to be reblocked
        let blck = blockInfo[info.user];
        if (!blck) {
            return acc;
        }
        else if (Array.isArray(blck)) { // IP
            if (blck.length > 1) {
                // Get the narrowest block applied after the report
                let idx = null;
                let narrowestSubnet;
                for (let i = 0; i < blck.length; i++) {
                    const { timestamp, user } = blck[i];
                    const newlyReported = lib.compareTimestamps(info.timestamp, info.after || timestamp, 5 * 60 * 1000) >= 0;
                    const m = user.match(/\/(\d{1,3})$/);
                    const subnet = m ? parseInt(m[1]) : user.includes('.') ? 32 : 128;
                    if (newlyReported) {
                        if (!narrowestSubnet || narrowestSubnet < subnet) {
                            idx = i;
                            narrowestSubnet = subnet;
                        }
                    }
                }
                if (idx === null) {
                    // None of the block logs is a new one
                    acc.push({
                        user: info.user,
                        timestamp: info.after || info.timestamp
                    });
                    return acc;
                }
                blck = blck[idx];
            }
            else {
                blck = blck[0]; // Note: Length is more than 0
            }
        }
        const newlyReported = lib.compareTimestamps(info.timestamp, info.after || blck.timestamp, 5 * 60 * 1000) >= 0;
        if (newlyReported) {
            const isIp = lib.isIPAddress(info.user, true);
            const nousertalk = !blck.allowusertalk;
            const noemail = blck.noemail;
            const partial = !!blck.restrictions && !Array.isArray(blck.restrictions);
            const indef = blck.expiry === 'infinity';
            const hardblock = isIp && !blck.anononly;
            const range = (() => {
                const m = blck.user.match(/\/\d{1,3}$/);
                return isIp && m && info.user.slice(-m[0].length) !== m[0] ? m[0] + 'で' : '';
            })();
            info.duration = range + (indef ? '無期限' : getDuration(blck.timestamp, blck.expiry));
            info.date = getBlockedDate(blck.timestamp);
            info.domain = partial ? '部分ブロック' : '';
            const flags = [];
            if (nousertalk)
                flags.push('会話×');
            if (noemail)
                flags.push('メール×');
            if (hardblock)
                flags.push('ハードブロック');
            info.flags = flags.join('・');
        }
        else {
            acc.push({
                user: info.user,
                timestamp: info.after || info.timestamp
            });
        }
        return acc;
    }, []);
    // Process UserANs with users to be reblocked
    if (toBeReblocked.length) {
        const response = await lib.massRequest({
            action: 'query',
            list: 'logevents',
            letype: 'block',
            letitle: toBeReblocked.map(({ user }) => '利用者:' + user),
            formatversion: '2'
        }, 'letitle', 1);
        const cleanupBlockLog = (obj) => {
            // Make sure that 'params' has an 'expiry' property (it's undefined in the case of indefinite block)
            obj.params = obj.params || {};
            if (obj.params.duration === 'infinity' && !obj.params.expiry)
                obj.params.expiry = 'infinity';
            // Remove irrelevant values
            obj.params.flags = (obj.params.flags || []).filter((el) => ['anononly', 'noemail', 'nousertalk'].includes(el));
            return obj;
        };
        const reblockInfo = response.reduce((acc, res, i) => {
            const resLgev = res && res.query && res.query.logevents;
            if (!resLgev)
                return acc;
            const username = toBeReblocked[i].user;
            const reportTs = toBeReblocked[i].timestamp;
            let latestBlock = null;
            let olderBlock = null;
            for (let obj of resLgev) {
                obj = cleanupBlockLog(obj);
                if (obj.action && ['block', 'reblock'].includes(obj.action) && obj.timestamp) {
                    if (obj.action === 'reblock' && !latestBlock &&
                        lib.compareTimestamps(reportTs, obj.timestamp) >= 0 // Reblock log after report
                    ) {
                        latestBlock = obj;
                    }
                    else if (latestBlock && !olderBlock &&
                        lib.compareTimestamps(obj.timestamp, reportTs) >= 5 * 60 * 1000 && ( // Block log before report
                    // Not expired before report
                    obj.params.expiry === 'infinity' ||
                        lib.compareTimestamps(reportTs, obj.params.expiry) > 0)) {
                        olderBlock = obj;
                        break;
                    }
                    else if (!latestBlock && obj.action === 'block') {
                        break;
                    }
                }
            }
            if (!latestBlock || !olderBlock)
                return acc;
            const paraNew = latestBlock.params;
            const paraOld = olderBlock.params;
            // Domain
            let domain = '';
            if (paraOld.sitewide && paraNew.sitewide) {
                // Do nothing
            }
            else if (paraOld.sitewide && !paraNew.sitewide) {
                domain = '部分ブロック';
            }
            else if (!paraOld.sitewide && paraNew.sitewide) {
                domain = 'サイト全体';
            }
            else {
                if (JSON.stringify(paraOld.restrictions) === JSON.stringify(paraNew.restrictions)) {
                    // Do nothing
                }
                else {
                    domain = '部分ブロック条件変更';
                }
            }
            // Duration (if changed, substitute the 'duration' variable with the new expiry)
            const duration = paraOld.expiry !== paraNew.expiry ? paraNew.expiry : '';
            // Flags
            const flags = [];
            const diff = lib.arraysDiff(paraOld.flags, paraNew.flags);
            if (diff.added.length || diff.removed.length) {
                [diff.added, diff.removed].forEach((arr, j) => {
                    const removed = j === 1;
                    arr.forEach((el) => {
                        let translated;
                        if (typeof el === 'string') {
                            switch (el) {
                                case 'anononly':
                                    translated = removed ? 'ハードブロック' : 'ソフトブロック';
                                    break;
                                case 'noemail':
                                    translated = 'メール' + (removed ? '〇' : '×');
                                    break;
                                case 'nousertalk':
                                    translated = '会話' + (removed ? '〇' : '×');
                                    break;
                                default:
                                    (0, server_1.log)('Encountered an unrecognized value of ' + el + '.');
                                    translated = '';
                            }
                            flags.push(translated);
                        }
                    });
                });
            }
            acc[username] = {
                duration: duration === 'infinity' && '無期限' || duration && getDuration(latestBlock.timestamp, duration),
                date: getBlockedDate(latestBlock.timestamp),
                domain,
                flags: flags.join('・'),
                reblocked: '条件変更'
            };
            return acc;
        }, Object.create(null));
        // Set properties of the UserAN array
        if (Object.keys(reblockInfo).length) {
            for (const { info } of UserAN) {
                if (reblockInfo[info.user]) {
                    Object.assign(info, reblockInfo[info.user]);
                }
            }
        }
    }
    // Check if the users and IPs in the arrays are globally (b)locked
    if (checkGlobal) {
        // Only check users that aren't locally blocked
        const gUsers = [];
        const gIps = [];
        UserAN.forEach(({ info }) => {
            const { user, date, after } = info;
            if (date || after) { // Ignore if locally blocked or has a |bot=TIMESTAMP parameter
                return;
            }
            else if (lib.isIPAddress(user, true)) {
                if (!gIps.includes(user))
                    gIps.push(user);
            }
            else {
                if (!gUsers.includes(user))
                    gUsers.push(user);
            }
        });
        const [gLkUsers, gBkIps] = await Promise.all([queryLockedUsers(gUsers), queryGloballyBlockedIps(gIps)]);
        if (Object.keys(gLkUsers).length || Object.keys(gBkIps).length) {
            UserAN.forEach(({ info }) => {
                if (info.date || info.after)
                    return;
                const lockInfo = gLkUsers[info.user];
                const gBlockInfo = gBkIps[info.user];
                if (lockInfo) {
                    Object.assign(info, lockInfo);
                }
                else if (gBlockInfo) {
                    const { timestamp, ...obj } = gBlockInfo;
                    const newlyReported = lib.compareTimestamps(info.timestamp, timestamp, 5 * 60 * 1000) >= 0;
                    if (newlyReported) {
                        Object.assign(info, obj);
                    }
                }
            });
        }
    }
    // --- Note: UserANs to mark up all have a 'date' property at this point ---
    // Final check before edit
    let newlyBlocked = false;
    let newlyModified = false;
    let modOnly = false; // True if no user is newly blocked but some UserANs need to be modified
    UserAN = UserAN.filter(({ info, Temp }) => {
        newlyBlocked = newlyBlocked || !!info.date;
        newlyModified = newlyModified || !!info.modified;
        if (info.date) { // The UserAN is to be closed
            const display = [info.domain + info.duration, info.flags, info.date].filter(el => el);
            Temp.addArgs([{ name: '2', value: display.join(' '), forceUnnamed: true }]);
            return true;
        }
        else if (info.modified) {
            return true;
        }
        else {
            return false;
        }
    });
    if (!newlyBlocked && !newlyModified) {
        return (0, server_1.log)('Procedure cancelled: There is no UserAN to be closed.');
    }
    else if (!newlyBlocked) {
        modOnly = true;
    }
    // Get summary
    let summary = 'Bot:';
    if (!modOnly) {
        /** Creates a contribs link from an object that is an element of the 'UserAN' array. */
        const getUserLink = (info) => {
            const condition = info.reblocked || info.domain + info.duration;
            if (/^(user2|unl|usernolink)$/.test(info.type)) {
                const maxLetterCnt = containsJapaneseCharacter(info.user) ? 10 : 20;
                if (info.user.length > maxLetterCnt) {
                    return `${info.user.substring(0, maxLetterCnt)}.. (${condition})`;
                }
                else {
                    return `[[特別:投稿記録/${info.user}|${info.user}]] (${condition})`;
                }
            }
            else if (/^ip(user)?2$/.test(info.type)) {
                return `[[特別:投稿記録/${info.user}|${info.user}]] (${condition})`;
            }
            else if (/^log(id)?$/.test(info.type)) {
                return `[[特別:転送/logid/${info.logid}|Logid/${info.logid}]] (${condition})`;
            }
            else if (/^diff?$/.test(info.type)) {
                return `[[特別:差分/${info.diffid}|差分/${info.diffid}]]の投稿者 (${condition})`;
            }
        };
        const reportsBySection = UserAN.reduce((acc, { info }) => {
            if (!info.date)
                return acc; // Filter out UserANs that need to be marked up
            if (!acc[info.section])
                acc[info.section] = []; // Create key and set an empty array as its value
            // Push the current object only if the array doesn't contain an object whose 'user' property is the same as the current object's
            //  'user' property. This prevents the output from having multiple occurrences of the same username. (One user could be reported
            // multiple times in one section.)
            if (acc[info.section].every(({ user }) => user !== info.user)) {
                acc[info.section].push({ ...info });
            }
            return acc;
        }, Object.create(null));
        for (const sectiontitle in reportsBySection) { // Loop through all keys of the created object (i.e. section titles)
            // Loop through the elements of the array that is the property of the corresponding key until the loop returns false
            const bool = reportsBySection[sectiontitle].every(info => {
                const userlink = getUserLink(info);
                if (summary.includes(userlink))
                    return true; // Do nothing if the summary already has a link for the relevant user
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
                }
                else {
                    summary += ' ほか';
                    return false; // Exit the loop
                }
            });
            if (!bool)
                break; // array.every() returned false, which means the summary reached the word count limit
        }
    }
    else {
        summary += ' UserANの修正';
    }
    // Get the latest revision again because the procedure above can take a while to finish
    const lr = await wikitext_1.Wikitext.fetch(pagetitle);
    if (!lr)
        return (0, server_1.log)('Failed to get the latest revision.');
    if (lr.basetimestamp !== Wkt.getRevision().basetimestamp) {
        (0, server_1.log)('It seems that the page was updated after starting this procedure.');
    }
    let content = lr.content;
    // Update UserANs in the source text
    const argOrder = ['t', 'type', 'Type', '1', 'user', 'User', '状態', 's', 'status', 'Status', '2'];
    for (let i = UserAN.length - 1; i >= 0; i--) {
        const Temp = UserAN[i].Temp;
        content = Temp.replaceIn(content, {
            nameprop: 'fullclean',
            linebreak: false,
            sortPredicate: (obj1, obj2) => argOrder.indexOf(obj1.name) - argOrder.indexOf(obj2.name)
        });
    }
    if (content === lr.content) {
        return (0, server_1.log)('Procedure cancelled: Same content.');
    }
    // Edit the page
    const params = {
        title: pagetitle,
        text: content,
        summary: summary,
        minor: true,
        basetimestamp: lr.basetimestamp,
        starttimestamp: lr.curtimestamp,
    };
    if (modOnly) {
        params.bot = true;
    }
    await lib.edit(params);
}
exports.markup = markup;
/**
 * Uppercase the first character if not a Gerogean letter.
 * @param str
 * @returns
 */
function ucfirst(str) {
    return /^[\u10A0-\u10FF]/.test(str) ? str : (0, string_1.ucFirst)(str);
}
/** JSON timestamp passed to the API as a list=logevents query parameter (leend). Look only for log entries newer than this timestamp. */
let lookedUntil = '';
/** Query the API and update `LogIDList`. */
async function queryAccountCreations() {
    if (!LogIDList.getProcessing().length) {
        return {};
    }
    const params = {
        action: 'query',
        list: 'logevents',
        leprop: 'ids|title|timestamp',
        letype: 'newusers',
        lelimit: 'max',
        formatversion: '2'
    };
    if (lookedUntil)
        Object.assign(params, { leend: lookedUntil });
    const response = await lib.continuedRequest(params);
    let ts = '';
    const list = response.reduce((acc, obj) => {
        const resLgev = obj && obj.query && obj.query.logevents;
        if (resLgev) {
            const innerList = resLgev.reduce((accLg, objLg) => {
                if (!ts && objLg.timestamp)
                    ts = objLg.timestamp;
                if (objLg.logid !== undefined && objLg.title) {
                    accLg[objLg.logid.toString()] = objLg.title.replace(/^利用者:/, '');
                }
                return accLg;
            }, Object.create(null));
            Object.assign(acc, innerList);
        }
        return acc;
    }, Object.create(null));
    if (ts)
        lookedUntil = ts;
    return list;
}
/** Query the API and update Diffids.list. */
async function queryEditDiffs(diffIdsArr) {
    if (!diffIdsArr.length)
        return {};
    const params = {
        action: 'query',
        revids: diffIdsArr,
        prop: 'revisions',
        rvprop: 'ids|user',
        formatversion: '2'
    };
    const response = await lib.massRequest(params, 'revids');
    const list = response.reduce((acc, obj) => {
        const resPgs = obj && obj.query && obj.query.pages;
        if (resPgs) {
            resPgs.forEach((objPg) => {
                const innerList = (objPg.revisions || []).reduce((accRv, objRv) => {
                    if (objRv.revid !== undefined && objRv.user) {
                        accRv[objRv.revid.toString()] = objRv.user;
                    }
                    return accRv;
                }, Object.create(null));
                Object.assign(acc, innerList);
            });
        }
        Object.keys(obj && obj.query && obj.query.badrevids || {}).forEach((badrevid) => {
            DiffIDList.abandon(badrevid);
        });
        return acc;
    }, Object.create(null));
    return list;
}
/** Get a username from an account creation logid by scraping [[Special:Log/newusers]]. */
async function scrapeUsernameFromLogid(logid) {
    const url = 'https://ja.wikipedia.org/w/index.php?title=%E7%89%B9%E5%88%A5:%E3%83%AD%E3%82%B0&logid=' + logid;
    const $ = await lib.scrapeWebpage(url);
    if (!$)
        return null;
    let $newusers = $('.mw-logline-newusers');
    if ($newusers.length === 0)
        return null;
    $newusers = $newusers.eq(0);
    let username = null;
    switch ($newusers.attr('data-mw-logaction')) {
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
/** Get the local block statuses of registered users. */
async function queryBlockedUsers(usersArr, isANS) {
    if (!usersArr.length)
        return {};
    const params = {
        action: 'query',
        list: 'blocks',
        bkprop: 'user|timestamp|expiry|restrictions|flags',
        bklimit: 'max',
        bkusers: usersArr,
        bkshow: isANS ? 'account|!temp' : '',
        formatversion: '2'
    };
    const response = await lib.massRequest(params, 'bkusers');
    return response.reduce((acc, res) => {
        const resBlck = res && res.query && res.query.blocks;
        if (!resBlck)
            return acc;
        const ret = resBlck.reduce((accBl, blck) => {
            accBl[blck.user] = blck;
            return accBl;
        }, Object.create(null));
        Object.assign(acc, ret);
        return acc;
    }, Object.create(null));
}
/** Get the local block statuses of IP users. */
async function queryBlockedIps(ipsArr) {
    if (!ipsArr.length)
        return {};
    const params = {
        action: 'query',
        list: 'blocks',
        bkprop: 'user|timestamp|expiry|restrictions|flags',
        bkip: ipsArr,
        formatversion: '2'
    };
    const response = await lib.massRequest(params, 'bkip', 1);
    return response.reduce((acc, res, i) => {
        const ip = ipsArr[i];
        const blck = res && res.query && res.query.blocks;
        if (blck && blck.length) {
            acc[ip] = blck;
        }
        return acc;
    }, Object.create(null));
}
/**
 * Subtract `laterTimestamp` by `earlierTimestamp`, and get the difference between them as a duration in Japanese.
 * @param earlierTimestamp
 * @param laterTimestamp
 * @returns `null` if the difference is a negative value.
 */
function getDuration(earlierTimestamp, laterTimestamp) {
    const ts1 = earlierTimestamp instanceof Date ? earlierTimestamp : new Date(earlierTimestamp);
    const ts2 = laterTimestamp instanceof Date ? laterTimestamp : new Date(laterTimestamp);
    const diff = ts2.getTime() - ts1.getTime();
    if (diff < 0)
        return null;
    let seconds = Math.round(diff / 1000);
    let minutes = Math.round(seconds / 60);
    let hours = Math.round(minutes / 60);
    let days = Math.round(hours / 24);
    let weeks = Math.round(days / 7);
    let months = Math.round(days / 30);
    let years = Math.floor(days / 365);
    // console.log(seconds, minutes, hours, days, weeks, months, years);
    seconds %= 60;
    minutes %= 60;
    hours %= 24;
    days %= 30;
    weeks %= 7;
    months %= 30;
    years %= 365;
    // console.log(seconds, minutes, hours, days, weeks, months, years);
    let duration, unit;
    if (years) {
        duration = years;
        unit = '年';
    }
    else if (months) {
        duration = months;
        unit = 'か月';
    }
    else if (weeks) {
        duration = weeks;
        unit = '週間';
    }
    else if (days) {
        duration = days;
        unit = '日';
    }
    else if (hours) {
        duration = hours;
        unit = '時間';
    }
    else if (minutes) {
        duration = minutes;
        unit = '分';
    }
    else {
        duration = seconds;
        unit = '秒';
    }
    switch (unit) {
        case 'か月':
            if (duration % 12 === 0) {
                duration /= 12;
                unit = '年';
            }
            break;
        case '週間':
            if (duration % 4 === 0) {
                duration /= 4;
                unit = 'か月';
            }
            break;
        case '日':
            if (duration % 7 === 0) {
                duration /= 7;
                unit = '週間';
            }
            break;
        case '時間':
            if (duration % 24 === 0) {
                duration /= 24;
                unit = '日';
            }
            break;
        case '分':
            if (duration % 60 === 0) {
                duration /= 60;
                unit = '時間';
            }
            break;
        case '秒':
            if (duration % 60 === 0) {
                duration /= 60;
                unit = '分';
            }
            break;
        default:
    }
    return duration + unit;
}
/** Get '(MM/DD)' from a JSON timestamp or the current time. */
function getBlockedDate(timestamp) {
    const d = timestamp ? new Date(timestamp) : new Date();
    d.setHours(d.getHours() + 9);
    return `(${d.getMonth() + 1}/${d.getDate()})`;
}
/** Get the global lock statuses of registered users. */
async function queryLockedUsers(usersArr) {
    if (!usersArr.length)
        return {};
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
    const lockedDate = getBlockedDate();
    return response.reduce((acc, res, i) => {
        const username = usersArr[i];
        const resLck = res && res.query && res.query.globalallusers;
        if (!resLck) {
            return acc;
        }
        else if (!resLck[0]) {
            (0, server_1.log)('User:' + username + ' doesn\'t seem to exist.');
            return acc;
        }
        if (resLck[0].locked === '') {
            acc[username] = {
                date: lockedDate,
                domain: 'グローバルロック'
            };
        }
        return acc;
    }, Object.create(null));
}
/** Get the global block statuses of IP users. */
async function queryGloballyBlockedIps(ipsArr) {
    if (!ipsArr.length)
        return {};
    const params = {
        action: 'query',
        list: 'globalblocks',
        bgip: ipsArr,
        bgprop: 'address|expiry|timestamp',
        bglimit: 1,
        formatversion: '2'
    };
    const response = await lib.massRequest(params, 'bgip', 1);
    return response.reduce((acc, res, i) => {
        const resGBlck = res && res.query && res.query.globalblocks;
        if (!resGBlck || !resGBlck.length)
            return acc;
        const gBlck = resGBlck[0];
        const ip = ipsArr[i];
        acc[ip] = {
            timestamp: gBlck.timestamp,
            duration: gBlck.expiry === 'infinity' ? '無期限' : getDuration(gBlck.timestamp, gBlck.expiry),
            date: getBlockedDate(gBlck.timestamp),
            domain: 'グローバルブロック'
        };
        return acc;
    }, Object.create(null));
}
/** Check whether a string contains a Japanese character. */
function containsJapaneseCharacter(str) {
    return /[\u30a0-\u30ff\u3040-\u309f\u3005-\u3006\u30e0-\u9fcf]/.test(str);
}
