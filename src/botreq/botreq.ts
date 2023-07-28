/* eslint-disable @typescript-eslint/ban-ts-comment */
import { init, getMw } from '../mw';
import * as lib from '../lib';
import {
    ApiResponse,
    ApiResponseError,
    ApiResponseQueryListSearch,
    ApiResponseQueryPages
} from '..';

const debugTitles = [
    {title: '利用者:DragoTest/test/delnote1', ns: 2},
    {title: '利用者:DragoTest/test/delnote2', ns: 2},
    {title: '利用者:DragoTest/test/delnote3', ns: 2},
];
// const debugTitles = undefined;
init(debugTitles ? 3 : 2).then(async (mw) => {
    if (!mw) return;
    runBot(debugTitles);
});

const wgNamespaceIds = {
    'メディア': -2,
    '特別': -1,
    // '': 0,
    'ノート': 1,
    '利用者': 2,
    '利用者‐会話': 3,
    'wikipedia': 4,
    'wikipedia‐ノート': 5,
    'ファイル': 6,
    'ファイル‐ノート': 7,
    'mediawiki': 8,
    'mediawiki‐ノート': 9,
    'template': 10,
    'template‐ノート': 11,
    'help': 12,
    'help‐ノート': 13,
    'category': 14,
    'category‐ノート': 15,
    'portal': 100,
    'portal‐ノート': 101,
    'プロジェクト': 102,
    'プロジェクト‐ノート': 103,
    'timedtext': 710,
    'timedtext talk': 711,
    'モジュール': 828,
    'モジュール‐ノート': 829,
    'gadget': 2300,
    'gadget talk': 2301,
    'gadget definition': 2302,
    'gadget definition talk': 2303,
    'トーク': 1,
    '利用者・トーク': 3,
    'wikipedia・トーク': 5,
    'ファイル・トーク': 7,
    'mediawiki・トーク': 9,
    'テンプレート': 10,
    'テンプレート・トーク': 11,
    'ヘルプ': 12,
    'ヘルプ・トーク': 13,
    'カテゴリ': 14,
    'カテゴリ・トーク': 15,
    'ポータル‐ノート': 101,
    'portal・トーク': 101,
    'プロジェクト・トーク': 103,
    'モジュール・トーク': 829,
    'wikipedia talk': 5,
    'wp': 4,
    '画像': 6,
    '画像‐ノート': 7,
    'image': 6,
    'image talk': 7,
    'media': -2,
    'special': -1,
    'talk': 1,
    'user': 2,
    'user talk': 3,
    'project': 4,
    'project talk': 5,
    'file': 6,
    'file talk': 7,
    'mediawiki talk': 9,
    'template talk': 11,
    'help talk': 13,
    'category talk': 15,
    'module': 828,
    'module talk': 829
};
const talkNsNum: number[] = [];

const wgFormattedNamespaces = {
    '0': '',
    '1': 'ノート',
    '2': '利用者',
    '3': '利用者‐会話',
    '4': 'Wikipedia',
    '5': 'Wikipedia‐ノート',
    '6': 'ファイル',
    '7': 'ファイル‐ノート',
    '8': 'MediaWiki',
    '9': 'MediaWiki‐ノート',
    '10': 'Template',
    '11': 'Template‐ノート',
    '12': 'Help',
    '13': 'Help‐ノート',
    '14': 'Category',
    '15': 'Category‐ノート',
    '100': 'Portal',
    '101': 'Portal‐ノート',
    '102': 'プロジェクト',
    '103': 'プロジェクト‐ノート',
    '710': 'TimedText',
    '711': 'TimedText talk',
    '828': 'モジュール',
    '829': 'モジュール‐ノート',
    '2300': 'Gadget',
    '2301': 'Gadget talk',
    '2302': 'Gadget definition',
    '2303': 'Gadget definition talk',
    '-1': '特別'
};

interface PageObject {
    title: string;
    ns: number;
}

