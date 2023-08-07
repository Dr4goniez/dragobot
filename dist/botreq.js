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
/* eslint-disable @typescript-eslint/ban-ts-comment */
const server_1 = require("./server");
const mw_1 = require("./mw");
const lib = __importStar(require("./lib"));
const title_1 = require("./title");
const testrun = false; // Must be configured
(0, server_1.createServer)(testrun);
const useTestAccount = false; // Must be configured
let processed = [];
(0, mw_1.init)(useTestAccount ? 3 : 2).then(async (mw) => {
    if (!mw)
        return;
    const debugTitles = [
    // '利用者:DragoTest/test/delnote1',
    // '利用者:DragoTest/test/delnote2',
    // '利用者:DragoTest/test/delnote3',
    ];
    // const limit = 10;
    const limit = 1000; // Default
    const lr = await lib.getLatestRevision('利用者:DrakoBot/botreq_削除依頼ログ');
    if (!lr)
        return;
    const regex = /\[\[(.+?)\]\]/g;
    let m;
    while ((m = regex.exec(lr.content))) {
        processed.push(m[1]);
    }
    runBot(debugTitles.length ? debugTitles : null, limit);
});
const talkNsNum = (0, title_1.getNsIdsByType)('talk');
/** Run the bot. */
async function runBot(testTitles, limit) {
    // Get pages to edit
    const pages = testTitles || await collectPages(limit);
    if (!pages) {
        return;
    }
    else if (!pages.length) {
        (0, server_1.log)('All pages have been processed.');
        return;
    }
    // Edit page
    const errors = []; // *{{PAGE|TITLE}} - error code
    for (const p of pages) {
        const afd = new AFDNote(p);
        await afd.init();
        if (afd.errCodes.length) {
            errors.push(`* [[${p}]] - ${afd.errCodes.join(', ')}`);
        }
    }
    // Leave error log
    if (errors.length) {
        let res = false;
        let tried = 0;
        while (!res && tried < 5) {
            tried++;
            res = await lib.edit({
                title: '利用者:DrakoBot/botreq 削除依頼ログ',
                appendtext: '\n' + errors.join('\n'),
                summary: 'log',
                bot: true
            }, isIntervalNeeded());
            if (!res) {
                await lib.sleep(1000 * 10);
            }
        }
    }
    // Next
    if (!testTitles && limit === 1000) {
        runBot(null, limit);
    }
}
let searchDone = false;
let runCnt = 0;
/**
 * Collect pages to run the bot on. First search for pages that have subst-ed AfD notes, and when all these pages have been processed
 * search for pages that transclude Template:削除依頼過去ログ.
 * @returns Null if search failed, or else an array of pages.
 */