/** Run the bot. */
async function runBot(testTitles?: PageObject[]) {

    // Get pages to edit
    const pages = testTitles || await collectPages();
    if (!pages) {
        return;
    } else if (!pages.length) {
        console.log('All pages have been processed.');
        return;
    }

    // Edit page
    const errors: string[] = []; // *{{PAGE|TITLE}} - error code
    for (const p of pages) {
        const afd = new AFDNote(p);
        await afd.init();
        if (afd.errCodes.length) {
            errors.push(`* {{Page|${p.title}}} - ${afd.errCodes.join(', ')}`);
        }
    }

    // Leave error log
    if (errors.length) {
        let res: boolean|null = false;
        let tried = 0;
        while (!res && tried < 5) {
            tried++;
            res = await lib.edit({
                title: '利用者:DrakoBot/botreq 削除依頼ログ',
                appendtext: '\n' + errors.join('\n'),
                summary: 'log',
                bot: true
            });
        }
    }

    // Next
    if (!testTitles) {
        runBot();
    }

}

let searchDone = false;
let processed: string[] = [];
/**
 * Collect pages to run the bot on. First search for pages that have subst-ed AfD notes, and when all these pages have been processed
 * search for pages that transclude Template:削除依頼過去ログ.
 * @returns Null if search failed, or else an array of pages.
 */
async function collectPages(): Promise<PageObject[]|null> {

    if (searchDone) {
        return [];
    }

    const mw = getMw();

    const search = (): Promise<PageObject[]|null> => {
        return mw.request({
            action: 'query',
            list: 'search',
            srsearch: 'insource:/この(ノート)?ページ(は一度|には)(削除された版|削除が検討|特定版削除|版指定削除|特定版版指定削除|削除)/',
            srnamespace: talkNsNum.join('|'),
            srprop: '',
            srlimit: 'max',
            formatversion: '2'
        }).then((res: ApiResponse) => {
            let resSrch: ApiResponseQueryListSearch[]|undefined;
            if (!res || !res.query || !(resSrch = res.query.search)) {
                console.log('Query failed.');
                return null;
            }
            return resSrch.reduce((acc: PageObject[], {title, ns}) => {
                if (!processed.includes(title)) {
                    acc.push({title, ns});
                }
                return acc;
            }, []);
        }).catch((err: ApiResponseError) => {
            if (err && err.info) {
                console.log(err.info);
            } else {
                console.log('Query failed.');
            }
            return null;
        });
    };

    /** Get a list of pages that transclude a given page. */
    const transcluding = async (): Promise<PageObject[]> => {

        let pages: PageObject[] = [];
        const query = (eicontinue?: string): Promise<void> => {
            return mw.request({
                action: 'query',
                list: 'embeddedin',
                eititle: 'Template:削除依頼過去ログ',
                einamespace: talkNsNum.join('|'),
                eifilterredir: 'nonredirects',
                eilimit: 'max',
                eicontinue: eicontinue,
                formatversion: '2'
            }).then((res: ApiResponse) => {

                let resEi, resCont;
                if (!res || !res.query || !(resEi = res.query.embeddedin)) return;

                pages = pages.concat(
                    resEi.reduce((acc: PageObject[], {title, ns}) => {
                        if (!processed.includes(title)) {
                            acc.push({title, ns});
                        }
                        return acc;
                    }, [])
                );

                if (res && res.continue && (resCont = res.continue.eicontinue)) {
                    return query(resCont);
                } else {
                    return;
                }


            }).catch((err: ApiResponseError) => {
                if (err && err.info) {
                    console.log(err.info);
                } else {
                    console.log('Query failed.');
                }
            });
        };

        await query();
        return pages;

    };

    let titles: PageObject[]|null = null;
    if (!searchDone) {
        console.log('Searching for pages...');
        for (let i = 0; i < 3; i++) {
            titles = await search();
            if (titles) {
                break;
            } else if (i < 2) {
                console.log('Retrying in 10 seconds...');
                await lib.sleep(1000*10);
            }
        }
        if (!titles) {
            console.log('Search failed.');
            return null;
        } else if (titles.length) {
            console.log(`${titles.length} pages found.`);
            return titles;
        } else {
            console.log('No pages matched the search criteria.');
            searchDone = true;
        }
    }
    console.log('Fetching pages that transclude Template:削除依頼過去ログ...');
    titles = await transcluding();
    console.log(`${titles.length} page(s) found.`);
    processed = processed.concat(titles.map(({title}) => title));
    return titles;

}

interface ParsedDeletionNote {
    input: string|RegExp;
    notes: DeletionNoteInfo[];
}
interface DeletionNoteInfo {
    talk: boolean;
    result: string;
    subpage: string;
}
interface ParsedLinks {
    titles: string[];
    hasDelPage: boolean;
}
type ErrorCodes = (
    /** Failed to get the latest revision or the page doesn't exist. */
    |'nolr'
    /** No deletion notes have been parsed. */
    |'unparsed'
    /** Detected an unparsable $1 in [[$1|$2]]. */
    |'unparsablelinks'
    /** A log line returned no wikilinks after parseLinks(). */
    |'logline'
    /** Detected an occurrence of Template:削除依頼過去ログ that can't be processed because the page type (main, talk) is unknown. */
    |'pagetypeunknown'
    /** Detected an occurrence of Template:削除依頼過去ログ that has a logline with an unprocessable AfD result. */
    |'resultunknown'
    /** Detected an occurrence of Template:削除依頼過去ログ that has a logline with no parsable links. */
    |'noparsablelinks'
    /** Newly appended templates might have links to non-existing pages. */
    |'existenceunknown'
    /** Code error on page existence. */
    |'existenceundefined'
    /** createTemplate() returned empty arrays. */
    |'emptytemplate'
    /** The page content is the same before and after running the bot. */
    |'samecontent'
    /** Failed to edit the page. */
    |'editfailed'
);

class AFDNote {

    prefixedTitle: string;
    delPrefixedTitle: string;
    delRegex: {
        prefix: RegExp;
        title: RegExp;
    };
    hasDelPage: {
        main: boolean;
        talk: boolean;
    };
    content: string;
    errCodes: ErrorCodes[];

    constructor(pageObj: PageObject) {

        // Get title-related info
        const prefixedTitle = pageObj.title;
        this.prefixedTitle = prefixedTitle;
        const ns = pageObj.ns;
        const prefix = getCanonicalAlias(ns);
        const title = prefixedTitle.replace(new RegExp(`^${prefix}:`), '');
        const rootTitle = title.split('/')[0];

        // Create title regex for a talk page AfD dicussion
        this.delPrefixedTitle = prefix + ':' + rootTitle + '/削除';
        const delAliases = Object.keys(wgNamespaceIds).reduce((acc: string[], alias) => {
            // @ts-ignore
            if (wgNamespaceIds[alias] === ns) {
                acc.push(alias.replace(/ /g, '[ _]'));
            }
            return acc;
        }, []);
        const firstLet = rootTitle.charAt(0).toLowerCase() + rootTitle.charAt(0).toUpperCase();
        this.delRegex = {
            prefix: new RegExp(`^\\s*:?\\s*(${delAliases.join('|')})\\s*:`, 'i'),
            title: new RegExp(`:\\s*([${lib.escapeRegExp(firstLet)}]${lib.escapeRegExp(rootTitle.slice(1))}\\/削除)\\s*$`)
        };
        this.hasDelPage = {
            main: false,
            talk: false
        };

        this.content = '';
        this.errCodes = [];

    }

    private addCode(code: ErrorCodes) {
        if (!this.errCodes.includes(code)) {
            this.errCodes.push(code);
        }
    }