async function collectPages(limit) {
    if (searchDone) {
        return [];
    }
    const mw = (0, mw_1.getMw)();
    runCnt++;
    let offset = limit * (runCnt - 1);
    if (offset >= 10000) {
        runCnt = 1;
        offset = limit * (runCnt - 1);
    }
    const search = () => {
        return mw.request({
            action: 'query',
            list: 'search',
            srsearch: 'insource:/この((ノート)?ページ(は.[度回]|には)|記事に?は(.[度回])?)(削除された版|削除が検討|特定版削除|版指定削除|特定版版指定削除|削除)/',
            srnamespace: talkNsNum.join('|'),
            srprop: '',
            srlimit: limit ? limit.toString() : 'max',
            sroffset: offset,
            formatversion: '2'
        }).then((res) => {
            let resSrch;
            if (!res || !res.query || !(resSrch = res.query.search)) {
                (0, server_1.log)('Query failed.');
                return null;
            }
            return resSrch.reduce((acc, { title }) => {
                if (!processed.includes(title)) {
                    processed.push(title);
                    acc.push(title);
                }
                return acc;
            }, []);
        }).catch((err) => {
            if (err && err.info) {
                (0, server_1.log)(err.info);
            }
            else {
                (0, server_1.log)('Query failed.');
            }
            return null;
        });
    };
    let titles = null;
    if (!searchDone) {
        (0, server_1.log)('Searching for pages...');
        for (let i = 0; i < 3; i++) {
            titles = await search();
            if (titles) {
                break;
            }
            else if (i < 2) {
                (0, server_1.log)('Retrying in 10 seconds...');
                await lib.sleep(1000 * 10);
            }
        }
        if (!titles) {
            (0, server_1.log)('Search failed.');
            return null;
        }
        else if (titles.length) {
            (0, server_1.log)(`${titles.length} pages found.`);
            return titles;
        }
        else {
            (0, server_1.log)('No pages matched the search criteria.');
            searchDone = true;
        }
    }
    (0, server_1.log)('Fetching pages that transclude Template:削除依頼過去ログ...');
    titles = [] || await lib.getEmbeddedIn('Template:削除依頼過去ログ', { einamespace: talkNsNum.join('|') });
    if (!titles) {
        (0, server_1.log)('getEmbeddedIn returned null.');
        return [];
    }
    (0, server_1.log)(`${titles.length} page(s) found.`);
    processed = processed.concat(titles);
    return titles;
}
class AFDNote {
    constructor(pagetitle) {
        this.Title = new title_1.Title(pagetitle);
        this.delTitle = new title_1.Title(this.Title.toString().split('/')[0] + '/削除');
        this.hasDelPage = {
            main: false,
            talk: false
        };
        this.content = '';
        this.errCodes = [];
    }
    addCode(code) {
        if (!this.errCodes.includes(code)) {
            this.errCodes.push(code);
        }
    }
    async init() {
        // Get latest revision
        const prefixedTitle = this.Title.toString();
        const lr = await lib.getLatestRevision(prefixedTitle);
        if (!lr) {
            this.addCode('nolr');
            return;
        }
        this.content = lr.content;
        const parsed = this.parseDeletionNotes().concat(this.parseAfdOldLog(), this.parseAfdLog());
        if (!parsed.length) {
            this.addCode('unparsed');
            return;
        }
        this.content = lib.replaceWikitext(this.content, parsed.map(({ input }) => input), '');
        // const regexNoncanonicalNote = /この(ページ|ノート|ノートページ)は(削除された版|削除が検討|特定版削除|版指定削除|特定版版指定削除|削除)/;
        // if (regexNoncanonicalNote.test(this.content)) {
        // 	this.addCode('noncanonical');
        // }
        const tmpl = await this.createTemplate(parsed);
        if (!tmpl.length) {
            this.addCode('emptytemplate');
            return;
        }
        else {
            this.content = tmpl.join('\n') + '\n' + this.content;
        }
        if (this.content === lr.content) {
            this.addCode('samecontent');
            return;
        }
        // Edit the page
        const res = await lib.edit({
            title: prefixedTitle,
            text: this.content,
            summary: '[[Special:PermaLink/96298914#削除済みノートをテンプレートへ置換|WP:BOTREQ#削除済みノートをテンプレートへ置換]]',
            bot: true,
            basetimestamp: lr.basetimestamp,
            starttimestamp: lr.curtimestamp,
        }, isIntervalNeeded());
        if (!res) {
            this.addCode('editfailed');
        }
    }
    parseDeletionNotes() {
        /** 1: Whether the note is for a talk page; 2: Result of AfD; 3: Redundant comments */
        const regex = /(?:\{\{NOINDEX\}\}\s*)?\**[^\S\n\r]*[^\S\n\r]*'*[^\S\n\r]*この(ページ|記事|ノート|ノートページ)に?は(?:.[度回])?(削除された版|削除が検討|特定版削除|版指定削除|特定版版指定削除|削除).+?をご覧ください。([^\n]*)\n*/g;
        // Get all subst-ed 削除済みノート
        const ret = [];
        let m;
        while ((m = regex.exec(this.content))) {
            const logline = m[3] ? m[0].replace(new RegExp(lib.escapeRegExp(m[3]) + '\\n*$'), '') : m[0];
            // Parse all links to an AfD subpage and get subpage titles
            const links = this.parseLinks(logline);
            if (!links.hasDelPage && !links.titles.length) {
                this.addCode('logline');
                continue;
            }
            // Get an unified result of the AfDs
            const talk = m[1] === 'ノート' || m[1] === 'ノートページ';
            const result = AFDNote.getResult(m[2]);
            ret.push({
                input: m[0],
                // If this is an empty array, the input string is just to be replaced with an empty string.
                notes: links.titles.map((subpage) => ({ talk, result, subpage }))
            });
            if (links.hasDelPage) {
                const key = talk ? 'talk' : 'main';
                this.hasDelPage[key] = true;
            }
        }
        return ret;
    }
    /** Convert a matched string to an AfD result. */
    static getResult(matched) {
        switch (matched) {
            case '削除':
                return '削除';
            case '特定版削除':
                return '特定版指定削除';
            case '版指定削除':
            case '特定版版指定削除':
            case '削除された版':
                return '版指定削除';
            case '削除が検討':
                return '存続';
            default:
                return '';
        }
    }
    /**
     * Parse wikilinks in a string, looking only at AfD subpages (and the talk page for AfD discussions).
     * @param str
     * @returns An array of AfD subpage , duplicates not handled.
     */
    parseLinks(str) {
        const regex = /\[\[([^|\]]+)(?:\|([^\]]+))?\]\]/g; // [[(1)|(2)]]
        const subpages = [];
        let m;
        let hasDelPage = false;
        while ((m = regex.exec(str))) {
            let p;
            m[1] = m[1].replace(/\{\{NAMESPACE\}\}:\{\{PAGENAME\}\}/g, this.Title.getPrefixedText());
            if ((p = m[1].match(/^\s*:?\s*(?:wikipedia|wp|project)\s*:\s*削除依頼\/(.+?)\s*$/i)) && !AFDNote.illegalTitleChars.test(p[1])) {
                const page = p[1].replace(/_/g, ' ');
                subpages.push(page);
            }
            else if (!hasDelPage && this.delTitle.equals(m[1])) {
                hasDelPage = true;
            }
            else {
                this.addCode('unparsablelinks');
                continue;
            }
        }
        return {
            titles: subpages,
            hasDelPage
        };
    }
    /** Parse Template:削除依頼過去ログ in the content. */
    parseAfdOldLog() {
        // Does the content have any 削除依頼過去ログ template in it?
        const tmpl = lib.parseTemplates(this.content, { namePredicate: name => name === '削除依頼過去ログ' });
        return tmpl.reduce((acc, obj) => {
            if (obj.arguments.length) {
                let forTalk = false;
                for (const arg of obj.arguments) {
                    if (arg.name === 'type') {
                        switch (arg.value) {
                            case '記事':
                            case '':
                                forTalk = false;
                                break;
                            case 'ノート':
                                forTalk = true;
                                break;
                            default:
                                this.addCode('pagetypeunknown');
                                return acc; // Type unknown, unprocessable
                        }
                        break;
                    }
                }
                const info = [];
                for (const arg of obj.arguments) { // Look at all arguments of the template
                    if (['list', 'oldlist'].includes(arg.name)) { // list= or oldlist= have AfD logs
                        const logs = arg.value.split(/\n?\*/).filter(el => el && el.trim()); // e.g. * '''削除''' [[Wikipedia:削除依頼/X]]
                        for (const logline of logs) {
                            const rm = logline.match(/'''(.+?)'''/);
                            if (!rm) {
                                this.addCode('resultunknown');
                                return acc; // Result unknown, unprocessable
                            }
                            const result = rm[1].trim();
                            const links = this.parseLinks(logline);
                            if (links.titles.length) {
                                if (links.hasDelPage) {
                                    const key = forTalk ? 'talk' : 'main';
                                    this.hasDelPage[key] = true;
                                }
                                links.titles.forEach((p) => {
                                    info.push({
                                        talk: forTalk,
                                        result,
                                        subpage: p
                                    });
                                });
                            }
                            else {
                                if (links.hasDelPage) {
                                    const key = forTalk ? 'talk' : 'main';
                                    this.hasDelPage[key] = true;
                                }
                                else {
                                    this.addCode('noparsablelinks');
                                    return acc; // No parsable links, unprocessable
                                }
                            }
                        }
                    }
                }
                acc.push({
                    input: new RegExp(lib.escapeRegExp(obj.text) + '\\n?'),
                    notes: info
                });
            }
            else { // The template has no parameter; Just to be replaced with an empty string
                acc.push({
                    input: new RegExp(lib.escapeRegExp(obj.text) + '\\n?'),
                    notes: []
                });
            }
            return acc;
        }, []);
    }
    /** Parse existing Template:削除依頼ログ in the content. */
    parseAfdLog() {
        // Does the content have any 削除依頼ログ template in it?
        const tmpl = lib.parseTemplates(this.content, { namePredicate: name => name === '削除依頼ログ' });
        return tmpl.reduce((acc, obj) => {
            if (obj.arguments.length) {
                const forTalk = obj.arguments.some(({ name, value }) => name === 'talk' && value === 'true');
                const info = [];
                obj.arguments.some(({ name, value }) => {
                    let m;
                    if ((m = /^(\D+)(\d+)$/.exec(name))) {
                        const key = m[1];
                        const num = parseInt(m[2]) - 1;
                        switch (key) {
                            case 'result':
                                if (info[num]) {
                                    info[num].result = value;
                                }
                                else {
                                    info[num] = {
                                        talk: forTalk,
                                        result: value,
                                        subpage: ''
                                    };
                                }
                                return false;
                            case 'page':
                                if (info[num]) {
                                    info[num].subpage = value;
                                }
                                else {
                                    info[num] = {
                                        talk: forTalk,
                                        result: '',
                                        subpage: value
                                    };
                                }
                                return false;
                            case 'date':
                                return false;
                            default:
                                return true;
                        }
                    }
                });
                const filteredInfo = info.filter(({ result, subpage }) => result.trim() && subpage.trim());
                if (filteredInfo.length && filteredInfo.length === info.length) {
                    acc.push({
                        input: new RegExp(lib.escapeRegExp(obj.text) + '\\n?'),
                        notes: filteredInfo
                    });
                }
                else {
                    this.addCode('unparsableafdlog');
                }
            }
            return acc;
        }, []);
    }
    async createTemplate(parsed) {
        // Flatten the 'parsed' array of objects to an array of 'notes' object array without duplicates
        const pages = [];
        const notes = parsed.reduce((acc, obj) => {
            obj.notes.forEach((nObj) => {
                const subpage = `Wikipedia:削除依頼/${nObj.subpage}`;
                if (!pages.includes(subpage)) {
                    pages.push(subpage);
                }
                acc.push(nObj);
            });
            return acc;
        }, []);
        // Check page existence
        const delPrefixedTitle = this.delTitle.getPrefixedText();
        if (this.hasDelPage.main || this.hasDelPage.talk) {
            pages.push(delPrefixedTitle);
        }
        const e = await pagesExist(pages);
        notes.sort((obj1, obj2) => {
            const ts1 = e[`Wikipedia:削除依頼/${obj1.subpage}`].create;
            const ts2 = e[`Wikipedia:削除依頼/${obj2.subpage}`].create;
            if (!ts1 || !ts2) {
                return ts1 > ts2 ? 1 : -1;
            }
            else {
                const d1 = new Date(ts1);
                const d2 = new Date(ts2);
                return d1 > d2 ? 1 : -1;
            }
        });
        let tmpl = { main: { params: [], added: [] }, talk: { params: [], added: [] } };
        if (this.hasDelPage.main && e[delPrefixedTitle].exist) {
            tmpl.main.params.push(`|result1=ノート議論|fullpage1=${delPrefixedTitle}`);
        }
        if (this.hasDelPage.talk && e[delPrefixedTitle].exist) {
            tmpl.talk.params.push(`|result1=ノート議論|fullpage1=${delPrefixedTitle}`);
        }
        tmpl = notes.reduce((acc, { talk, result, subpage }) => {
            const page = `Wikipedia:削除依頼/${subpage}`;
            const typ = talk ? 'talk' : 'main';
            const params = tmpl[typ].params;
            const added = tmpl[typ].added;
            if (added.includes(page)) {
                return acc;
            }
            else {
                added.push(page);
            }
            switch (e[page].exist) {
                case true: // Page exists
                    break;
                case false: // Page doesn't exist
                    return acc;
                case null: // Existence unknown
                    (0, server_1.log)(`Existence unknown for ${page}`);
                    this.addCode('existenceunknown');
                    break;
                case undefined:
                    (0, server_1.log)(`Existence undefined for ${page}`);
                    this.addCode('existenceundefined');
                    return acc;
            }
            const i = params.length + 1;
            const dm = e[page].create.match(/^(\d{4})-(\d{2})-(\d{2})/);
            let d = '';
            if (dm) {
                d = `${dm[1]}年${dm[2].replace(/^0/, '')}月${dm[3].replace(/^0/, '')}日`;
            }
            params.push(`|result${i}=${result}|page${i}=${subpage}|date${i}=${d}`);
            return acc;
        }, tmpl);
        return ['main', 'talk'].reduce((acc, key) => {
            // @ts-ignore
            const params = tmpl[key].params;
            if (params.length) {
                params.unshift('{{削除依頼ログ', `|talk=${key === 'talk'}`);
                params.push('}}');
                acc.push(params.join('\n'));
            }
            return acc;
        }, []);
    }
}
AFDNote.illegalTitleChars = new RegExp('[^ %!"$&\'()*,\\-./0-9:;=?@A-Z\\\\\\^_`a-z~+\\u0080-\\uFFFF]');
async function pagesExist(pagetitles) {
    const params = {
        action: 'query',
        titles: pagetitles,
        prop: 'revisions',
        rvprop: 'timestamp',
        rvlimit: 1,
        rvdir: 'newer',
        formatversion: '2'
    };
    const result = await lib.massRequest(params, 'titles', 1);
    return result.reduce((acc, res, i) => {
        let resPg;
        if (res && res.query && (resPg = res.query.pages) && resPg[0]) {
            const resRv = resPg[0].revisions;
            acc[pagetitles[i]] = {
                exist: !resPg[0].missing,
                create: resRv && resRv[0] && resRv[0].timestamp || ''
            };
        }
        else {
            acc[pagetitles[i]] = {
                exist: null,
                create: ''
            };
        }
        return acc;
    }, Object.create(null));
}
/** August 2023 */
function isIntervalNeeded() {
    const d = new Date();
    if (!testrun) {
        d.setHours(d.getHours() + 9); // JST: Needed only on Toolforge server
    }
    // log(`JST: ${d}`);
    // log(`Day: ${d.getDay()}`);
    // log(`Date: ${d.getDate()}`);
    // log(`Hour: ${d.getHours()}`);
    const isWeekday = ![0, 6].includes(d.getDay());
    const isHoliday = d.getDate() === 11;
    const hour = d.getHours();
    if (isWeekday && !isHoliday) { // weekday 19-23
        return 19 <= hour && hour < 23;
    }
    else { // weekend or holiday 9-23
        return 9 <= hour && hour < 23;
    }
}