    async init() {

        // Get latest revision
        const lr = await lib.getLatestRevision(this.prefixedTitle);
        if (!lr) {
            this.addCode('nolr');
            return;
        }
        this.content = lr.content;

        const parsed = this.parseDeletionNotes().concat(this.parseAfdOldLog());
        if (!parsed.length) {
            this.addCode('unparsed');
            return;
        }
        this.content = lib.replaceWikitext(this.content, parsed.map(({input}) => input), '');

        const tmpl = await this.createTemplate(parsed);
        if (!tmpl.length) {
            this.addCode('emptytemplate');
            return;
        }
        tmpl.forEach((t) => {
            this.content = t + '\n' + this.content;
        });
        if (this.content === lr.content) {
            this.addCode('samecontent');
            return;
        }

        // Edit the page
        const res = await lib.edit({
            title: this.prefixedTitle,
            text: this.content,
            summary: '',
            bot: true,
            basetimestamp: lr.basetimestamp,
            starttimestamp: lr.curtimestamp,
        });
        if (!res) {
            this.addCode('editfailed');
        }

    }

    private parseDeletionNotes(): ParsedDeletionNote[] {

        /** 1: Whether the note is for a talk page; 2: Result of AfD */
        const regex = /(?:\{\{NOINDEX\}\}\s*)?[^\S\n\r]*'*[^\S\n\r]*この(ノート)?ページ(?:は一度|には)(削除された版|削除が検討|特定版削除|版指定削除|特定版版指定削除|削除).+?をご覧ください。\s*'*\s*/g;

        // Get all subst-ed 削除済みノート
        const ret: ParsedDeletionNote[] = [];
        let m: RegExpExecArray|null;
        while ((m = regex.exec(this.content))) {

            // Parse all links to an AfD subpage and get subpage titles
            const links = this.parseLinks(m[0]);
            if (!links.hasDelPage && !links.titles.length) {
                this.addCode('logline');
                continue;
            }

            // Get an unified result of the AfDs
            const talk = !!m[1];
            const result = AFDNote.getResult(m[2]);
            ret.push({
                input: m[0],
                // If this is an empty array, the input string is just to be replaced with an empty string.
                notes: links.titles.map((subpage) => ({talk, result, subpage}))
            });

            if (links.hasDelPage) {
                const key = talk ? 'talk' : 'main';
                this.hasDelPage[key] = true;
            }

        }

        return ret;

    }

    /** Convert a matched string to an AfD result. */
    private static getResult(matched: string) {
        switch (matched) {
            case '削除':
                return '削除';
            case '特定版削除':
                return '特定版指定削除';
            case '版指定削除':
                return '版指定削除';
            case '特定版版指定削除':
                return '版指定削除';
            case '削除された版':
                return '特定版指定削除';
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
    private parseLinks(str: string): ParsedLinks {
        const regex = /\[\[([^|\]]+)(?:\|([^\]]+))?\]\]/g; // [[(1)|(2)]]
        const subpages: string[] = [];
        let m: RegExpExecArray|null;
        let hasDelPage = false;
        while ((m = regex.exec(str))) {
            let p: RegExpMatchArray|null;
            m[1] = m[1].replace(/\{\{NAMESPACE\}\}:\{\{PAGENAME\}\}/g, this.prefixedTitle);
            if ((p = m[1].match(/^\s*:?\s*(?:wikipedia|wp|project)\s*:\s*削除依頼\/(.+?)\s*$/i))) {
                const page = lib.ucFirst(p[1]).replace(/_/g, ' ');
                subpages.push(page);
            } else if (!hasDelPage && this.delRegex.prefix.test(m[1]) && this.delRegex.title.test(m[1])) {
                hasDelPage = true;
            } else {
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
    private parseAfdOldLog(): ParsedDeletionNote[] {

        // Does the content have any 削除依頼過去ログ template in it?
        const tmpl = lib.parseTemplates(this.content, {namePredicate: name => name === '削除依頼過去ログ'});
        return tmpl.reduce((acc: ParsedDeletionNote[], obj) => {

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

                const info: DeletionNoteInfo[] = [];
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
                            } else {
                                if (links.hasDelPage) {
                                    const key = forTalk ? 'talk' : 'main';
                                    this.hasDelPage[key] = true;
                                } else {
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

            } else { // The template has no parameter; Just to be replaced with an empty string
                acc.push({
                    input: new RegExp(lib.escapeRegExp(obj.text) + '\\n?'),
                    notes: []
                });
            }
            return acc;

        }, []);

    }

    private async createTemplate(parsed: ParsedDeletionNote[]): Promise<string[]> {

        // Flatten the 'parsed' array of objects to an array of 'notes' object array without duplicates
        const pages: string[] = [];
        const notes = parsed.reduce((acc: DeletionNoteInfo[], obj) => {
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
        if (this.hasDelPage.main || this.hasDelPage.talk) {
            pages.push(this.delPrefixedTitle);
        }
        const e = await pagesExist(pages);
        notes.sort((obj1, obj2) => {
            const ts1 = e[`Wikipedia:削除依頼/${obj1.subpage}`].create;
            const ts2 = e[`Wikipedia:削除依頼/${obj2.subpage}`].create;
            if (!ts1 || !ts2) {
                return ts1 > ts2 ? 1 : -1;
            } else {
                const d1 = new Date(ts1);
                const d2 = new Date(ts2);
                return d1 > d2 ? 1 : -1;
            }
        });

        // Create templates
        type TemplateInfo = {
            params: string[];
            added: string[];
        }
        type Template = {
            main :TemplateInfo;
            talk: TemplateInfo;
        }
        let tmpl: Template = {main: {params: [], added: []}, talk: {params: [], added: []}};
        if (this.hasDelPage.main && e[this.delPrefixedTitle].exist) {
            tmpl.main.params.push(`|result1=ノート議論|fullpage1=${this.delPrefixedTitle}`);
        }
        if (this.hasDelPage.talk && e[this.delPrefixedTitle].exist) {
            tmpl.talk.params.push(`|result1=ノート議論|fullpage1=${this.delPrefixedTitle}`);
        }
        tmpl = notes.reduce((acc: Template, {talk, result, subpage}) => {

            const page = `Wikipedia:削除依頼/${subpage}`;
            const typ = talk ? 'talk' : 'main';
            const params = tmpl[typ].params;
            const added = tmpl[typ].added;
            if (added.includes(page)) {
                return acc;
            } else {
                added.push(page);
            }
            switch (e[page].exist) {
                case true: // Page exists
                    break;
                case false: // Page doesn't exist
                    return acc;
                case null: // Existence unknown
                    console.log(`Existence unknown for ${page}`);
                    this.addCode('existenceunknown');
                    break;
                case undefined:
                    console.log(`Existence undefined for ${page}`);
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

        return ['talk', 'main'].reduce((acc: string[], key) => {
            // @ts-ignore
            const params = tmpl[key].params;
            if (params.length) {
                params.unshift('{{削除依頼ログ/sandbox', `|talk=${key === 'talk'}`);
                params.push('}}');
                acc.push(params.join('\n'));
            }
            return acc;
        }, []);

    }

}

function getCanonicalAlias(ns: number): string {
    // @ts-ignore
    const alias = wgFormattedNamespaces[ns];
    if (!alias) throw new Error(`${ns} is invalid as a namespace number.`);
    return alias;
}

interface ExistObject {
    [title: string]: {
        /** Whether the title exists. Null if the query failed. */
        exist: boolean|null;
        /** The timestamp of the first revision. An empty string if it's unavailable. */
        create: string;
    };
}

async function pagesExist(pagetitles: string[]): Promise<ExistObject> {

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
    return result.reduce((acc: ExistObject, res, i) => {
        let resPg: ApiResponseQueryPages[]|undefined;
        if (res && res.query && (resPg = res.query.pages) && resPg[0]) {
            const resRv = resPg[0].revisions;
            acc[pagetitles[i]] = {
                exist: !resPg[0].missing,
                create: resRv && resRv[0] && resRv[0].timestamp || ''
            };
        } else {
            acc[pagetitles[i]] = {
                exist: null,
                create: ''
            };
        }
        return acc;
    }, Object.create(null));

}